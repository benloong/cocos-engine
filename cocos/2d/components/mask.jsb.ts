/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { ccclass, executeInEditMode, executionOrder, help, menu, serializable } from 'cc.decorator';
import { SpriteFrame } from '../assets/sprite-frame';
import { Component } from '../../scene-graph/component';
import type { Material } from '../../asset/assets';
import type { MaterialInstance } from '../../render-scene';
import type { Color } from '../../core';
import { Node } from '../../scene-graph/node';
import { UITransform } from '../framework/ui-transform';
import { Graphics } from './graphics';
import { Sprite } from './sprite';
import { MaskMode } from '../renderer/render-entity';
import { Stage } from '../renderer/stencil-manager';
import { CCObject, clamp, isValid, Vec2, warnID } from '../../core';

declare const n2d: any;

export enum MaskType {
    GRAPHICS_RECT = 0,
    GRAPHICS_ELLIPSE = 1,
    GRAPHICS_STENCIL = 2,
    SPRITE_STENCIL = 3,
}

/**
 * Native stencil lifecycle and state bridge.
 */
@ccclass('cc.Mask')
@help('i18n:cc.Mask')
@executionOrder(110)
@menu('2D/Mask')
@executeInEditMode
export class Mask extends Component {
    public static Type = MaskType;

    @serializable
    protected _type = MaskType.GRAPHICS_RECT;

    @serializable
    protected _inverted = false;

    @serializable
    protected _segments = 64;

    @serializable
    protected _radius = 0;

    @serializable
    protected _alphaThreshold = 0.1;

    private _native: any = null;
    private _spriteFrame: SpriteFrame | null | undefined;
    private _sprite: Sprite | null = null;
    private _graphics: Graphics | null = null;
    private _graphicsNode: Node | null = null;

    public onLoad (): void {
        this._native = new n2d.Mask();
        this._native.setType(this._type);
        this._native.setNode(this.node);
        this._bindStencil();
        this._syncStencilSettings();
        this._native.setPriority(0);
        this._native.setEnabled(this.enabledInHierarchy);
    }

    public onRestore (): void {
        this._native?.setType(this._type);
        this._bindStencil();
        this._syncStencilSettings();
    }

    private _syncStencilSettings (): void {
        if (!this._native) return;
        this._native.setSegments(this._segments);
        this._native.setRadius(this._radius);
        this.inverted = this._inverted;
        this.alphaThreshold = this._alphaThreshold;
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
        if (this._type === MaskType.SPRITE_STENCIL) this._getSprite().enabled = true;
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
        if (isValid(this._sprite, true)) {
            this._setSpriteMask(this._sprite, false);
            if (this.node.activeInHierarchy) this._sprite.enabled = false;
        }
    }

    public onDestroy (): void {
        this._graphics?._setMask(null);
        if (this._sprite) this._setSpriteMask(this._sprite, false);
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
        this._graphicsNode?.destroy();
        this._graphicsNode = null;
        this._graphics = null;
        this._sprite = null;
    }

    get type (): MaskType {
        return this._type;
    }

    set type (value: MaskType) {
        if (this._type === value) return;
        this._type = value;
        this._native?.setType(value);
        this._bindStencil();
    }

    private _bindStencil (): void {
        if (this._type === MaskType.SPRITE_STENCIL) {
            this._getSprite().enabled = this.enabled;
        } else if (this._sprite) {
            this._setSpriteMask(this._sprite, false);
            this._sprite._destroyImmediate();
            this._sprite = null;
        }
        if (this._type === MaskType.GRAPHICS_STENCIL) this._getGraphics();
    }

    private _invalidateStencil (): void {
        this._native?.invalidateStencil();
    }

    get inverted (): boolean {
        return this._inverted;
    }

    set inverted (value: boolean) {
        this._inverted = value;
        this._native?.setInverted(value);
        if (this._sprite && this.enabledInHierarchy) this._setSpriteMask(this._sprite, true);
    }

    get segments (): number {
        return this._segments;
    }

    set segments (value: number) {
        this._segments = clamp(value, 3, 10000);
        this._native?.setSegments(this._segments);
    }

    get graphics (): Graphics | Sprite | null {
        return this.subComp;
    }

    get subComp (): Graphics | Sprite | null {
        if (this._type !== MaskType.SPRITE_STENCIL) return this._getGraphics();
        return isValid(this._sprite, true) ? this._sprite : null;
    }

