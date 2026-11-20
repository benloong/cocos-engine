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

import { ccclass, displayOrder, executionOrder, help, menu, serializable, type } from 'cc.decorator';
import { EDITOR } from 'internal:constants';
import { ccenum, cclegacy, warnID } from '../../core';
import { SpriteAtlas } from '../assets/sprite-atlas';
import { Material } from '../../asset/assets';
import { BlendFactor } from '../../gfx';
import { Vec2 } from '../../core/math/vec2';
import { SpriteFrame } from '../assets/sprite-frame';
import { UIRenderer } from '../framework/ui-renderer';
import { bindNativeMaterialSlots, patchNativeMaterialAPIs, releaseNativeMaterialSlots, syncNativeMaterialSlots } from '../framework/native-ui-materials';

declare const n2d: any;

export enum SpriteType { SIMPLE = 0, SLICED = 1, TILED = 2, FILLED = 3 }
enum FillType { HORIZONTAL = 0, VERTICAL = 1, RADIAL = 2 }
enum SizeMode { CUSTOM = 0, TRIMMED = 1, RAW = 2 }
ccenum(SpriteType); ccenum(FillType); ccenum(SizeMode);
export enum SpriteEventType { SPRITE_FRAME_CHANGED = 'spriteframe-changed' }

/** Serialization and public API bridges; native owns geometry and materials. */
@ccclass('cc.Sprite')
@help('i18n:cc.Sprite')
@executionOrder(110)
@menu('2D/Sprite')
export class Sprite extends UIRenderer {
    public static FillType = FillType;
    public static Type = SpriteType;
    public static SizeMode = SizeMode;
    public static EventType = SpriteEventType;

    @serializable
    protected _spriteFrame: SpriteFrame | null = null;
    @serializable
    protected _type = 0;
    @serializable
    protected _fillType = 0;
    @serializable
    protected _sizeMode = 1;
    @serializable
    protected _fillCenter: Vec2 = new Vec2(0, 0);
    @serializable
    protected _fillStart = 0;
    @serializable
    protected _fillRange = 0;
    @serializable
    protected _isTrimmedMode = true;
    @serializable
    protected _useGrayscale = false;
    @serializable
    protected _atlas: SpriteAtlas | null = null;

    private _native: any = null;
    private _fillCenterView: Vec2 | null = null;

    @type(SpriteAtlas)
    get spriteAtlas (): SpriteAtlas | null { return this._atlas; }
    set spriteAtlas (value: SpriteAtlas | null) { this._atlas = value; }

    get trim (): boolean { return this._isTrimmedMode; }
    set trim (value: boolean) { this._isTrimmedMode = value; this._native?.setTrim(value); }

    get grayscale (): boolean { return this._useGrayscale; }
    set grayscale (value: boolean) { this._useGrayscale = value; this._native?.setGrayscale(value); }

    public changeSpriteFrameFromAtlas (name: string): void {
        if (!this._atlas) { warnID(16377); return; }
        this.spriteFrame = this._atlas.getSpriteFrame(name);
    }

    /** @deprecated since v3.7.0. Native chooses the texture-dependent variant. */
    public changeMaterialForDefine (): void { this._native?.refreshMaterial(); }

    @type(SpriteFrame)
    @displayOrder(5)
    get spriteFrame (): SpriteFrame | null {
        return this._spriteFrame;
    }

    set spriteFrame (value: SpriteFrame | null) {
        if (this._spriteFrame === value) {
            return;
        }
        this._spriteFrame = value;
        this._syncFrame();
        if (EDITOR) this.node.emit(SpriteEventType.SPRITE_FRAME_CHANGED, this);
    }

    @type(SpriteType)
    @displayOrder(6)
    get type (): number {
        return this._type;
    }

    set type (value: number) {
        this._type = value;
        this._native?.setType(value);
    }

    @type(FillType)
    get fillType (): number {
        return this._fillType;
    }

    set fillType (value: number) {
        this._fillType = value;
        this._native?.setFillType(value);
    }

    get fillStart (): number {
        return this._fillStart;
    }

    set fillStart (value: number) {
        this._fillStart = Math.min(1, Math.max(0, value));
        this._native?.setFillStart(this._fillStart);
    }

    get fillRange (): number {
        return this._fillRange;
    }

