/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
*/

import { cclegacy } from '../../core';
import '../../asset/assets/asset';
import { patch_cc_SpriteAtlas } from '../../native-binding/decorators';
import type { SpriteFrame } from './sprite-frame';
import type { SpriteAtlas as JsbSpriteAtlas } from './sprite-atlas';
import type { TextureBase } from '../../asset/assets/texture-base';

declare const jsb: any;

export type SpriteAtlas = JsbSpriteAtlas;
export const SpriteAtlas: typeof JsbSpriteAtlas = jsb.SpriteAtlas;

cclegacy.SpriteAtlas = SpriteAtlas;

const spriteAtlasProto: any = SpriteAtlas.prototype;
// Preserve native methods before installing the JS asset API on the same prototype.
const nativeAddSpriteFrame = spriteAtlasProto.addSpriteFrame;
const nativeRemoveSpriteFrame = spriteAtlasProto.removeSpriteFrame;
const nativeClear = spriteAtlasProto.clear;

spriteAtlasProto._ctor = function () {
    jsb.Asset.prototype._ctor.apply(this, arguments);
    this.spriteFrames = {};
};

spriteAtlasProto.addSpriteFrame = function (name: string, frame: SpriteFrame | null): void {
    this.spriteFrames[name] = frame;
    if (frame) {
        nativeAddSpriteFrame.call(this, String(name ?? ''), frame);
    }
};

spriteAtlasProto.getSpriteFrame = function (key: string): SpriteFrame | null {
    const frame = this.spriteFrames[key] ?? null;
    if (frame && !frame.name) {
        frame.name = key;
    }
    return frame;
};

spriteAtlasProto.getSpriteFrames = function (): (SpriteFrame | null)[] {
    return Object.values(this.spriteFrames);
};

spriteAtlasProto.getTexture = function (): TextureBase | null {
    for (const key of Object.keys(this.spriteFrames)) {
        const frame = this.spriteFrames[key];
        if (frame) {
            return frame.texture;
        }
    }
    return null;
};

spriteAtlasProto.removeSpriteFrame = function (name: string): void {
    delete this.spriteFrames[name];
    nativeRemoveSpriteFrame.call(this, name);
};

spriteAtlasProto.clear = function (): void {
    this.spriteFrames = {};
    nativeClear.call(this);
};

spriteAtlasProto._deserialize = function (serializeData: any, handle: any): void {
    const data = serializeData as { name?: string; spriteFrames?: string[] };
    this._name = data.name ?? '';
    this.spriteFrames = {};
    const frames = data.spriteFrames ?? [];
    for (let i = 0; i < frames.length; i += 2) {
        handle.result.push(this.spriteFrames, frames[i], frames[i + 1], 'cc.SpriteFrame');
    }
};

// handle meta data, it is generated automatically
patch_cc_SpriteAtlas({ SpriteAtlas });
