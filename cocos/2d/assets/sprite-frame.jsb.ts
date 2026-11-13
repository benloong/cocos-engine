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

import { cclegacy, js, Rect, Size, Vec2 } from '../../core';
import '../../asset/assets/asset';
import { TextureBase } from '../../asset/assets/texture-base';
import { Texture2D } from '../../asset/assets/texture-2d';
import { patch_cc_SpriteFrame } from '../../native-binding/decorators';
import type { SpriteFrame as JsbSpriteFrame } from './sprite-frame';

declare const jsb: any;

export type SpriteFrame = JsbSpriteFrame;
export const SpriteFrame: typeof JsbSpriteFrame = jsb.SpriteFrame;

cclegacy.SpriteFrame = SpriteFrame;

const INSET_LEFT = 0;
const INSET_TOP = 1;
const INSET_RIGHT = 2;
const INSET_BOTTOM = 3;

const spriteFrameProto: any = SpriteFrame.prototype;
// Preserve native setters before installing the JS asset API on the same prototype.
const nativeSetTexture = spriteFrameProto.setTexture;
const nativeSetRect = spriteFrameProto.setRect;
const nativeSetOriginalSize = spriteFrameProto.setOriginalSize;
const nativeSetOffset = spriteFrameProto.setOffset;
const nativeSetRotated = spriteFrameProto.setRotated;
const nativeSetInsets = spriteFrameProto.setInsets;

spriteFrameProto._ctor = function () {
    jsb.Asset.prototype._ctor.apply(this, arguments);
    this._texture = null;
    this._rect = new Rect();
    this._originalSize = new Size();
    this._offset = new Vec2();
    this._rotated = false;
    this._capInsets = [0, 0, 0, 0];
    this._atlasUuid = '';
    this._isFlipUVX = false;
    this._isFlipUVY = false;
    this._packable = true;
    this._pixelsToUnit = 100;
    this._pivot = new Vec2(0.5, 0.5);
    this._meshType = 0;
    this.uv = [];
};

Object.defineProperty(spriteFrameProto, 'native', {
    enumerable: true,
    configurable: true,
    get (): any {
        return this;
    },
});

Object.defineProperty(spriteFrameProto, 'texture', {
    enumerable: true,
    configurable: true,
    get (): TextureBase | null {
        return this._texture;
    },
    set (value: TextureBase | null) {
        this._texture = value;
        this._syncTexture();
    },
});

Object.defineProperty(spriteFrameProto, '_textureSource', {
    enumerable: true,
    configurable: true,
    set (value: TextureBase | null) {
        this.texture = value;
    },
});

Object.defineProperty(spriteFrameProto, 'rect', {
    enumerable: true,
    configurable: true,
    get (): Rect {
        return this._rect;
    },
    set (value: Rect) {
        this._rect.set(value);
        this._syncFrameData();
    },
});

Object.defineProperty(spriteFrameProto, 'originalSize', {
    enumerable: true,
    configurable: true,
    get (): Size {
        return this._originalSize;
    },
    set (value: Size) {
        this._originalSize.set(value);
        this._syncFrameData();
    },
});

Object.defineProperty(spriteFrameProto, 'offset', {
    enumerable: true,
    configurable: true,
    get (): Vec2 {
        return this._offset;
    },
    set (value: Vec2) {
        this._offset.set(value);
        this._syncFrameData();
    },
});

Object.defineProperty(spriteFrameProto, 'rotated', {
    enumerable: true,
    configurable: true,
    get (): boolean {
        return this._rotated;
    },
    set (value: boolean) {
        this._rotated = value;
        this._syncFrameData();
    },
});

Object.defineProperty(spriteFrameProto, 'insetLeft', {
    enumerable: true,
    configurable: true,
    get (): number { return this._capInsets[INSET_LEFT]; },
    set (value: number) { this._capInsets[INSET_LEFT] = value; this._syncFrameData(); },
});

Object.defineProperty(spriteFrameProto, 'insetTop', {
    enumerable: true,
    configurable: true,
    get (): number { return this._capInsets[INSET_TOP]; },
    set (value: number) { this._capInsets[INSET_TOP] = value; this._syncFrameData(); },
});

Object.defineProperty(spriteFrameProto, 'insetRight', {
    enumerable: true,
    configurable: true,
    get (): number { return this._capInsets[INSET_RIGHT]; },
    set (value: number) { this._capInsets[INSET_RIGHT] = value; this._syncFrameData(); },
});

Object.defineProperty(spriteFrameProto, 'insetBottom', {
    enumerable: true,
    configurable: true,
    get (): number { return this._capInsets[INSET_BOTTOM]; },
    set (value: number) { this._capInsets[INSET_BOTTOM] = value; this._syncFrameData(); },
});

