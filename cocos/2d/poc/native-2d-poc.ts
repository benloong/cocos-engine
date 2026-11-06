/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

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

/**
 * Web/editor fallback for the M0 native 2D PoC.
 *
 * The native build replaces this file with native-2d-poc.jsb.ts. Keeping a
 * Web implementation means the PoC module can be imported and type-checked
 * without touching the production UITransform/Sprite.
 */
import { ccclass, menu, serializable, type } from 'cc.decorator';
import { Color, Size, Vec2 } from '../../core';
import { Component } from '../../scene-graph';
import { SpriteFrame } from '../assets';

@ccclass('cc.NativeUITransformPoc')
@menu('2D/Native PoC UITransform')
export class NativeUITransformPoc extends Component {
    @serializable
    protected _contentSize = new Size(100, 100);

    @serializable
    protected _anchorPoint = new Vec2(0.5, 0.5);

    @serializable
    protected _priority = 0;

    get contentSize (): Readonly<Size> {
        return this._contentSize;
    }

    set contentSize (value: Readonly<Size>) {
        this._contentSize.set(value);
    }

    get anchorPoint (): Readonly<Vec2> {
        return this._anchorPoint;
    }

    set anchorPoint (value: Readonly<Vec2>) {
        this._anchorPoint.set(value);
    }

    get priority (): number {
        return this._priority;
    }

    set priority (value: number) {
        this._priority = value;
    }

    /**
     * Only meaningful in the native build.
     */
    public getNative (): unknown {
        return null;
    }
}

@ccclass('cc.NativeSpritePoc')
@menu('2D/Native PoC Sprite')
export class NativeSpritePoc extends Component {
    @serializable
    @type(SpriteFrame)
    protected _spriteFrame: SpriteFrame | null = null;

    @serializable
    protected _color = new Color(255, 255, 255, 255);

    @serializable
    protected _trim = true;

    get spriteFrame (): SpriteFrame | null {
        return this._spriteFrame;
    }

    set spriteFrame (value: SpriteFrame | null) {
        this._spriteFrame = value;
    }

    get color (): Readonly<Color> {
        return this._color;
    }

    set color (value: Readonly<Color>) {
        this._color.set(value);
    }

    get trim (): boolean {
        return this._trim;
    }

    set trim (value: boolean) {
        this._trim = value;
    }
}
