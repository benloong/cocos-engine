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
import { Color } from '../../core';
import { UIRenderer } from '../framework/ui-renderer';
import { LineCap, LineJoin } from '../assembler/graphics/types';
import { bindNativeMaterialSlots, patchNativeMaterialAPIs, releaseNativeMaterialSlots } from '../framework/native-ui-materials';

declare const n2d: any;

/**
 * Metadata, lifecycle and command bridges. Native owns paths, triangulation
 * and local GPU mesh buffers, including the signed stroke-distance attribute.
 */
@ccclass('cc.Graphics')
@help('i18n:cc.Graphics')
@executionOrder(110)
@menu('2D/Graphics')
@executeInEditMode
export class Graphics extends UIRenderer {
    public static LineCap = LineCap;
    public static LineJoin = LineJoin;
    @serializable protected _lineCap = LineCap.BUTT;
    @serializable protected _lineJoin = LineJoin.MITER;
    @serializable protected _miterLimit = 10;
    @serializable
    protected _lineWidth = 1;

    @serializable
    protected _strokeColor = Color.BLACK.clone();

    @serializable
    protected _fillColor = Color.WHITE.clone();

    private _native: any = null;
    private _mask: any = null;

    public _setMask (mask: any): void {
        if (this._mask === mask) return;
        this._mask?.setGraphics(null);
        this._mask = mask;
        this._mask?.setGraphics(this._native);
    }

    public onLoad (): void {
        this._native = new n2d.Graphics();
        this._native.setNode(this.node);
        this._native.setPriority(this.priority);
        this._native.setEnabled(this.enabledInHierarchy);
        this._native.setLineWidth(this._lineWidth);
        this._native.setFillColor(this._fillColor);
        this._native.setStrokeColor(this._strokeColor);
        this._native.setLineJoin(this._lineJoin);
        this._native.setLineCap(this._lineCap);
        this._native.setMiterLimit(this._miterLimit);
        this._native.setColorRGBA(this.color.r, this.color.g, this.color.b, this.color.a);
        bindNativeMaterialSlots(this);
        this._mask?.setGraphics(this._native);
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        this._setMask(null);
        releaseNativeMaterialSlots(this);
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
    }

    get lineJoin (): LineJoin { return this._lineJoin; }
    set lineJoin (value: LineJoin) { this._lineJoin = value; this._native?.setLineJoin(value); }
    get lineCap (): LineCap { return this._lineCap; }
    set lineCap (value: LineCap) { this._lineCap = value; this._native?.setLineCap(value); }
    get miterLimit (): number { return this._miterLimit; }
    set miterLimit (value: number) { this._miterLimit = value; this._native?.setMiterLimit(value); }
    get customMaterial (): any { return this._customMaterial; }
    set customMaterial (value: any) { this._customMaterial = value; this._native?.setMaterial(value); }
    get color (): Readonly<Color> { return this._color; }
    set color (value: Readonly<Color>) {
        this._color.set(value);
        this._native?.setColorRGBA(value.r, value.g, value.b, value.a);
    }

    get lineWidth (): number {
        return this._lineWidth;
    }

    set lineWidth (value: number) {
        this._lineWidth = value;
        this._native?.setLineWidth(value);
    }

    get fillColor (): Readonly<Color> {
        return this._fillColor;
    }

    set fillColor (value: Readonly<Color>) {
        this._fillColor.set(value);
        this._native?.setFillColor(value);
    }

    get strokeColor (): Readonly<Color> {
        return this._strokeColor;
    }

    set strokeColor (value: Readonly<Color>) {
        this._strokeColor.set(value);
        this._native?.setStrokeColor(value);
    }

    public clear (): void {
        this._native?.clear();
    }

    public moveTo (x: number, y: number): void {
        this._native?.moveTo(x, y);
    }

    public lineTo (x: number, y: number): void {
        this._native?.lineTo(x, y);
    }

    public close (): void {
        this._native?.close();
    }

    public rect (x: number, y: number, w: number, h: number): void {
        this._native?.rect(x, y, w, h);
    }
    public fillRect (x: number, y: number, w: number, h: number): void {
        this._native?.fillRect(x, y, w, h);
    }

    public roundRect (x: number, y: number, w: number, h: number, radius: number): void {
        this._native?.roundRect(x, y, w, h, radius);
    }

    public circle (x: number, y: number, radius: number): void {
        this._native?.circle(x, y, radius);
    }

    public ellipse (x: number, y: number, radiusX: number, radiusY: number): void {
        this._native?.ellipse(x, y, radiusX, radiusY);
    }

    public arc (cx: number, cy: number, r: number, startAngle = 0, endAngle = 6.283185307, counterclockwise = false): void {
        this._native?.arc(cx, cy, r, startAngle, endAngle, counterclockwise);
    }

    public bezierCurveTo (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
        this._native?.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
    }

    public quadraticCurveTo (cx: number, cy: number, x: number, y: number): void {
        this._native?.quadraticCurveTo(cx, cy, x, y);
    }

    public fill (): void {
        this._native?.fill();
    }

    public stroke (): void {
        this._native?.stroke();
    }
}
patchNativeMaterialAPIs(Graphics);
