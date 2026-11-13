/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
*/

import { cclegacy } from '../../core';
import './asset';
import type { SpriteAtlas as JsbSpriteAtlas } from './sprite-atlas';
import type { SpriteFrame } from './sprite-frame';
import type { TextureBase } from '../../asset/assets/texture-base';

declare const jsb: any;

export type SpriteAtlas = JsbSpriteAtlas;
export const SpriteAtlas: typeof JsbSpriteAtlas = jsb.SpriteAtlas;

cclegacy.SpriteAtlas = SpriteAtlas;

const atlasProto: any = SpriteAtlas.prototype;

atlasProto._ctor = function (name?: string): void {
    jsb.Asset.prototype._ctor.apply(this, arguments);
    this.spriteFrames = {};
    this._name = name ?? '';
};

atlasProto.addSpriteFrame = function (name: string, frame: SpriteFrame | null): void {
    this.spriteFrames[name] = frame;
    const nativeFrame = (frame as any)?.native ?? null;
    if (nativeFrame) {
        jsb.SpriteAtlas.prototype.addSpriteFrame.call(this, String(name), nativeFrame);
    }
};

atlasProto.removeSpriteFrame = function (name: string): void {
    delete this.spriteFrames[name];
    jsb.SpriteAtlas.prototype.removeSpriteFrame.call(this, String(name));
};

atlasProto.clear = function (): void {
    this.spriteFrames = {};
    jsb.SpriteAtlas.prototype.clear.call(this);
};

atlasProto.getSpriteFrame = function (key: string): SpriteFrame | null {
    const frame = this.spriteFrames[key] ?? null;
    if (frame && !frame.name) {
        frame.name = key;
    }
    return frame;
};

atlasProto.getSpriteFrames = function (): (SpriteFrame | null)[] {
    return Object.values(this.spriteFrames);
};

atlasProto.getTexture = function (): TextureBase | null {
    for (const key of Object.keys(this.spriteFrames)) {
        const frame = this.spriteFrames[key];
        if (frame) {
            return frame.texture;
        }
    }
    return null;
};

atlasProto._deserialize = function (serializeData: any, handle: any): void {
    const data = serializeData as { name?: string; spriteFrames?: string[] };
    this._name = data.name ?? '';
    this.spriteFrames = {};
    const frames = data.spriteFrames ?? [];
    for (let i = 0; i < frames.length; i += 2) {
        handle.result.push(this.spriteFrames, frames[i], frames[i + 1], 'cc.SpriteFrame');
    }
};
