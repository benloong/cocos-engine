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
import { cclegacy, path, warnID } from '../../core';
import './font';
import { patch_cc_TTFFont } from '../../native-binding/decorators';
import type { TTFFont as JsbTTFFont } from './ttf-font';
declare const jsb: any;
export type TTFFont = JsbTTFFont;
export const TTFFont: typeof JsbTTFFont = jsb.TTFFont;
cclegacy.TTFFont = TTFFont;
const proto: any = TTFFont.prototype;
proto._ctor = function () { jsb.Font.prototype._ctor.apply(this, arguments); };
Object.defineProperties(proto, {
    _fontFamily: { configurable: true, enumerable: true,
        get (): string | null { return this.getFontFamily() || null; },
        set (value: string | null) { this.setFontFamily(value ?? ''); } },
    _nativeAsset: { configurable: true,
        get (): string | null { return this._fontFamily; },
        set (value: string | null) { this.setFontFamily(value || 'Arial'); this.onLoaded(); } },
    _nativeDep: { configurable: true,
        get () { return { uuid: this._uuid, __nativeName__: this._native, ext: path.extname(this._native ?? ''), __isNative__: true }; } },
});
proto.onLoaded = function () {
    const source = this.nativeUrl;
    if (source && (this.getSourcePath() !== source || !this.getFontDataSize()) && !this.loadFontData(source)) warnID(4933, source);
};
patch_cc_TTFFont({ TTFFont });
