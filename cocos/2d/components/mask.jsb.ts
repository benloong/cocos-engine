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

import { dynamicAtlasManager } from '../utils/dynamic-atlas/atlas-manager';
import { ccclass, executeInEditMode, executionOrder, help, menu, serializable } from 'cc.decorator';
import { builtinResMgr } from '../../asset/asset-manager/builtin-res-mgr';
import { Material } from '../../asset/assets';
import { SpriteFrame } from '../assets/sprite-frame';
import { Component } from '../../scene-graph/component';
import { Node } from '../../scene-graph/node';
import { UITransform } from '../framework/ui-transform';
import { Graphics } from './graphics';
import { CCObject, clamp, Vec2 } from '../../core';

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
    private _spriteFrame: SpriteFrame | null = null;
    private _graphics: Graphics | null = null;
    private _graphicsNode: Node | null = null;

    public onLoad (): void {
        this._native = new n2d.Mask();
        this._native.setNode(this.node);
        const transform = this.node.getComponent(UITransform);
        if (transform && (transform as any)._native) {
            this._native.setUITransform((transform as any)._native);
        }
        const material = builtinResMgr.get<Material>('ui-alpha-test-material');
        if (material) {
            this._native.setMaterial(material);
        }
        this._native.setType(this._type);
        this._native.setSegments(this._segments);
        this._native.setRadius(this._radius);
        if (this._type === MaskType.GRAPHICS_STENCIL) {
            this._getGraphics();
        }
        this._native.setInverted(this._inverted);
        this._native.setAlphaThreshold(this._alphaThreshold);
        if (this._spriteFrame) {
            this._native.setSpriteFrame(this._spriteFrame);
        }
        this._native.setPriority(0);
        this._native.setEnabled(this.enabledInHierarchy);
    }

    public onEnable (): void {
        this._packStencilFrame();
        this._native?.setEnabled(true);
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        this._graphics?._setMask(null);
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
        this._graphicsNode?.destroy();
        this._graphicsNode = null;
        this._graphics = null;
    }

    get type (): MaskType {
        return this._type;
    }

    set type (value: MaskType) {
        this._type = value;
        this._native?.setType(value);
        if (this.enabledInHierarchy) this._packStencilFrame();
        if (value === MaskType.GRAPHICS_STENCIL) this._getGraphics();
    }

    get inverted (): boolean {
        return this._inverted;
    }

    set inverted (value: boolean) {
        this._inverted = value;
        this._native?.setInverted(value);
    }

    get segments (): number {
        return this._segments;
    }

    set segments (value: number) {
        this._segments = clamp(value, 3, 10000);
        this._native?.setSegments(this._segments);
    }

    get graphics (): Graphics | null {
        return this.subComp;
    }

    get subComp (): Graphics | null {
        return this._type === MaskType.SPRITE_STENCIL ? null : this._getGraphics();
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
        return this._spriteFrame;
    }

    set spriteFrame (value: SpriteFrame | null) {
        this._spriteFrame = value;
        if (this.enabledInHierarchy) this._packStencilFrame();
        this._native?.setSpriteFrame(value);
    }

    private _packStencilFrame (): void {
        if (this._native && this._type === MaskType.SPRITE_STENCIL) {
            dynamicAtlasManager.packToDynamicAtlas(this, this._spriteFrame);
        }
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
    }


}