    set fillRange (value: number) {
        this._fillRange = Math.min(1, Math.max(-1, value));
        this._native?.setFillRange(this._fillRange);
    }

    @type(SizeMode)
    get sizeMode (): number {
        return this._sizeMode;
    }

    set sizeMode (value: number) {
        this._sizeMode = value;
        this._native?.setSizeMode(value);
    }

    get srcBlendFactor (): BlendFactor {
        return this._srcBlendFactor;
    }

    set srcBlendFactor (value: BlendFactor) {
        this._srcBlendFactor = value;
        this._native?.setSrcBlendFactor(value);
    }

    get dstBlendFactor (): BlendFactor {
        return this._dstBlendFactor;
    }

    set dstBlendFactor (value: BlendFactor) {
        this._dstBlendFactor = value;
        this._native?.setDstBlendFactor(value);
    }

    get fillCenter (): Vec2 {
        return this._bindFillCenter();
    }

    set fillCenter (value: Vec2) {
        if (this._native) this._native.setFillCenter(value.x, value.y);
        else this._fillCenter.set(value);
    }

    get customMaterial (): Material | null {
        return this._customMaterial;
    }

    set customMaterial (value: Material | null) {
        this._customMaterial = value;
        this._syncMaterial();
    }

    private _mask: { setType (type: number): void } | null = null;

    /** @engineInternal */
    public _setMask (mask: { setType (type: number): void } | null): void {
        if (this._mask === mask) return;
        this._mask = mask;
        if (this._native) this._mask?.setType(3);
    }

    public __preload (): void {
        // Native lifecycle owns the render entity; avoid the JS assembler path.
    }

    public onLoad (): void {
        const centerX = this._fillCenter.x, centerY = this._fillCenter.y;
        this._native = new n2d.Sprite();
        this._native.setNode(this.node);
        this._updateColor();
        bindNativeMaterialSlots(this);
        this._native.setTrim(this._isTrimmedMode);
        this._native.setGrayscale(this._useGrayscale);
        this._native.setType(this._type);
        this._native.setFillType(this._fillType);
        this._native.setFillStart(this._fillStart);
        this._native.setFillRange(this._fillRange);
        this._native.setFillCenter(centerX, centerY);
        this._bindFillCenter();
        this._native.setSizeMode(this._sizeMode);
        this._native.setSrcBlendFactor(this._srcBlendFactor);
        this._native.setDstBlendFactor(this._dstBlendFactor);
        this._native.setPriority(this.priority);
        this._syncFrame();
        this._native.setEnabled(this.enabledInHierarchy);
        this._mask?.setType(3);
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        this._mask = null;
        releaseNativeMaterialSlots(this);
        const center = this._fillCenter, x = center.x, y = center.y;
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
        if (this._fillCenterView) {
            Object.defineProperties(center, { x: { value: x, writable: true }, y: { value: y, writable: true } });
            this._fillCenterView = null;
        }
    }

    private _bindFillCenter (): Vec2 {
        const center = this._fillCenter;
        if (this._fillCenterView !== center) {
            let x = center.x, y = center.y;
            Object.defineProperties(center, {
                x: { configurable: true, enumerable: true,
                    get: () => this._native ? this._native.getFillCenterX() : x,
                    set: (value: number) => { x = value; this._native?.setFillCenter(value, center.y); } },
                y: { configurable: true, enumerable: true,
                    get: () => this._native ? this._native.getFillCenterY() : y,
                    set: (value: number) => { y = value; this._native?.setFillCenter(center.x, value); } },
            });
            this._fillCenterView = center;
        }
        return center;
    }

    protected _updateColor (): void {
        if (this._native) {
            this._native.setColorRGBA(this._color.r, this._color.g, this._color.b, this._color.a);
        }
    }

    private _syncMaterial (): void {
        if (this._native) {
            this._native.setMaterial(this._customMaterial);
            syncNativeMaterialSlots(this);
        }
    }

    private _syncFrame (): void {
        if (!this._native) {
            return;
        }
        const frame = this._spriteFrame;
        if (!frame) {
            this._native.clearFrame();
            return;
        }
        this._native.setFrame(frame);
    }
}

patchNativeMaterialAPIs(Sprite);
cclegacy.Sprite = Sprite;
