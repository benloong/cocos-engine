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

import { ccclass, type, serializable, editable } from 'cc.decorator';
import { Font } from './font';
import { SpriteFrame } from './sprite-frame';
import { cclegacy, js, warnID } from '../../core';
import { getSymbolCodeAt } from '../utils';
import { IShareLabelInfo } from '../assembler/label/font-utils';
import { TextureBase } from '../../asset/assets/texture-base';

export interface IConfig {
    [key: string]: any;
}

export class FontLetterDefinition {
    public u = 0;
    public v = 0;
    public w = 0;
    public h = 0;
    public offsetX = 0;
    public offsetY = 0;
    public valid = false;
    public xAdvance = 0;
}

export interface ILetterDefinition {
    [key: string]: FontLetterDefinition;
}

function releaseAtlasTexture (atlas: FontAtlas, releaseImportedAsset = false): void {
    const texture = atlas._texture;
    atlas._texture = null;
    if (!texture) return;
    const autoRelease = releaseImportedAsset && !!texture.uuid;
    texture.decRef(autoRelease);
    if (!autoRelease && texture.refCount <= 0) texture.destroy();
}

export class FontAtlas {
    public letterDefinitions: ILetterDefinition = {};
    public _texture: TextureBase | null = null;

    constructor (texture: TextureBase | null) {
        this.texture = texture;
    }

    public set texture (texture: TextureBase | null) {
        if (this._texture === texture) return;
        releaseAtlasTexture(this);
        if (texture) {
            texture.addRef();
        }
        this._texture = texture;
    }

    public get texture (): TextureBase | null {
        return this._texture;
    }

    public addLetterDefinitions (letter: string, letterDefinition: FontLetterDefinition): void {
        this.letterDefinitions[letter] = letterDefinition;
    }

    public cloneLetterDefinition (): ILetterDefinition {
        const copyLetterDefinitions: ILetterDefinition = {};
        for (const key in this.letterDefinitions) {
            const value = new FontLetterDefinition();
            js.mixin(value, this.letterDefinitions[key]);
            copyLetterDefinitions[key] = value;
        }
        return copyLetterDefinitions;
    }

    public getTexture (): TextureBase | null {
        return this._texture;
    }

    public getLetter (key: string): FontLetterDefinition {
        return this.letterDefinitions[key];
    }

    public getLetterDefinitionForChar (char: string, labelInfo?: IShareLabelInfo): FontLetterDefinition | null {
        const key = getSymbolCodeAt(char, 0);
        const hasKey = Object.prototype.hasOwnProperty.call(this.letterDefinitions, key);
        let letter: FontLetterDefinition | null = null;
        if (hasKey) {
            letter = this.letterDefinitions[key];
        } else if (char.length === 2 && char.codePointAt(0)! > 0xffff) {
            // BMFont files store supplementary characters by Unicode scalar value.
            letter = this.letterDefinitions[char.codePointAt(0)!] ?? null;
        }
        return letter;
    }

    public clear (): void {
        this.letterDefinitions = {};
    }
}

/**
 * @en Class for BitmapFont handling.
 * @zh 位图字体资源类。
 */
@ccclass('cc.BitmapFont')
export class BitmapFont extends Font {
    /** @engineInternal */
    public static EVENT_CONFIG_RELOAD = 'bitmap_font_config_reload';

    /**
     * @deprecated since v3.7.0, Useless Code.
     */
    @serializable
    @editable
    public fntDataStr = '';

    /**
     * @en [[SpriteFrame]] of the bitmap font.
     * @zh 位图字体所使用的精灵。
     */
    @type(SpriteFrame)
    public spriteFrame: SpriteFrame | null = null;

    /**
     * @en The font size.
     * @zh 文字尺寸。
     */
    @serializable
    @editable
    public fontSize = -1;

    /**
     * @en Font configuration.
     * @zh 字体配置。
     */
    @serializable
    @editable
    public fntConfig: IConfig | null = null;

    /**
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    public declare fontDefDictionary: FontAtlas;
    private _ownedFontAtlas: FontAtlas | null = null;
    private _borrowedDefinitions: { atlas: FontAtlas; glyphs: ILetterDefinition } | null = null;

    constructor () {
        super();
    }

    onLoaded (): void {
        const spriteFrame = this.spriteFrame;
        if (!this.fontDefDictionary && spriteFrame) {
            this.fontDefDictionary = this._ownedFontAtlas = new FontAtlas(spriteFrame.texture);
        }

        const previous = this._borrowedDefinitions;
        if (previous) {
            for (const key in previous.glyphs) {
                if (previous.atlas.getLetter(key) === previous.glyphs[key]) delete previous.atlas.letterDefinitions[key];
            }
        }

        const atlas = this.fontDefDictionary;
        if (atlas && atlas === this._ownedFontAtlas) atlas.clear();
        this._borrowedDefinitions = atlas && atlas !== this._ownedFontAtlas ? { atlas, glyphs: js.createMap() } : null;
        const fntConfig = this.fntConfig;
        if (!fntConfig) warnID(16376);
        else if (atlas) {
            const fontDict = fntConfig.fontDefDictionary;
            for (const fontDef in fontDict) {
                const info = fontDict[fontDef];
                const letter = new FontLetterDefinition();
                const rect = info.rect;
                letter.offsetX = info.xOffset;
                letter.offsetY = info.yOffset;
                letter.w = rect.width;
                letter.h = rect.height;
                letter.u = rect.x;
                letter.v = rect.y;
                letter.valid = true;
                letter.xAdvance = info.xAdvance;
                atlas.addLetterDefinitions(fontDef, letter);
                if (this._borrowedDefinitions) this._borrowedDefinitions.glyphs[fontDef] = letter;
            }
        }
        this.emit(BitmapFont.EVENT_CONFIG_RELOAD);
    }

    protected _onPreDestroy (): void {
        // The frame's dependency release may have already skipped a texture held by this atlas.
        if (this._ownedFontAtlas) releaseAtlasTexture(this._ownedFontAtlas, true);
    }
}

cclegacy.BitmapFont = BitmapFont;
