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

import { cloneFrameVertices, deserializeFrameVertices, flattenFramePositions, serializeFrameVertices } from './sprite-frame-vertices';
import { cclegacy, isValid, js, Rect, Size, Vec2, Vec3, Vec4 } from '../../core';
import '../../asset/assets/asset';
import '../../3d/assets/mesh';
import { TextureBase } from '../../asset/assets/texture-base';
import { Texture2D } from '../../asset/assets/texture-2d';
import { ImageAsset, ImageSource } from '../../asset/assets/image-asset';
import { patch_cc_SpriteFrame } from '../../native-binding/decorators';
import type { SpriteFrame as JsbSpriteFrame, SpriteFrameEvent as JsbSpriteFrameEvent, ISpriteFrameInitInfo } from './sprite-frame';
export type { IUV } from './sprite-frame';

declare const jsb: any;

export type SpriteFrame = JsbSpriteFrame;
export const SpriteFrame: typeof JsbSpriteFrame = jsb.SpriteFrame;
export type SpriteFrameEvent = JsbSpriteFrameEvent;
export const SpriteFrameEvent = { UV_UPDATED: 'uv_updated' as JsbSpriteFrameEvent.UV_UPDATED };
enum MeshType { RECT, POLYGON }
SpriteFrame.MeshType = MeshType as typeof SpriteFrame.MeshType;
SpriteFrame.createWithImage = function (source: ImageSource | ImageAsset): SpriteFrame {
    const texture = new Texture2D();
    texture.image = source instanceof ImageAsset ? source : new ImageAsset(source);
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
};
cclegacy.SpriteFrame = SpriteFrame;
const spriteFrameProto: any = SpriteFrame.prototype;
const nativeSetRect = spriteFrameProto.setRect;
const nativeSetOriginalSize = spriteFrameProto.setOriginalSize;
const nativeSetOffset = spriteFrameProto.setOffset;
const nativeSetRotated = spriteFrameProto.setRotated;

// Math objects remain live, writable API views. No JS copy of frame data is
// authoritative: even native-originated changes are visible through old views.
function nativeProperty (getter: string, setter?: string, uvChanged = false): PropertyDescriptor {
    return {
        enumerable: true,
        configurable: true,
        get () { return this[getter](); },
        ...(setter ? { set (this: any, value: any) { this[setter](value); if (uvChanged) this._calculateUV(); } } : {}),
    };
}

function nativeView<T extends object> (frame: any, view: T, fields: Record<string, string>): T {
    for (const field of Object.keys(fields)) {
        const suffix = fields[field];
        Object.defineProperty(view, field, {
            enumerable: true,
            configurable: true,
            get () { return frame['get' + suffix](); },
            set (value: number) { frame['set' + suffix](value); },
        });
    }
    return view;
}

spriteFrameProto._ctor = function () {
    jsb.Asset.prototype._ctor.apply(this, arguments);
    this.vertices = null;
};

function detachReplacedTexture (frame: any, texture: TextureBase | null): void {
    if (frame.getTexture() === texture) return;
    if (frame.hasDynamicAtlasFrame()) frame.resetDynamicAtlasFrame();
}

function createFrameMesh (frame: any, minPos: Vec3, maxPos: Vec3): void {
    const vertices = frame.vertices;
    frame._mesh = jsb.MeshUtils.createMesh({
        positions: vertices.positions, indices: vertices.indexes, uvs: vertices.nuv,
        minPos, maxPos,
    });
}

