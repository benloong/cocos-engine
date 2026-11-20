/*
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

import { warnID } from '../../core';
import { JSB } from 'internal:constants';
import { buildFontDesc, quoteFontFamily } from './font-family';
import downloader from '../../asset/asset-manager/downloader';
import factory from '../../asset/asset-manager/factory';
import { TTFFont } from '../assets/ttf-font';
import { ccwindow } from '../../core/global-exports';

const ccdocument = ccwindow.document;

type FontCallback = (err: Error | null, family?: string) => void;
export interface BrowserFontLease {
    readonly family: string;
    release (): void;
}
export interface BrowserFont {
    readonly name: string;
    readonly family: string;
    retain (): BrowserFontLease;
}
type FontData = string | BrowserFont;
type FontDataCallback = (err: Error | null, data?: FontData) => void;

// The native DOM declarations omit the browser's CSS Font Loading API.
interface LoadableFontFace {
    load (): Promise<LoadableFontFace>;
}

interface IFontLoadHandle {
    fontDesc: string;
    refWidth: number;
    onComplete: (loaded: boolean) => void;
    startTime: number;
}

let _canvasContext: CanvasRenderingContext2D | null = null;
let _intervalId = -1;
// letter symbol number CJK
const _testString = 'BES bswy:->@123\u4E01\u3041\u1101';

const _pendingFaces = new Map<string, FontDataCallback[]>();
const _fontFaces = new Map<string, BrowserFont>();
let browserFamilySerial = 0;

const _loadingFonts: IFontLoadHandle[] = [];
// 3 seconds timeout
const _timeout = 3000;

// Refer to https://github.com/typekit/webfontloader/blob/master/src/core/fontwatcher.js
const useNativeCheck = ((): () => boolean => {
    let nativeCheck: boolean;
    return (): boolean => {
        if (nativeCheck === undefined) {
            if ('FontFace' in ccwindow) {
                const match = /Gecko.*Firefox\/(\d+)/.exec(ccwindow.navigator.userAgent);
                const safari10Match = /OS X.*Version\/10\..*Safari/.exec(ccwindow.navigator.userAgent) && /Apple/.exec(ccwindow.navigator.vendor);

                if (match) {
                    nativeCheck = parseInt(match[1], 10) > 42;
                } else if (safari10Match) {
                    nativeCheck = false;
                } else {
                    nativeCheck = true;
                }
            } else {
                nativeCheck = false;
            }
        }

        return nativeCheck;
    };
})();

function checkFontLoaded (): void {
    const now = Date.now();

    for (let i = _loadingFonts.length - 1; i >= 0; i--) {
        const fontLoadHandle = _loadingFonts[i];
        // load timeout
        if (now - fontLoadHandle.startTime > _timeout) {
            _loadingFonts.splice(i, 1);
            fontLoadHandle.onComplete(false);
            continue;
        }

        const oldWidth = fontLoadHandle.refWidth;
        _canvasContext!.font = fontLoadHandle.fontDesc;
        // Font availability changes while loading; do not cache fallback-font metrics.
        const newWidth = _canvasContext!.measureText(_testString).width;
        // loaded successfully
        if (oldWidth !== newWidth) {
            _loadingFonts.splice(i, 1);
            fontLoadHandle.onComplete(true);
        }
    }

    if (!_loadingFonts.length) {
        clearInterval(_intervalId);
        _intervalId = -1;
    }
}

function registerFontFace (
    key: string, name: string, family: string, attach: () => void, detach: () => void, discard?: () => void,
): void {
    if (_fontFaces.has(key)) {
        discard?.();
        return;
    }
    let owners = 0;
    const font: BrowserFont = {
        name,
        family,
        retain (): BrowserFontLease {
            const active = _fontFaces.get(key);
            if (active && active !== font) return active.retain();
            if (!active) {
                // A preloaded asset may still hold these bytes after the previous owner released the face.
                attach();
                _fontFaces.set(key, font);
            }
            ++owners;
            let released = false;
            return {
                family,
                release (): void {
                    if (released) return;
                    released = true;
                    if (--owners === 0) {
                        _fontFaces.delete(key);
                        detach();
                    }
                },
            };
        },
    };
    attach();
    _fontFaces.set(key, font);
}

export function loadFont (url: string, options: Record<string, any>, onComplete: FontCallback): void {
    loadFontData(url, false, (err, data) => onComplete(err, typeof data === 'string' ? data : data?.family));
}

function loadFontAsset (url: string, options: Record<string, any>, onComplete: FontDataCallback): void {
    loadFontData(url, true, onComplete);
}

function loadFontData (url: string, browserAsset: boolean, onComplete: FontDataCallback): void {
    const name = getFontFamily(url);
    const key = browserAsset ? `source:${url}` : `family:${name}`;
    const existing = _fontFaces.get(key);
    if (existing) {
        onComplete(null, existing);
        return;
    }
    const pending = _pendingFaces.get(key);
    if (pending) {
        pending.push(onComplete);
        return;
    }

    const callbacks = [onComplete];
    // A new source or reload must not reuse another font's Canvas measurement cache key.
    const fontFamilyName = browserAsset ? `__cocos_font_${++browserFamilySerial}` : name;
    _pendingFaces.set(key, callbacks);
    const finish = (): void => {
        _pendingFaces.delete(key);
        const font = _fontFaces.get(key);
        if (!font) warnID(4933, name);
        for (const callback of callbacks) callback(null, font ?? fontFamilyName);
    };
    if (useNativeCheck()) {
        // A fresh FontFace can reload the original URL after a failed document stylesheet fetch.
        const timeout = setTimeout(finish, _timeout);
        const settle = (face?: LoadableFontFace): void => {
            if (_pendingFaces.get(key) !== callbacks) return;
            clearTimeout(timeout);
            if (face) {
                const fonts = (ccdocument as Document & { fonts: {
                    add (value: LoadableFontFace): void;
                    delete (value: LoadableFontFace): void;
                } }).fonts;
                registerFontFace(key, name, fontFamilyName, () => fonts.add(face), () => fonts.delete(face));
            }
            finish();
        };
        try {
            const face = new ccwindow.FontFace(fontFamilyName, `url(${JSON.stringify(url)})`);
            face.load().then(() => settle(face), () => settle());
        } catch {
            settle();
        }
        return;
    }

    if (!_canvasContext) {
        const labelCanvas = ccdocument.createElement('canvas');
        labelCanvas.width = 100;
        labelCanvas.height = 100;
        _canvasContext = labelCanvas.getContext('2d');
    }

    // Default width reference to test whether new font is loaded correctly
    const familyCss = quoteFontFamily(fontFamilyName);
    const fontDesc = buildFontDesc(40, familyCss);

    // Setup font face style
    const fontStyle = ccdocument.createElement('style');
    fontStyle.type = 'text/css';
    let fontStr = `@font-face { font-family:${familyCss}; src:`;
    fontStr += `url("${url}");`;
    fontStyle.textContent = `${fontStr}}`;
    ccdocument.body.appendChild(fontStyle);

    // Preload font with div
    const preloadDiv = ccdocument.createElement('div');
    const divStyle = preloadDiv.style;
    divStyle.fontFamily = familyCss;
    preloadDiv.innerHTML = '.';
    divStyle.position = 'absolute';
    divStyle.left = '-100px';
    divStyle.top = '-100px';
    ccdocument.body.appendChild(preloadDiv);

    _canvasContext!.font = fontDesc;
    _loadingFonts.push({
        fontDesc,
        refWidth: _canvasContext!.measureText(_testString).width,
        startTime: Date.now(),
        onComplete: (loaded: boolean): void => {
            preloadDiv.parentNode?.removeChild(preloadDiv);
            const detach = (): void => { fontStyle.parentNode?.removeChild(fontStyle); };
            if (loaded) {
                registerFontFace(key, name, fontFamilyName, () => {
                    if (!fontStyle.parentNode) ccdocument.body.appendChild(fontStyle);
                }, detach, detach);
            } else detach();
            finish();
        },
    });
    if (_intervalId === -1) _intervalId = setInterval(checkFontLoaded, 100);
}

export function getFontFamily (fontHandle: string): string {
    const ttfIndex = fontHandle.lastIndexOf('.ttf');
    if (ttfIndex === -1) { return fontHandle; }

    const slashPos = fontHandle.lastIndexOf('/');
    let fontFamilyName: string;
    if (slashPos === -1) {
        fontFamilyName = `${fontHandle.substring(0, ttfIndex)}_LABEL`;
    } else {
        fontFamilyName = `${fontHandle.substring(slashPos + 1, ttfIndex)}_LABEL`;
    }
    return fontFamilyName;
}

function createFont (id: string, data: FontData, options: Record<string, any>, onComplete: ((err: Error | null, data?: TTFFont | null) => void)): void {
    let out: TTFFont | null = null;
    try {
        out = new TTFFont();
        out._nativeUrl = id;
        out._nativeAsset = data;
        const nativeFont = out as TTFFont & { getFontDataSize?: () => number };
        if (nativeFont.getFontDataSize && !nativeFont.getFontDataSize()) {
            throw new Error(`Font data unavailable: ${id}`);
        }
    } catch (error) {
        out?.destroy();
        onComplete(error instanceof Error ? error : new Error(String(error)), null);
        return;
    }
    onComplete(null, out);
}

const downloadFont = JSB ? loadFont : loadFontAsset;
downloader.register({
    // font
    '.font': downloadFont,
    '.eot': downloadFont,
    '.ttf': downloadFont,
    '.woff': downloadFont,
    '.svg': downloadFont,
    '.ttc': downloadFont,
});

factory.register({
    // font
    '.font': createFont,
    '.eot': createFont,
    '.ttf': createFont,
    '.woff': createFont,
    '.svg': createFont,
    '.ttc': createFont,
});