    private _getSprite (): Sprite {
        let sprite = this._sprite;
        if (!sprite || !isValid(sprite, true)) {
            sprite = this.node.getComponent(Sprite);
            if (!sprite || !isValid(sprite, true)) {
                sprite = this.node.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            this._sprite = sprite;
            if (this._spriteFrame !== undefined) {
                const frame = this._spriteFrame;
                this._spriteFrame = undefined;
                sprite.spriteFrame = frame;
            }
        }
        this._setSpriteMask(sprite, true);
        return sprite;
    }

    private _setSpriteMask (sprite: Sprite, attached: boolean): void {
        if (!isValid(sprite, true)) return;
        const nativeSprite = sprite as Sprite & { _setMask?: (mask: { setType (type: number): void } | null) => void };
        if (nativeSprite._setMask) {
            nativeSprite._setMask(attached ? this._native : null);
            return;
        }

        // The rollback Sprite submits its own RenderEntity to the native batcher.
        const active = attached && this.enabledInHierarchy;
        const mode = active ? (this._inverted ? MaskMode.MASK_INVERTED : MaskMode.MASK) : MaskMode.NONE;
        const stage = active ? (this._inverted ? Stage.ENTER_LEVEL_INVERTED : Stage.ENTER_LEVEL) : Stage.DISABLED;
        sprite.renderEntity.setMaskMode(mode);
        if (sprite.stencilStage !== stage) {
            sprite.stencilStage = stage;
            if (!active) {
                sprite.setSharedMaterial(sprite.getSharedMaterial(0), 0, true);
            }
            sprite.updateMaterial();
        }
        if (active) sprite.getMaterialInstance(0)?.setProperty('alphaThreshold', this._alphaThreshold);
    }

    private _getGraphics (): Graphics {
        if (!this._graphicsNode) {
            this._graphicsNode = new Node('MaskGraphics');
            this._graphicsNode._objFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
            this._graphicsNode.parent = this.node;
            this._graphicsNode.setPosition(0, 0, 0);
            this._graphicsNode.addComponent(UITransform);
        }
        if (!this._graphics) {
            this._graphics = this._graphicsNode.getComponent(Graphics)
                ?? this._graphicsNode.addComponent(Graphics);
            this._graphics.enabled = false;
        }
        this._graphics._setMask(this._native);
        return this._graphics;
    }

    get spriteFrame (): SpriteFrame | null {
        return this._sprite?.spriteFrame ?? this._spriteFrame ?? null;
    }

    set spriteFrame (value: SpriteFrame | null) {
        if (this._type === MaskType.SPRITE_STENCIL) {
            this._getSprite().spriteFrame = value;
            return;
        }
        this._spriteFrame = value;
    }

    get radius (): number {
        return this._radius;
    }

    set radius (value: number) {
        this._radius = Math.max(0, value);
        this._native?.setRadius(this._radius);
    }

    public isHit (worldPt: Vec2): boolean {
        return this._native?.isHitWorldPointXY(worldPt.x, worldPt.y) ?? false;
    }

    get alphaThreshold (): number {
        return this._alphaThreshold;
    }

    set alphaThreshold (value: number) {
        this._alphaThreshold = value;
        this._native?.setAlphaThreshold(value);
        if (this._sprite && this.enabledInHierarchy) this._setSpriteMask(this._sprite, true);
    }

    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get customMaterial (): Material | null {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.customMaterial;
        }
        return null;
    }
    set customMaterial (val) {
        warnID(9007);
        if (this.subComp) {
            this.subComp.customMaterial = val;
        }
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get color (): Color | null {
        warnID(9007);
        if (this.subComp) {
            // FIXME: the type of subComp is Sprite | graphics, and Sprite.color returns Readonly<Color>.
            // so have to use as Color here. And i don't want to change the return type to Readonly<Color>
            // as it will break compatibility.
            return this.subComp.color as Color;
        }
        return null;
    }
    set color (value) {
        warnID(9007);
        if (this.subComp && value) {
            this.subComp.color = value;
        }
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public markForUpdateRenderData (enable = true): void {
        warnID(9007);
        this.subComp?._markForUpdateRenderData(enable);
        if (enable) this._invalidateStencil();
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public requestRenderData (any): void {
        warnID(9007);
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public destroyRenderData (): void {
        warnID(9007);
    }

    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public updateRenderer (): void {
        warnID(9007);
        this.subComp?.updateRenderer();
        this._invalidateStencil();
    }

    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public fillBuffers (render: any): void {
        warnID(9007);
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public postUpdateAssembler (render: any): void {
        warnID(9007);
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public setNodeDirty (): void {
        warnID(9007);
        this.subComp?.setNodeDirty();
        this._invalidateStencil();
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public setTextureDirty (): void {
        warnID(9007);
        this.subComp?.setTextureDirty();
        this._invalidateStencil();
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get sharedMaterial (): Material | null {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.sharedMaterial;
        }
        return null;
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get sharedMaterials (): (Material | null)[] | null {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.sharedMaterials;
        }
        return null;
    }
    set sharedMaterials (val) {
        warnID(9007);
        if (this.subComp && val) {
            this.subComp.sharedMaterials = val;
        }
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get material (): any {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.material;
        }
        return null;
    }
    set material (val: any) {
        warnID(9007);
        if (this.subComp) {
            this.subComp.material = val;
        }
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    get materials (): (any)[] {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.materials;
        }
        return [null];
    }
    set materials (val: (any)[]) {
        warnID(9007);
        if (this.subComp) {
            this.subComp.materials = val;
        }
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public getMaterial (idx: number): any {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.getSharedMaterial(idx);
        }
        return null;
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public setMaterial (material: Material | MaterialInstance | null, index: number): void {
        warnID(9007);
        this.subComp?.setMaterial(material, index);
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public getMaterialInstance (idx: number): any {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.getMaterialInstance(idx);
        }
        return null;
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public setMaterialInstance (matInst: Material | MaterialInstance | null, index: number): void {
        warnID(9007);
        this.subComp?.setMaterialInstance(matInst, index);
    }
    /** @deprecated Since v3.6, use the stencil renderer directly. */
    public getRenderMaterial (index: number): any {
        warnID(9007);
        if (this.subComp) {
            return this.subComp.getRenderMaterial(index);
        }
        return null;
    }
}
