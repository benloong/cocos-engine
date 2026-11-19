/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

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

import { JSB } from 'internal:constants';
import { macro } from '../../core';
import { ccwindow } from '../../core/global-exports';

export interface ISharedLabelData {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | null;
}

let _canvasPool: CanvasPool;

export class CanvasPool {
    static getInstance (): CanvasPool {
        if (!_canvasPool) {
            _canvasPool = new CanvasPool();
        }
        return _canvasPool;
    }

    private constructor () {}

    public pool: ISharedLabelData[] = [];
    public get (): ISharedLabelData {
        let data = this.pool.pop();

        if (!data) {
            const canvas = ccwindow.document.createElement('canvas');
            const context = canvas.getContext('2d');
            data = {
                canvas,
                context,
            };
        }

        return data;
    }

    public put (canvas: ISharedLabelData): void {
        if (this.pool.length >= macro.MAX_LABEL_CANVAS_POOL_SIZE) {
            if (JSB) {
                const c = canvas.canvas as any;
                if (c && c._destroy) {
                    c._destroy();
                }
                canvas.canvas = null!;
                canvas.context = null;
            }
            return;
        }
        this.pool.push(canvas);
    }
}
