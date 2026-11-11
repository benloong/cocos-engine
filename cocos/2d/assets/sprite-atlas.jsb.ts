/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
*/

import { ccclass, editable, serializable } from 'cc.decorator';
import { Asset } from '../../asset/assets';
import { SpriteFrame } from './sprite-frame';
import type { TextureBase } from '../../asset/assets/texture-base';

declare const n2d: any;

interface ISpriteFrameList {
    [key: string]: SpriteFrame | null;
}

/**
 * Native SpriteAtlas thin shell. The serialized map stays in JS; named frames
 * are also registered with the native asset for ownership/texture access.
 */
@ccclass('cc.SpriteAtlas')
export class SpriteAtlas extends Asset {
    @serializable
    @editable
    public spriteFrames: ISpriteFrameList = {};

    private _native: any = null;

    constructor (name?: string) {
        super(name);
        this._native = new n2d.SpriteAtlas();
    }

    public addSpriteFrame (name: string, frame: SpriteFrame | null): void {
        this.spriteFrames[name] = frame;
        this._native?.addSpriteFrame(name, (frame as any)?.native ?? null);
    }

    public getSpriteFrame (key: string): SpriteFrame | null {
        const frame = this.spriteFrames[key] ?? null;
        if (frame && !frame.name) {
            frame.name = key;
        }
        return frame;
    }

    public getSpriteFrames (): (SpriteFrame | null)[] {
        return Object.values(this.spriteFrames);
    }

    public getTexture (): TextureBase | null {
        for (const key of Object.keys(this.spriteFrames)) {
            const frame = this.spriteFrames[key];
            if (frame) {
                return frame.texture;
            }
        }
        return null;
    }

    public removeSpriteFrame (name: string): void {
        delete this.spriteFrames[name];
        this._native?.removeSpriteFrame(name);
    }

    public clear (): void {
        this.spriteFrames = {};
        this._native?.clear();
    }

    public _deserialize (serializeData: any, handle: any): void {
        const data = serializeData as { name?: string; spriteFrames?: string[] };
        this._name = data.name ?? '';
        this.spriteFrames = {};
        const frames = data.spriteFrames ?? [];
        for (let i = 0; i < frames.length; i += 2) {
            handle.result.push(this.spriteFrames, frames[i], frames[i + 1], 'cc.SpriteFrame');
        }
    }
}