function rebuildFrameMesh (frame: any): void {
    const polygon = frame.meshType === MeshType.POLYGON;
    if (!polygon && !frame.texture) throw new TypeError('SpriteFrame mesh requires a texture');
    const vertices = frame.vertices ??= {
        rawPosition: [], positions: [], indexes: [], uv: [], nuv: [], minPos: new Vec3(), maxPos: new Vec3(),
    };
    const raw: number[] = polygon ? flattenFramePositions(vertices.rawPosition) : frame.getMeshRawPositions();
    if (!polygon) {
        vertices.rawPosition.length = 0;
        for (let i = 0; i < raw.length; i += 3) vertices.rawPosition.push(new Vec3(raw[i], raw[i + 1], raw[i + 2]));
        vertices.minPos.set(raw[0] ?? 0, raw[1] ?? 0, 0);
        vertices.maxPos.set(raw[9] ?? 0, raw[10] ?? 0, 0);
        vertices.indexes.splice(0, vertices.indexes.length, 0, 1, 2, 2, 1, 3);
        vertices.uv.splice(0, vertices.uv.length, ...frame.getMeshUVs(false));
        vertices.nuv.splice(0, vertices.nuv.length, ...frame.getMeshUVs(true));
    }
    vertices.positions.length = 0;
    for (const position of frame.transformMeshPositions(raw)) vertices.positions.push(position);
    const bounds = frame.transformMeshPositions(flattenFramePositions([vertices.minPos, vertices.maxPos]));
    frame._mesh?.destroy();
    createFrameMesh(frame, new Vec3(bounds[0], bounds[1], bounds[2]), new Vec3(bounds[3], bounds[4], bounds[5]));
}

spriteFrameProto.ensureMeshData = function (): void {
    if (!isValid(this)) return;
    if (!this._mesh || (this.meshType === MeshType.RECT && this.texture
        && this.getMeshUVs(true).some((uv: number, index: number) => uv !== this.vertices.nuv[index]))) rebuildFrameMesh(this);
};

Object.defineProperties(spriteFrameProto, {
    mesh: { configurable: true, get () { return this._mesh ?? null; } },
    texture: {
        enumerable: true, configurable: true,
        get (): TextureBase | null { return this.getTexture(); },
        set (value: TextureBase | null) {
            if (!isValid(this, true) || !value || this.getTexture() === value) return;
            detachReplacedTexture(this, value);
            this.resetWithTexture(value);
            if (this._mesh) rebuildFrameMesh(this);
            this._calculateUV();
        },
    },
    _textureSource: {
        enumerable: true, configurable: true,
        set (value: TextureBase | null) {
            if (!isValid(this, true)) return;
            detachReplacedTexture(this, value);
            this.loadTexture(value);
            if (this._mesh && value) rebuildFrameMesh(this);
            this._calculateUV();
        },
    },
    rect: {
        enumerable: true, configurable: true,
        get (): Rect { return this._rectView ??= nativeView(this, new Rect(), { x: 'RectX', y: 'RectY', width: 'RectWidth', height: 'RectHeight' }); },
        set (value: Rect) { nativeSetRect.call(this, value.x, value.y, value.width, value.height); this._calculateUV(); },
    },
    originalSize: {
        enumerable: true, configurable: true,
        get (): Size { return this._sizeView ??= nativeView(this, new Size(), { width: 'OriginalWidth', height: 'OriginalHeight' }); },
        set (value: Size) { nativeSetOriginalSize.call(this, value.width, value.height); },
    },
    offset: {
        enumerable: true, configurable: true,
        get (): Vec2 { return this._offsetView ??= nativeView(this, new Vec2(), { x: 'OffsetX', y: 'OffsetY' }); },
        set (value: Vec2) { nativeSetOffset.call(this, value.x, value.y); },
    },
    pivot: {
        enumerable: true, configurable: true,
        get (): Vec2 { return this._pivotView ??= nativeView(this, new Vec2(), { x: 'PivotX', y: 'PivotY' }); },
        set (value: Vec2) { this.setPivotX(value.x); this.setPivotY(value.y); },
    },
    rotated: nativeProperty('isRotated', 'setRotated'),
    insetLeft: nativeProperty('getInsetLeft', 'setInsetLeft', true),
    insetTop: nativeProperty('getInsetTop', 'setInsetTop', true),
    insetRight: nativeProperty('getInsetRight', 'setInsetRight', true),
    insetBottom: nativeProperty('getInsetBottom', 'setInsetBottom', true),
    width: { enumerable: true, configurable: true, get (): number { return this.getTexture()?.width ?? 0; } },
    height: { enumerable: true, configurable: true, get (): number { return this.getTexture()?.height ?? 0; } },
    atlasUuid: nativeProperty('getAtlasUuid', 'setAtlasUuid'),
    flipUVX: nativeProperty('getFlipUVX', 'setFlipUVX', true),
    flipUVY: nativeProperty('getFlipUVY', 'setFlipUVY', true),
    packable: nativeProperty('getPackable', 'setPackable'),
    pixelsToUnit: nativeProperty('getPixelsToUnit', 'setPixelsToUnit'),
    meshType: nativeProperty('getMeshType', 'setMeshType'),
    original: {
        enumerable: true, configurable: true,
        get () {
            return this.hasDynamicAtlasFrame()
                ? { _texture: this.getOriginalTexture(), _x: this.getOriginalX(), _y: this.getOriginalY() } : null;
        },
    },
    uv: nativeProperty('getUV'),
    unbiasUV: nativeProperty('getUV'),
    trimmedBorder: {
        enumerable: true, configurable: true,
        get (): Vec4 {
            const values: number[] = this.getTrimmedBorder();
            return new Vec4(values[0], values[1], values[2], values[3]);
        },
    },
    uvSliced: {
        enumerable: true, configurable: true,
        get (): { u: number; v: number }[] {
            const uv: number[] = this.getSlicedUV();
            return Array.from({ length: uv.length / 2 }, (_, i) => ({ u: uv[i * 2], v: uv[i * 2 + 1] }));
        },
    },
});

