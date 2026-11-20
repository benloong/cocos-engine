/*
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

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
import { cclegacy, js } from '../../core';
import './font';
import { SpriteFrame } from './sprite-frame';
import { patch_cc_BitmapFont } from '../../native-binding/decorators';
import type { TextureBase } from '../../asset/assets/texture-base';
import type { BitmapFont as JsbBitmapFont, IConfig } from './bitmap-font';
export type { IConfig } from './bitmap-font';
declare const jsb: any;

// Deprecated JS compatibility views only; native owns the render-time glyphs,
// frame and texture references. These helpers never destroy a shared texture.
export class FontLetterDefinition {
    public u = 0; public v = 0; public w = 0; public h = 0;
    public offsetX = 0; public offsetY = 0; public valid = false; public xAdvance = 0;
}
export interface ILetterDefinition { [key: string]: FontLetterDefinition; }
export class FontAtlas {
    public letterDefinitions: ILetterDefinition = js.createMap();
    constructor (public texture: TextureBase | null) {}
    get _texture (): TextureBase | null { return this.texture; }
    set _texture (value: TextureBase | null) { this.texture = value; }
    public getTexture (): TextureBase | null { return this.texture; }
    public addLetterDefinitions (key: string, value: FontLetterDefinition): void { this.letterDefinitions[key] = value; }
    public getLetter (key: string): FontLetterDefinition { return this.letterDefinitions[key]; }
    public getLetterDefinitionForChar (char: string, _labelInfo?: any): FontLetterDefinition | null {
        return this.letterDefinitions[char.codePointAt(0) ?? 0] ?? null;
    }
    public clear (): void { this.letterDefinitions = js.createMap(); }
    public cloneLetterDefinition (): ILetterDefinition {
        const copy: ILetterDefinition = js.createMap();
        for (const key of Object.keys(this.letterDefinitions)) copy[key] = Object.assign(new FontLetterDefinition(), this.letterDefinitions[key]);
        return copy;
    }
}
export type BitmapFont = JsbBitmapFont;
export const BitmapFont: typeof JsbBitmapFont = jsb.BitmapFont;
BitmapFont.EVENT_CONFIG_RELOAD = 'bitmap_font_config_reload';
cclegacy.BitmapFont = BitmapFont;
const proto: any = BitmapFont.prototype;
proto._ctor = function () { jsb.Font.prototype._ctor.apply(this, arguments); };
Object.defineProperties(proto, {
    spriteFrame: { configurable: true, enumerable: true,
        get (): SpriteFrame | null { return this.getSpriteFrame(); },
        set (value: SpriteFrame | null) { this.setSpriteFrame(value); } },
    fontSize: { configurable: true, enumerable: true,
        get (): number { return this.getFontSize(); }, set (value: number) { this.setFontSize(value); } },
    fntDataStr: { configurable: true, enumerable: true,
        get (): string { return this.getFntDataStr(); }, set (value: string) { this.setFntDataStr(value); } },
    fntConfig: { configurable: true, enumerable: true,
        get (): IConfig | null {
            const revision = this.getConfigRevision();
            if (revision !== this._configRevision) {
                this._configView = JSON.parse(this.getConfigJson()); this._configRevision = revision;
            }
            return this._configView;
        },
        set (value: IConfig | null) {
            if (this.isReleased()) return;
            if (!this.setConfigJson(JSON.stringify(value ?? null))) throw new TypeError('Invalid BitmapFont configuration');
            this._configView = value ?? null;
            this._configRevision = this.getConfigRevision();
        } },
    fontDefDictionary: { configurable: true,
        get (): FontAtlas {
            const revision = this.getRevision();
            const texture = this.spriteFrame?.texture ?? null;
            if (!this._atlasView || this._atlasRevision !== revision || this._atlasView.texture !== texture) {
                const atlas = new FontAtlas(texture);
                const data: number[] = this.getGlyphData();
                for (let i = 0; i < data.length; i += 8) {
                    atlas.letterDefinitions[data[i]] = Object.assign(new FontLetterDefinition(), {
                        u: data[i + 1], v: data[i + 2], w: data[i + 3], h: data[i + 4],
                        offsetX: data[i + 5], offsetY: data[i + 6], xAdvance: data[i + 7], valid: true,
                    });
                }
                this._atlasView = atlas; this._atlasRevision = revision;
            }
            return this._atlasView;
        } },
});
proto.onLoaded = function () {
    if (this.isReleased()) return;
    // Web callers may edit fntConfig then explicitly reload it. Commit that
    // serialization view once, never once per Label or once per glyph.
    if (this._configRevision === this.getConfigRevision()) this.fntConfig = this._configView;
    this._atlasView = undefined;
    this.emit(BitmapFont.EVENT_CONFIG_RELOAD);
};
patch_cc_BitmapFont({ BitmapFont, SpriteFrame });

// Drop compatibility views on explicit release as well as native storage.
for (const name of ['_destroy', 'clearNativeData']) {
    const nativeMethod = proto[name];
    proto[name] = function (...args: any[]) {
        const result = nativeMethod.apply(this, args);
        this._atlasView = undefined;
        this._configRevision = undefined;
        this._configView = undefined;
        return result;
    };
}
