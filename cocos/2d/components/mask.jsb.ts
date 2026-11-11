/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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

import { ccclass, executeInEditMode, executionOrder, help, menu, serializable } from 'cc.decorator';
import { builtinResMgr } from '../../asset/asset-manager/builtin-res-mgr';
import { Material, SpriteFrame } from '../../asset/assets';
import { Component } from '../../scene-graph/component';
import { Node } from '../../scene-graph/node';
import { UITransform } from '../framework/ui-transform';
import { Graphics } from './graphics';

declare const n2d: any;

export enum MaskType {
    GRAPHICS_RECT = 0,
    GRAPHICS_ELLIPSE = 1,
    GRAPHICS_STENCIL = 2,
    SPRITE_STENCIL = 3,
}

/**
 * Native M4.0 Mask shell. Only RECT is routed to native; other types currently
 * keep the RECT stencil geometry until their native paths land.
 */
@ccclass('cc.Mask')
@help('i18n:cc.Mask')
@executionOrder(110)
@menu('2D/Mask')
@executeInEditMode
export class Mask extends Component {
    public static Type = MaskType;

    @serializable
    protected _type = MaskType.GRAPHICS_RECT;

    @serializable
    protected _inverted = false;

    @serializable
    protected _segments = 64;

    @serializable
    protected _radius = 0;

    @serializable
    protected _alphaThreshold = 0.1;

    private _native: any = null;
    private _spriteFrame: SpriteFrame | null = null;
    private _graphics: Graphics | null = null;
    private _graphicsNode: Node | null = null;
    private _lastGraphicsFrame: any = null;

    public onLoad (): void {
        this._native = new n2d.Mask();
        this._native.setNode(this.node);
        const transform = this.node.getComponent(UITransform);
        if (transform && (transform as any)._native) {
            this._native.setUITransform((transform as any)._native);
        }
        const material = builtinResMgr.get<Material>('ui-alpha-test-material');
        if (material) {
            this._native.setMaterial(material);
        }
        this._native.setType(this._type);
        if (this._type === MaskType.GRAPHICS_STENCIL) {
            this.graphics;
        }
        this._native.setInverted(this._inverted);
        this._native.setAlphaThreshold(this._alphaThreshold);
        if (this._spriteFrame) {
            this._native.setSpriteFrame((this._spriteFrame as any).native);
        }
        this._native.setPriority(0);
        this._native.setEnabled(this.enabledInHierarchy);
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native = null;
        }
    }

    get type (): MaskType {
        return this._type;
    }

    set type (value: MaskType) {
        this._type = value;
        this._native?.setType(value);
    }

    get inverted (): boolean {
        return this._inverted;
    }

    set inverted (value: boolean) {
        this._inverted = value;
        this._native?.setInverted(value);
    }

    get segments (): number {
        return this._segments;
    }

    set segments (value: number) {
        this._segments = value;
    }

    get graphics (): Graphics | null {
        if (!this._graphicsNode) {
            this._graphicsNode = new Node('MaskGraphics');
            this._graphicsNode.parent = this.node;
            this._graphicsNode.setPosition(0, 0, 0);
            const transform = this._graphicsNode.addComponent(UITransform);
            transform.setContentSize(256, 256);
        }
        if (!this._graphics) {
            this._graphics = this._graphicsNode.getComponent(Graphics)
                ?? this._graphicsNode.addComponent(Graphics);
        }
        return this._graphics;
    }

    public lateUpdate (): void {
        if (this._type !== MaskType.GRAPHICS_STENCIL || !this._graphics) {
            return;
        }
        const frame = (this._graphics as any)._native?.getFrame?.();
        if (frame && frame !== this._lastGraphicsFrame) {
            this._lastGraphicsFrame = frame;
            this._native?.setSpriteFrame(frame);
        }
    }

    get spriteFrame (): SpriteFrame | null {
        return this._spriteFrame;
    }

    set spriteFrame (value: SpriteFrame | null) {
        this._spriteFrame = value;
        this._native?.setSpriteFrame((value as any)?.native ?? null);
    }

    get radius (): number {
        return this._radius;
    }

    set radius (value: number) {
        this._radius = value;
    }

    get alphaThreshold (): number {
        return this._alphaThreshold;
    }

    set alphaThreshold (value: number) {
        this._alphaThreshold = value;
        this._native?.setAlphaThreshold(value);
    }


}