Object.defineProperty(spriteFrameProto, 'width', {
    enumerable: true,
    configurable: true,
    get (): number { return this._rect.width; },
});

Object.defineProperty(spriteFrameProto, 'height', {
    enumerable: true,
    configurable: true,
    get (): number { return this._rect.height; },
});

Object.defineProperty(spriteFrameProto, 'atlasUuid', {
    enumerable: true,
    configurable: true,
    get (): string { return this._atlasUuid; },
    set (value: string) { this._atlasUuid = value; },
});

Object.defineProperty(spriteFrameProto, 'flipUVX', {
    enumerable: true,
    configurable: true,
    get (): boolean { return this._isFlipUVX; },
    set (value: boolean) { this._isFlipUVX = value; },
});

Object.defineProperty(spriteFrameProto, 'flipUVY', {
    enumerable: true,
    configurable: true,
    get (): boolean { return this._isFlipUVY; },
    set (value: boolean) { this._isFlipUVY = value; },
});

Object.defineProperty(spriteFrameProto, 'packable', {
    enumerable: true,
    configurable: true,
    get (): boolean { return this._packable; },
    set (value: boolean) { this._packable = value; },
});

Object.defineProperty(spriteFrameProto, 'pixelsToUnit', {
    enumerable: true,
    configurable: true,
    get (): number { return this._pixelsToUnit; },
    set (value: number) { this._pixelsToUnit = value; },
});

Object.defineProperty(spriteFrameProto, 'pivot', {
    enumerable: true,
    configurable: true,
    get (): Vec2 { return this._pivot; },
    set (value: Vec2) { this._pivot.set(value); },
});

Object.defineProperty(spriteFrameProto, 'meshType', {
    enumerable: true,
    configurable: true,
    get (): number { return this._meshType; },
    set (value: number) { this._meshType = value; },
});

spriteFrameProto._calculateUV = function (): void {
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
};

spriteFrameProto.textureLoaded = function (): boolean {
    return this._texture !== null;
};

spriteFrameProto.isRotated = function (): boolean {
    return this._rotated;
};

spriteFrameProto.setRotated = function (rotated: boolean): void {
    this.rotated = rotated;
};

spriteFrameProto.getRect = function (out?: Rect): Rect {
    if (out) { out.set(this._rect); return out; }
    return this._rect.clone();
};

spriteFrameProto.setRect = function (rect: Rect): void {
    this.rect = rect;
};

spriteFrameProto.getOriginalSize = function (out?: Size): Size {
    if (out) { out.set(this._originalSize); return out; }
    return this._originalSize.clone();
};

spriteFrameProto.setOriginalSize = function (size: Size): void {
    this.originalSize = size;
};

spriteFrameProto.getOffset = function (out?: Vec2): Vec2 {
    if (out) { out.set(this._offset); return out; }
    return this._offset.clone();
};

spriteFrameProto.setOffset = function (offset: Vec2): void {
    this.offset = offset;
};

spriteFrameProto._calculateSlicedUV = function (): void {
    this._calculateUV();
};

spriteFrameProto.getGFXTexture = function (): any {
    return this._texture ? this._texture.getGFXTexture() : null;
};

spriteFrameProto.getGFXSampler = function (): any {
    return this._texture ? this._texture.getGFXSampler() : null;
};

spriteFrameProto.getHash = function (): number {
    return this._texture ? this._texture.getHash() : 0;
};

spriteFrameProto.getSamplerInfo = function (): any {
    return this._texture ? this._texture.getSamplerInfo() : null;
};

spriteFrameProto.reset = function (info?: any, clearData = false): void {
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
};

spriteFrameProto._serialize = function (): any {
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
};

spriteFrameProto._deserialize = function (data: any, handle: any): void {
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
    if (data.texture && handle?.result) {
        handle.result.push(this, '_textureSource', data.texture, js.getClassId(Texture2D));
    }
    this._syncNative();
};

spriteFrameProto._syncTexture = function (): void {
    nativeSetTexture.call(this, this._texture);
};

spriteFrameProto._syncFrameData = function (): void {
    nativeSetRect.call(this, this._rect.x, this._rect.y, this._rect.width, this._rect.height);
    nativeSetOriginalSize.call(this, this._originalSize.width, this._originalSize.height);
    nativeSetOffset.call(this, this._offset.x, this._offset.y);
    nativeSetRotated.call(this, this._rotated);
    nativeSetInsets.call(
        this,
        this._capInsets[INSET_LEFT],
        this._capInsets[INSET_RIGHT],
        this._capInsets[INSET_TOP],
        this._capInsets[INSET_BOTTOM],
    );
};

spriteFrameProto._syncNative = function (): void {
    this._syncTexture();
    this._syncFrameData();
};

// handle meta data, it is generated automatically
patch_cc_SpriteFrame({ SpriteFrame });
