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
import { buildFontDesc, quoteFontFamily } from './font-family';
import downloader from '../../asset/asset-manager/downloader';
import factory from '../../asset/asset-manager/factory';
import { TTFFont } from '../assets/ttf-font';
import { ccwindow } from '../../core/global-exports';

const ccdocument = ccwindow.document;

type FontCallback = (err: Error | null, family?: string) => void;

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

// While loading, callers share one face. A null value denotes a loaded face.
const _fontFaces = new Map<string, FontCallback[] | null>();

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

export function loadFont (url: string, options: Record<string, any>, onComplete: FontCallback): void {
    const fontFamilyName = getFontFamily(url);
    const existing = _fontFaces.get(fontFamilyName);
    if (existing !== undefined) {
        if (existing) existing.push(onComplete);
        else onComplete(null, fontFamilyName);
        return;
    }

    const callbacks = [onComplete];
    _fontFaces.set(fontFamilyName, callbacks);
    const finish = (loaded: boolean): void => {
        if (loaded) {
            _fontFaces.set(fontFamilyName, null);
        } else {
            _fontFaces.delete(fontFamilyName);
            warnID(4933, fontFamilyName);
        }
        for (const callback of callbacks) callback(null, fontFamilyName);
    };
    if (useNativeCheck()) {
        // A fresh FontFace can reload the original URL after a failed document stylesheet fetch.
        const timeout = setTimeout(() => finish(false), _timeout);
        const settle = (face?: FontFace): void => {
            if (_fontFaces.get(fontFamilyName) !== callbacks) return;
            clearTimeout(timeout);
            if (face) (ccdocument.fonts as FontFaceSet & { add (value: FontFace): void }).add(face);
            finish(!!face);
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
            if (!loaded) fontStyle.parentNode?.removeChild(fontStyle);
            finish(loaded);
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

function createFont (id: string, data: string, options: Record<string, any>, onComplete: ((err: Error | null, data?: TTFFont | null) => void)): void {
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

downloader.register({
    // font
    '.font': loadFont,
    '.eot': loadFont,
    '.ttf': loadFont,
    '.woff': loadFont,
    '.svg': loadFont,
    '.ttc': loadFont,
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
