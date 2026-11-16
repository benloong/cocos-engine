/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do
 so, subject to the following conditions:

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

import { Label } from '../components/label';
import { Sprite } from '../components/sprite';
import type { IAssembler, IAssemblerManager } from '../renderer/base';

// Preserve the legacy manager entry points without importing Web assemblers.
// Native Batcher2d owns buffer preparation and submission; explicit assembler
// updates only rebuild Label data or invalidate Sprite geometry in native.
interface NativeRenderer {
    _native: {
        setDirty(): void;
        updateRenderData(): void;
        setColorRGBA(r: number, g: number, b: number, a: number): void;
    } | null;
    color: { r: number; g: number; b: number; a: number };
}

const sprite: IAssembler = {
    updateRenderData (comp): void { (comp as unknown as NativeRenderer)._native?.setDirty(); },
    updateUVs (comp): void { (comp as unknown as NativeRenderer)._native?.setDirty(); },
    updateColor (comp): void {
        const { _native, color } = comp as unknown as NativeRenderer;
        _native?.setColorRGBA(color.r, color.g, color.b, color.a);
    },
};
const label: IAssembler = {
    updateRenderData (comp): void { (comp as unknown as NativeRenderer)._native?.updateRenderData(); },
    updateColor (comp): void {
        const { _native, color } = comp as unknown as NativeRenderer;
        _native?.setColorRGBA(color.r, color.g, color.b, color.a);
    },
};

export const spriteAssembler: IAssemblerManager = { getAssembler: () => sprite };
export const labelAssembler: IAssemblerManager = { getAssembler: () => label };
Sprite.Assembler = spriteAssembler;
Label.Assembler = labelAssembler;
