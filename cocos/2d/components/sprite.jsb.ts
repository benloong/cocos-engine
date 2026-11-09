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
import { Material } from '../../asset/assets';
import { Color } from '../../core/math/color';
import { Vec2 } from '../../core/math/vec2';
import { SpriteFrame } from '../assets/sprite-frame';
import { UITransform } from '../framework/ui-transform';
import { UIRenderer } from '../framework/ui-renderer';

declare const n2d: any;

/**
 * Native M2 SIMPLE Sprite shell.
 *
 * Serialization and editor metadata stay in JS. The native Sprite owns the
 * frame, geometry and RenderEntity. This shell is intentionally limited to
 * SIMPLE mode until the native material/mode work is complete.
 */
@ccclass('cc.Sprite')
@help('i18n:cc.Sprite')
@executionOrder(110)
@menu('2D/Sprite')
export class Sprite extends UIRenderer {
    public static FillType = {
        HORIZONTAL: 0,
        VERTICAL: 1,
        RADIAL: 2,
    };

    public static Type = {
        SIMPLE: 0,
        SLICED: 1,
        TILED: 2,
        FILLED: 3,
    };

    public static SizeMode = {
        CUSTOM: 0,
        TRIMMED: 1,
        RAW: 2,
    };

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
    protected _fillRange = 1;
    @serializable
    protected _isTrimmedMode = true;
    @serializable
    protected _useGrayscale = false;
    @serializable
    protected _atlas: any = null;

    private _native: any = null;

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
    }

    @displayOrder(6)
    get type (): number {
        return this._type;
    }

    set type (value: number) {
        this._type = value;
        this._native?.setType(value);
    }

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
        this._fillStart = value;
        this._native?.setFillStart(value);
    }

    get fillRange (): number {
        return this._fillRange;
    }

    set fillRange (value: number) {
        this._fillRange = value;
        this._native?.setFillRange(value);
    }

    get sizeMode (): number {
        return this._sizeMode;
    }

    set sizeMode (value: number) {
        this._sizeMode = value;
    }

    get fillCenter (): Vec2 {
        return this._fillCenter;
    }

    set fillCenter (value: Vec2) {
        this._fillCenter.set(value);
        this._native?.setFillCenter(value.x, value.y);
    }

    get color (): Readonly<Color> {
        return this._color;
    }

    set color (value: Color) {
        if (this._color.equals(value)) {
            return;
        }
        this._color.set(value);
        this._syncColor();
    }

    get customMaterial (): Material | null {
        return this._customMaterial;
    }

    set customMaterial (value: Material | null) {
        this._customMaterial = value;
        this._syncMaterial();
    }

    public getSharedMaterial (idx = 0): Material | null {
        if (this._native) {
            return this._native.getSharedMaterial(idx);
        }
        return super.getSharedMaterial(idx);
    }

    public setSharedMaterial (material: Material | null, index: number, forceUpdate = false): void {
        super.setSharedMaterial(material, index, forceUpdate);
        this._native?.setSharedMaterial(material, index);
    }

    public __preload (): void {
        // Native lifecycle owns the render entity; avoid the JS assembler path.
    }

    public onLoad (): void {
        this._native = new n2d.Sprite();
        this._native.setNode(this.node);
        const transform = this.node.getComponent(UITransform) as any;
        if (transform && transform._native) {
            this._native.setUITransform(transform._native);
        }
        this._syncColor();
        this._syncMaterial();
        this._native.setType(this._type);
        this._native.setFillType(this._fillType);
        this._native.setFillStart(this._fillStart);
        this._native.setFillRange(this._fillRange);
        this._native.setFillCenter(this._fillCenter.x, this._fillCenter.y);
        this._native.setPriority(this.priority);
        this._syncFrame();
        this._native.setEnabled(this.enabledInHierarchy);
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
    }

    private _syncColor (): void {
        if (this._native) {
            this._native.setColorRGBA(this._color.r, this._color.g, this._color.b, this._color.a);
        }
    }

    private _syncMaterial (): void {
        if (this._native && this._customMaterial) {
            this._native.setMaterial(this._customMaterial);
        }
    }

    private _syncFrame (): void {
        if (!this._native) {
            return;
        }
        const frame = this._spriteFrame;
        if (!frame || !frame.texture) {
            this._native.clearFrame();
            return;
        }
        const texture = frame.texture;
        const rect = frame.rect;
        const original = frame.originalSize;
        const offset = frame.offset;
        const nativeFrame = new n2d.SpriteFrame();
        nativeFrame.setTexture(texture);
        nativeFrame.setRect(rect.x, rect.y, rect.width, rect.height);
        nativeFrame.setOriginalSize(original.width, original.height);
        nativeFrame.setOffset(offset.x, offset.y);
        nativeFrame.setRotated(frame.rotated);
        nativeFrame.setInsets(frame.insetLeft, frame.insetRight, frame.insetTop, frame.insetBottom);
        this._native.setFrame(nativeFrame);
    }
}
