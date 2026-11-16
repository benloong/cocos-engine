/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
*/

import { cclegacy, js } from '../../core';
import '../../asset/assets/asset';
import { patch_cc_SpriteAtlas } from '../../native-binding/decorators';
import type { SpriteFrame } from './sprite-frame';
import type { SpriteAtlas as JsbSpriteAtlas } from './sprite-atlas';
import type { TextureBase } from '../../asset/assets/texture-base';

declare const jsb: any;
type FrameMap = Record<string, SpriteFrame | null>;

export type SpriteAtlas = JsbSpriteAtlas;
export const SpriteAtlas: typeof JsbSpriteAtlas = jsb.SpriteAtlas;
cclegacy.SpriteAtlas = SpriteAtlas;

const spriteAtlasProto: any = SpriteAtlas.prototype;
const nativeAddSpriteFrame = spriteAtlasProto.addSpriteFrame;
const nativeRemoveSpriteFrame = spriteAtlasProto.removeSpriteFrame;
const nativeGetSpriteFrame = spriteAtlasProto.getSpriteFrame;
const nativeGetTexture = spriteAtlasProto.getTexture;

function checkFrame (frame: SpriteFrame | null): void {
    if (frame !== null && !(frame instanceof jsb.SpriteFrame)) {
        throw new TypeError('SpriteAtlas.spriteFrames values must be native SpriteFrame assets or null');
    }
}

// Dependency resolution assigns map[key] after _deserialize returns. Observe
// that exact write path, as well as user assignments/deletes/defineProperty.
function createFrameMap (atlas: any, source: FrameMap): FrameMap {
    const target: FrameMap = Object.assign(js.createMap(), source);
    let proxy: FrameMap;
    function mutate (key: PropertyKey, value: SpriteFrame | null, operation: () => boolean, remove = false): boolean {
        // Detached dependency maps are ordinary dictionaries, with no authority
        // over the atlas that replaced them.
        if (atlas._spriteFrames !== proxy || typeof key !== 'string') return operation();
        const before = Object.getOwnPropertyDescriptor(target, key);
        if (!remove) checkFrame(value);
        // Convert/retain the native argument before publishing a potentially
        // non-configurable JS property. Conversion failure leaves JS untouched.
        if (remove) nativeRemoveSpriteFrame.call(atlas, key);
        else nativeAddSpriteFrame.call(atlas, key, value ?? null);
        function restoreNative (): void {
            if (before) nativeAddSpriteFrame.call(atlas, key, before.value ?? null);
            else nativeRemoveSpriteFrame.call(atlas, key);
            atlas.setSpriteFrameOrder(Object.keys(target));
        }
        let success: boolean;
        try { success = operation(); } catch (error) { restoreNative(); throw error; }
        if (!success) { restoreNative(); return false; }
        const after = Object.getOwnPropertyDescriptor(target, key);
        if (!before || !after || before.enumerable !== after.enumerable) atlas.setSpriteFrameOrder(Object.keys(target));
        return true;
    }
    proxy = new Proxy(target, {
        set: (_, key, value) => mutate(key, value, () => Reflect.set(target, key, value, target)),
        deleteProperty: (_, key) => mutate(key, null, () => Reflect.deleteProperty(target, key), true),
        defineProperty: (_, key, descriptor) => {
            if ('get' in descriptor || 'set' in descriptor) {
                throw new TypeError('SpriteAtlas.spriteFrames entries must be data properties');
            }
            return mutate(key, 'value' in descriptor ? descriptor.value : Reflect.get(target, key), () => Reflect.defineProperty(target, key, descriptor));
        },
        setPrototypeOf: (_, prototype) => prototype === null,
    });
    return proxy;
}

Object.defineProperty(spriteAtlasProto, 'spriteFrames', {
    enumerable: true,
    configurable: true,
    get (): FrameMap {
        if (!this._spriteFrames) {
            // Also support assets created in C++ and subsequently exposed to JS.
            const frames: FrameMap = js.createMap();
            for (const name of this.getSpriteFrameNames()) frames[name] = nativeGetSpriteFrame.call(this, name);
            this._spriteFrames = createFrameMap(this, frames);
            this.setSpriteFrameOrder(Object.keys(frames));
        }
        return this._spriteFrames;
    },
    set (value: FrameMap) {
        const frames = createFrameMap(this, value);
        const names = Object.keys(frames);
        const values = names.map(name => frames[name]);
        values.forEach(checkFrame);
        this.setSpriteFrames(names, values);
        this._spriteFrames = frames;
    },
});

spriteAtlasProto._ctor = function () {
    jsb.Asset.prototype._ctor.apply(this, arguments);
};

spriteAtlasProto.addSpriteFrame = function (name: string, frame: SpriteFrame | null): void {
    this.spriteFrames[String(name ?? '')] = frame;
};
spriteAtlasProto.getSpriteFrame = function (key: string): SpriteFrame | null {
    const frame = this.spriteFrames[key] ?? null;
    if (frame && !frame.name) frame.name = key;
    return frame;
};
spriteAtlasProto.getSpriteFrames = function (): (SpriteFrame | null)[] {
    return Object.values(this.spriteFrames);
};
spriteAtlasProto.getTexture = function (): TextureBase | null {
    // Materialize native-created maps too, normalizing JS integer-key order.
    this.spriteFrames;
    return nativeGetTexture.call(this);
};
// getSpriteFrameCount reads the synchronized native table directly.
spriteAtlasProto.removeSpriteFrame = function (name: string): void {
    delete this.spriteFrames[name];
};
spriteAtlasProto.clear = function (): void {
    this.spriteFrames = js.createMap();
};

spriteAtlasProto._serialize = function (ctxForExporting?: any): any {
    const frames: string[] = [];
    for (const name of Object.keys(this.spriteFrames)) {
        let uuid = this.spriteFrames[name]?._uuid ?? '';
        if (ctxForExporting) {
            if (uuid && ctxForExporting._compressUuid) uuid = EditorExtends.UuidUtils.compressUuid(uuid, true);
            if (uuid) ctxForExporting.dependsOn('_textureSource', uuid);
        }
        frames.push(name, uuid);
    }
    return { name: this._name, spriteFrames: frames };
};
spriteAtlasProto._deserialize = function (data: { name?: string; spriteFrames?: string[] }, handle: any): void {
    this._name = data.name ?? '';
    const frames = data.spriteFrames ?? [];
    const pending: FrameMap = js.createMap();
    // Reserve every name before dependencies finish, so asynchronous completion
    // cannot reorder getTexture/getSpriteFrames relative to the serialized map.
    for (let i = 0; i < frames.length; i += 2) pending[frames[i]] = null;
    this.spriteFrames = pending;
    for (let i = 0; i < frames.length; i += 2) {
        if (frames[i + 1]) handle.result.push(this.spriteFrames, frames[i], frames[i + 1], 'cc.SpriteFrame');
    }
};

patch_cc_SpriteAtlas({ SpriteAtlas });