SpriteFrame.EVENT_UV_UPDATED = SpriteFrameEvent.UV_UPDATED;
spriteFrameProto._setDynamicAtlasFrame = function (frame): void {
    if (!frame || !isValid(this, true)) return;
    this.setDynamicAtlasFrame(frame.texture, frame.x, frame.y);
    this._calculateUV();
};
spriteFrameProto._resetDynamicAtlasFrame = function (): void {
    if (!this.hasDynamicAtlasFrame()) return;
    this.resetDynamicAtlasFrame();
    this._calculateUV();
};
spriteFrameProto._calculateUV = function (): void {
    if (this.getTexture()) this.emit(SpriteFrame.EVENT_UV_UPDATED, this);
};
spriteFrameProto._calculateSlicedUV = spriteFrameProto._calculateUV;
spriteFrameProto.textureLoaded = function (): boolean { return this.getTexture() !== null; };
spriteFrameProto.setRotated = function (value: boolean): void { nativeSetRotated.call(this, value); this._calculateUV(); };
spriteFrameProto.getRect = function (out = new Rect()): Rect { return out.set(this.rect); };
spriteFrameProto.setRect = function (rect: Rect): void { this.rect = rect; };
spriteFrameProto.getOriginalSize = function (out = new Size()): Size { return out.set(this.originalSize); };
spriteFrameProto.setOriginalSize = function (size: Size): void { this.originalSize = size; };
spriteFrameProto.getOffset = function (out = new Vec2()): Vec2 { return out.set(this.offset); };
spriteFrameProto.setOffset = function (offset: Vec2): void { this.offset = offset; };
spriteFrameProto.getGFXTexture = function (): any { return this.getTexture()?.getGFXTexture() ?? null; };
spriteFrameProto.getGFXSampler = function (): any { return this.getTexture()?.getGFXSampler() ?? null; };
spriteFrameProto.getHash = function (): number { return this.getTexture()?.getHash() ?? 0; };
spriteFrameProto.getSamplerInfo = function (): any { return this.getTexture()?.getSamplerInfo() ?? null; };

