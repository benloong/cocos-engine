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

import { ccclass } from 'cc.decorator';
import { Rect, Size, Vec2 } from '../../core';
import { Asset } from '../../asset/assets/asset';
import { TextureBase } from '../../asset/assets/texture-base';

declare const n2d: any;

const INSET_LEFT = 0;
const INSET_TOP = 1;
const INSET_RIGHT = 2;
const INSET_BOTTOM = 3;

/**
 * Native M2 shell for SpriteFrame.
 *
 * Serialization and the public asset API stay in JS. The native SpriteFrame
 * owns the texture reference and the frame data consumed by the native Sprite
 * assembler; setters only forward to it.
 */
@ccclass('cc.SpriteFrame')
export class SpriteFrame extends Asset {
    protected _texture: TextureBase | null = null;
    protected _rect = new Rect();
    protected _originalSize = new Size();
    protected _offset = new Vec2();
    protected _rotated = false;
    protected _capInsets = [0, 0, 0, 0];
    protected _atlasUuid = '';
    protected _isFlipUVX = false;
    protected _isFlipUVY = false;
    protected _packable = true;
    protected _pixelsToUnit = 100;
    protected _pivot = new Vec2(0.5, 0.5);
    protected _meshType = 0;

    public uv: number[] = [];
    private _nativeFrame: any = null;

    constructor (name?: string) {
        super(name);
    }

    public _calculateUV (): void {
        const texture = this._texture;
        if (!texture) {
            return;
        }
        const rect = this._rect;
        const tw = texture.width || 1;
        const th = texture.height || 1;
        const l = rect.x / tw;
        const r = (rect.x + (this._rotated ? rect.height : rect.width)) / tw;
        const t = rect.y / th;
        const b = (rect.y + (this._rotated ? rect.width : rect.height)) / th;
        this.uv = [l, t, l, b, r, t, r, b];
    }

    public get native (): any {
        if (!this._nativeFrame) {
            this._nativeFrame = new n2d.SpriteFrame();
            this._syncNative();
        }
        return this._nativeFrame;
    }

    get texture (): TextureBase | null {
        return this._texture;
    }

    set texture (value: TextureBase | null) {
        this._texture = value;
        this._syncTexture();
    }

    get rect (): Rect {
        return this._rect;
    }

    set rect (value: Rect) {
        this._rect.set(value);
        this._syncFrameData();
    }

    get originalSize (): Size {
        return this._originalSize;
    }

    set originalSize (value: Size) {
        this._originalSize.set(value);
        this._syncFrameData();
    }

    get offset (): Vec2 {
        return this._offset;
    }

    set offset (value: Vec2) {
        this._offset.set(value);
        this._syncFrameData();
    }

    get rotated (): boolean {
        return this._rotated;
    }

    set rotated (value: boolean) {
        this._rotated = value;
        this._syncFrameData();
    }

    get insetLeft (): number { return this._capInsets[INSET_LEFT]; }
    set insetLeft (value: number) { this._capInsets[INSET_LEFT] = value; this._syncFrameData(); }
    get insetTop (): number { return this._capInsets[INSET_TOP]; }
    set insetTop (value: number) { this._capInsets[INSET_TOP] = value; this._syncFrameData(); }
    get insetRight (): number { return this._capInsets[INSET_RIGHT]; }
    set insetRight (value: number) { this._capInsets[INSET_RIGHT] = value; this._syncFrameData(); }
    get insetBottom (): number { return this._capInsets[INSET_BOTTOM]; }
    set insetBottom (value: number) { this._capInsets[INSET_BOTTOM] = value; this._syncFrameData(); }

    get width (): number { return this._rect.width; }
    get height (): number { return this._rect.height; }

    get atlasUuid (): string { return this._atlasUuid; }
    set atlasUuid (value: string) { this._atlasUuid = value; }

    get flipUVX (): boolean { return this._isFlipUVX; }
    set flipUVX (value: boolean) { this._isFlipUVX = value; }
    get flipUVY (): boolean { return this._isFlipUVY; }
    set flipUVY (value: boolean) { this._isFlipUVY = value; }

    get packable (): boolean { return this._packable; }
    set packable (value: boolean) { this._packable = value; }

    get pixelsToUnit (): number { return this._pixelsToUnit; }
    set pixelsToUnit (value: number) { this._pixelsToUnit = value; }

    get pivot (): Vec2 { return this._pivot; }
    set pivot (value: Vec2) { this._pivot.set(value); }

    get meshType (): number { return this._meshType; }
    set meshType (value: number) { this._meshType = value; }

    public textureLoaded (): boolean {
        return this._texture !== null;
    }

    public isRotated (): boolean {
        return this._rotated;
    }

    public setRotated (rotated: boolean): void {
        this.rotated = rotated;
    }

