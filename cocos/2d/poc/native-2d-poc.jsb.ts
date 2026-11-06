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
 * Native M0 PoC: thin JS shells for UITransform/Sprite. This file is selected
 * only for native builds through cc.config.json; the Web build keeps
 * native-2d-poc.ts.
 *
 * The shells keep Component identity, serialization and lifecycle. Geometry,
 * transform math and draw-info generation live in native/cocos/2d.
 */
import { ccclass, menu, serializable, type } from 'cc.decorator';
import { Color, Size, Vec2 } from '../../core';
import { Component } from '../../scene-graph';
import { SpriteFrame } from '../assets';

declare const n2d: any;

@ccclass('cc.NativeUITransformPoc')
@menu('2D/Native PoC UITransform')
export class NativeUITransformPoc extends Component {
    @serializable
    protected _contentSize = new Size(100, 100);

    @serializable
    protected _anchorPoint = new Vec2(0.5, 0.5);

    @serializable
    protected _priority = 0;

    protected _native: any = null;

    public getNative (): any {
        return this._native;
    }

    get contentSize (): Readonly<Size> {
        return this._contentSize;
    }

    set contentSize (value: Readonly<Size>) {
        this._contentSize.set(value);
        this._applyNative();
    }

    get anchorPoint (): Readonly<Vec2> {
        return this._anchorPoint;
    }

    set anchorPoint (value: Readonly<Vec2>) {
        this._anchorPoint.set(value);
        this._applyNative();
    }

    get priority (): number {
        return this._priority;
    }

    set priority (value: number) {
        this._priority = value;
        if (this._native) {
            this._native.setPriority(value);
        }
    }

    protected onLoad (): void {
        this._native = new n2d.UITransform();
        this._native.setNode(this.node);
        this._applyNative();
    }

    protected onDestroy (): void {
        if (this._native) {
            this._native.setNode(null);
            this._native = null;
        }
    }

    private _applyNative (): void {
        if (!this._native) {
            return;
        }
        this._native.setContentSizeXY(this._contentSize.width, this._contentSize.height);
        this._native.setAnchorPointXY(this._anchorPoint.x, this._anchorPoint.y);
        this._native.setPriority(this._priority);
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

    protected _native: any = null;

    public getNative (): any {
        return this._native;
    }

    get spriteFrame (): SpriteFrame | null {
        return this._spriteFrame;
    }

    set spriteFrame (value: SpriteFrame | null) {
        this._spriteFrame = value;
        this._applyFrame();
    }

    get color (): Readonly<Color> {
        return this._color;
    }

    set color (value: Readonly<Color>) {
        this._color.set(value);
        this._applyColor();
    }

    get trim (): boolean {
        return this._trim;
    }

    set trim (value: boolean) {
        this._trim = value;
        if (this._native) {
            this._native.setTrim(value);
        }
    }

    protected onLoad (): void {
        this._native = new n2d.Sprite();
        this._native.setNode(this.node);
        this._applyColor();
        this._applyFrame();
    }

    protected start (): void {
        this._attachTransform();
    }

    protected onEnable (): void {
        if (this._native) {
            this._native.setEnabled(true);
        }
        this._attachTransform();
    }

    protected onDisable (): void {
        if (this._native) {
            this._native.setEnabled(false);
        }
    }

    protected onDestroy (): void {
        if (this._native) {
            this._native.setNode(null);
            this._native = null;
        }
    }

    private _attachTransform (): void {
        if (!this._native) {
            return;
        }
        const transform = this.node.getComponent(NativeUITransformPoc);
        if (transform && transform.getNative()) {
            this._native.setUITransform(transform.getNative());
        }
    }

    private _applyColor (): void {
        if (!this._native) {
            return;
        }
        this._native.setColorRGBA(this._color.r, this._color.g, this._color.b, this._color.a);
    }

    private _applyFrame (): void {
        if (!this._native) {
            return;
        }

        const frame = this._spriteFrame;
        const texture = frame ? frame.texture : null;
        if (!frame || !texture) {
            this._native.clearFrame();
            return;
        }

        const rect = frame.rect;
        const originalSize = frame.originalSize;
        const offset = frame.offset;
        this._native.setFrame(
            texture,
            rect.x, rect.y, rect.width, rect.height,
            originalSize.width, originalSize.height,
            offset.x, offset.y,
            texture.width, texture.height,
            frame.rotated,
        );
    }
}