spriteFrameProto.reset = function (info?: ISpriteFrameInitInfo, clearData = false): void {
    if (!isValid(this, true)) return;
    if (info?.texture) detachReplacedTexture(this, info.texture);
    this.resetFrame(clearData);
    if (info) {
        if (info.texture) this.resetTexture(info.texture);
        if (info.rect) nativeSetRect.call(this, info.rect.x, info.rect.y, info.rect.width, info.rect.height);
        if (info.originalSize) nativeSetOriginalSize.call(this, info.originalSize.width, info.originalSize.height);
        if (info.offset) nativeSetOffset.call(this, info.offset.x, info.offset.y);
        if (info.borderLeft !== undefined) this.setInsetLeft(info.borderLeft);
        if (info.borderRight !== undefined) this.setInsetRight(info.borderRight);
        if (info.borderTop !== undefined) this.setInsetTop(info.borderTop);
        if (info.borderBottom !== undefined) this.setInsetBottom(info.borderBottom);
        if (info.isRotate !== undefined) nativeSetRotated.call(this, !!info.isRotate);
        if (info.isFlipUv !== undefined) this.setFlipUVY(!!info.isFlipUv);
    }
    if (this._mesh && this.texture && (clearData || info?.rect || info?.texture)) rebuildFrameMesh(this);
    this._calculateUV();
};

const onPreDestroy = spriteFrameProto._onPreDestroy;
spriteFrameProto._onPreDestroy = function (): void {
    this.clearTextureReferences();
    this._mesh?.destroy();
    this._mesh = null;
    onPreDestroy?.call(this);
};

spriteFrameProto.clone = function (): SpriteFrame {
    const frame = new SpriteFrame();
    (frame as any).copyFrom(this);
    frame.vertices = cloneFrameVertices(this.vertices);
    if (this._mesh) createFrameMesh(frame, this._mesh.getMinPosition(), this._mesh.getMaxPosition());
    return frame;
};

spriteFrameProto._serialize = function (ctxForExporting?: any): any {
    const rect = this.rect;
    const offset = this.offset;
    const size = this.originalSize;
    const texture = this.texture?._uuid;
    if (texture && ctxForExporting) ctxForExporting.dependsOn('_textureSource', texture);
    return {
        name: this._name,
        atlas: ctxForExporting ? undefined : this.atlasUuid,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        offset: { x: offset.x, y: offset.y },
        originalSize: { width: size.width, height: size.height },
        rotated: this.rotated,
        capInsets: [this.insetLeft, this.insetTop, this.insetRight, this.insetBottom],
        texture: ctxForExporting ? undefined : texture,
        packable: this.packable,
        pixelsToUnit: this.pixelsToUnit,
        pivot: { x: this.pivot.x, y: this.pivot.y },
        meshType: this.meshType,
        vertices: serializeFrameVertices(this.vertices),
    };
};

spriteFrameProto._deserialize = function (data: any, handle: any): void {
    if (!isValid(this, true)) return;
    this._name = data.name ?? '';
    this.resetFrame(true);
    if (data.rect) nativeSetRect.call(this, data.rect.x, data.rect.y, data.rect.width, data.rect.height);
    if (data.offset) nativeSetOffset.call(this, data.offset.x, data.offset.y);
    if (data.originalSize) nativeSetOriginalSize.call(this, data.originalSize.width, data.originalSize.height);
    this.rotated = !!data.rotated;
    this.atlasUuid = data.atlas ?? '';
    this.packable = data.packable ?? true;
    this.pixelsToUnit = data.pixelsToUnit ?? 100;
    this.meshType = data.meshType ?? 0;
    this.pivot = data.pivot ?? new Vec2(0.5, 0.5);
    this._mesh?.destroy();
    this._mesh = null;
    this.vertices = data.vertices ? deserializeFrameVertices(data.vertices, this.vertices) : null;
    if (this.vertices) this.vertices.positions = this.transformMeshPositions(data.vertices.rawPosition);
    if (data.capInsets) this.setInsets(data.capInsets[0], data.capInsets[2], data.capInsets[1], data.capInsets[3]);
    if (data.texture && handle?.result) {
        handle.result.push(this, '_textureSource', data.texture, js.getClassId(Texture2D));
    }
};

patch_cc_SpriteFrame({ SpriteFrame });