    public getRect (out?: Rect): Rect {
        if (out) { out.set(this._rect); return out; }
        return this._rect.clone();
    }

    public setRect (rect: Rect): void {
        this.rect = rect;
    }

    public getOriginalSize (out?: Size): Size {
        if (out) { out.set(this._originalSize); return out; }
        return this._originalSize.clone();
    }

    public setOriginalSize (size: Size): void {
        this.originalSize = size;
    }

    public getOffset (out?: Vec2): Vec2 {
        if (out) { out.set(this._offset); return out; }
        return this._offset.clone();
    }

    public setOffset (offset: Vec2): void {
        this.offset = offset;
    }

    public _calculateSlicedUV (): void {
        this._calculateUV();
    }
    public getGFXTexture (): any {
        return this._texture ? this._texture.getGFXTexture() : null;
    }

    public getGFXSampler (): any {
        return this._texture ? this._texture.getGFXSampler() : null;
    }

    public getHash (): number {
        return this._texture ? this._texture.getHash() : 0;
    }

    public getSamplerInfo (): any {
        return this._texture ? this._texture.getSamplerInfo() : null;
    }

    public reset (info?: any, clearData = false): void {
        if (clearData || !info) {
            this._rect.set(0, 0, 0, 0);
            this._originalSize.set(0, 0);
            this._offset.set(0, 0);
            this._rotated = false;
            this._capInsets = [0, 0, 0, 0];
        }
        if (info) {
            if (info.texture) {
                this.texture = info.texture;
                this._rect.set(0, 0, info.texture.width, info.texture.height);
            }
            if (info.originalSize) { this._originalSize.set(info.originalSize); }
            if (info.rect) { this._rect.set(info.rect); }
            if (info.offset) { this._offset.set(info.offset); }
            if (info.borderTop !== undefined) { this._capInsets[INSET_TOP] = info.borderTop; }
            if (info.borderBottom !== undefined) { this._capInsets[INSET_BOTTOM] = info.borderBottom; }
            if (info.borderLeft !== undefined) { this._capInsets[INSET_LEFT] = info.borderLeft; }
            if (info.borderRight !== undefined) { this._capInsets[INSET_RIGHT] = info.borderRight; }
            if (info.isRotate !== undefined) { this._rotated = !!info.isRotate; }
            if (info.isFlipUv !== undefined) { this._isFlipUVY = !!info.isFlipUv; }
        }
        this._syncNative();
    }

    public _serialize (): any {
        return {
            name: this._name,
            rect: { x: this._rect.x, y: this._rect.y, width: this._rect.width, height: this._rect.height },
            offset: { x: this._offset.x, y: this._offset.y },
            originalSize: { width: this._originalSize.width, height: this._originalSize.height },
            rotated: this._rotated,
            capInsets: this._capInsets,
            texture: this._texture ? this._texture._uuid : undefined,
            packable: this._packable,
            pixelsToUnit: this._pixelsToUnit,
            pivot: { x: this._pivot.x, y: this._pivot.y },
            meshType: this._meshType,
        };
    }

    public _deserialize (data: any): void {
        if (data.rect) { this._rect = new Rect(data.rect.x, data.rect.y, data.rect.width, data.rect.height); }
        if (data.offset) { this._offset = new Vec2(data.offset.x, data.offset.y); }
        if (data.originalSize) { this._originalSize = new Size(data.originalSize.width, data.originalSize.height); }
        this._rotated = !!data.rotated;
        this._name = data.name;
        this._packable = !!data.packable;
        this._pixelsToUnit = data.pixelsToUnit;
        if (data.pivot) { this._pivot = new Vec2(data.pivot.x, data.pivot.y); }
        this._meshType = data.meshType;
        if (data.capInsets) {
            this._capInsets = [
                data.capInsets[INSET_LEFT],
                data.capInsets[INSET_TOP],
                data.capInsets[INSET_RIGHT],
                data.capInsets[INSET_BOTTOM],
            ];
        }
        this._syncNative();
    }

    private _syncTexture (): void {
        if (this._nativeFrame) {
            this._nativeFrame.setTexture(this._texture);
        }
    }

    private _syncFrameData (): void {
        if (!this._nativeFrame) {
            return;
        }
        const frame = this._nativeFrame;
        frame.setRect(this._rect.x, this._rect.y, this._rect.width, this._rect.height);
        frame.setOriginalSize(this._originalSize.width, this._originalSize.height);
        frame.setOffset(this._offset.x, this._offset.y);
        frame.setRotated(this._rotated);
        frame.setInsets(
            this._capInsets[INSET_LEFT],
            this._capInsets[INSET_RIGHT],
            this._capInsets[INSET_TOP],
            this._capInsets[INSET_BOTTOM],
        );
    }

    private _syncNative (): void {
        if (!this._nativeFrame) {
            return;
        }
        this._syncTexture();
        this._syncFrameData();
    }
}
