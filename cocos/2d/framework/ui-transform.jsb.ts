/*
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

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

import { ccclass, help, executeInEditMode, executionOrder, menu, tooltip, displayOrder, serializable, disallowMultiple } from 'cc.decorator';
import { EDITOR } from 'internal:constants';
import { Component } from '../../scene-graph';
import { Rect, Size, Vec2, Vec3, geometry, Mat4, visibleRect } from '../../core';
import { director } from '../../game/director';
import { NodeEventType } from '../../scene-graph/node-event';

declare const n2d: any;

const _isHitWorld = new Vec2();
const _isHitMat4 = new Mat4();

/**
 * Native M1 shell for UITransform.
 *
 * Serialization/editor metadata stay in JS. Native UITransform owns content
 * size, anchor, priority, bounds, conversions and hit test. Enabled in the
 * NATIVE cc.config override after the real Creator scene regression.
 */
@ccclass('cc.UITransform')
@help('i18n:cc.UITransform')
@executionOrder(110)
@menu('UI/UITransform')
@disallowMultiple
@executeInEditMode
export class UITransform extends Component {
    public static EventType = NodeEventType;

    @serializable
    protected _contentSize = new Size(100, 100);

    @serializable
    protected _anchorPoint = new Vec2(0.5, 0.5);

    protected _priority = 0;

    private _native: any = null;

    @displayOrder(0)
    @tooltip('i18n:ui_transform.content_size')
    get contentSize (): Readonly<Size> {
        return this._contentSize;
    }

    set contentSize (value: Readonly<Size>) {
        if (this._contentSize.equals(value)) {
            return;
        }
        if (this._native) {
            this._native.setContentSizeXY(value.width, value.height);
        } else {
            const previous = EDITOR ? this._contentSize.clone() : undefined;
            this._contentSize.set(value);
            this.node.emit(NodeEventType.SIZE_CHANGED, previous);
        }
    }

    get width (): number {
        return this._contentSize.width;
    }

    set width (value: number) {
        this.setContentSize(value, this._contentSize.height);
    }

    get height (): number {
        return this._contentSize.height;
    }

    set height (value: number) {
        this.setContentSize(this._contentSize.width, value);
    }

    get anchorPoint (): Readonly<Vec2> {
        return this._anchorPoint;
    }

    set anchorPoint (value: Readonly<Vec2>) {
        if (this._anchorPoint.equals(value)) {
            return;
        }
        this._anchorPoint.set(value);
        this._native?.setAnchorPointXY(this._anchorPoint.x, this._anchorPoint.y);
    }

    get anchorX (): number {
        return this._anchorPoint.x;
    }

    set anchorX (value: number) {
        this.setAnchorPoint(value, this._anchorPoint.y);
    }

    get anchorY (): number {
        return this._anchorPoint.y;
    }

    set anchorY (value: number) {
        this.setAnchorPoint(this._anchorPoint.x, value);
    }

    get priority (): number {
        return this._priority;
    }

    set priority (value: number) {
        if (this._priority === value) {
            return;
        }
        this._priority = value;
        this._native?.setPriority(value);
    }

    get visibility (): number {
        const camera = director.root!.batcher2D.getFirstRenderCamera(this.node);
        return camera ? camera.visibility : 0;
    }

    get cameraPriority (): number {
        const camera = director.root!.batcher2D.getFirstRenderCamera(this.node);
        return camera ? camera.priority : 0;
    }

    public __preload (): void {
        this.node._uiProps.uiTransformComp = this as unknown as typeof this.node._uiProps.uiTransformComp;
    }

    public onLoad (): void {
        this._native = new n2d.UITransform(this.node);
        this._native.setContentSizeXY(this._contentSize.width, this._contentSize.height);
        this._native.setAnchorPointXY(this._anchorPoint.x, this._anchorPoint.y);
        this._native.setPriority(this._priority);
        this._native.setSizeChangedCallback((width: number, height: number) => {
            const previous = EDITOR ? this._contentSize.clone() : undefined;
            this._contentSize.set(width, height);
            this.node.emit(NodeEventType.SIZE_CHANGED, previous);
        });
    }

    public onDestroy (): void {
        this._native?.detach();
        this._native = null;
        const uiProps = this.node._uiProps;
        if ((uiProps?.uiTransformComp as unknown) === this) {
            uiProps.uiTransformComp = null;
        }
    }

    public setContentSize (size: Size): void;
    public setContentSize (width: number, height: number): void;
    public setContentSize (size: Size | number, height?: number): void {
        if (typeof size === 'number') {
            this.contentSize = new Size(size, height!);
        } else {
            this.contentSize = size;
        }
    }

    public setAnchorPoint (point: Vec2 | Readonly<Vec2> | number, y?: number): void {
        if (typeof point === 'number') {
            this.anchorPoint = new Vec2(point, y!);
        } else {
            this.anchorPoint = point;
        }
    }

    public isHit (uiPoint: Vec2): boolean {
        if (!this._native) {
            return false;
        }
        const cameras = this._getRenderScene().cameras;
        for (let i = 0; i < cameras.length; i++) {
            const camera = cameras[i];
            if (!(camera.visibility & this.node.layer)) {
                continue;
            }

            camera.node.getWorldRT(_isHitMat4);
            const m12 = _isHitMat4.m12;
            const m13 = _isHitMat4.m13;
            const center = visibleRect.center;
            _isHitMat4.m12 = center.x - (_isHitMat4.m00 * m12 + _isHitMat4.m04 * m13);
            _isHitMat4.m13 = center.y - (_isHitMat4.m01 * m12 + _isHitMat4.m05 * m13);
            Mat4.invert(_isHitMat4, _isHitMat4);
            Vec2.transformMat4(_isHitWorld, uiPoint, _isHitMat4);
            if (this._native.containsWorldPointXY(_isHitWorld.x, _isHitWorld.y)) {
                return true;
            }
        }
        return false;
    }

    public hitTest (screenPoint: Vec2, windowId = 0): boolean {
        return this._native ? this._native.hitTestXY(screenPoint.x, screenPoint.y, windowId) : false;
    }

    public convertToNodeSpaceAR (worldPoint: Vec3, out?: Vec3): Vec3 {
        out = out || new Vec3();
        if (this._native) {
            out.set(
                this._native.convertToNodeSpaceARX(worldPoint.x, worldPoint.y),
                this._native.convertToNodeSpaceARY(worldPoint.x, worldPoint.y),
                0,
            );
        } else {
            out.set(worldPoint);
        }
        return out;
    }

    public convertToWorldSpaceAR (nodePoint: Vec3, out?: Vec3): Vec3 {
        out = out || new Vec3();
        if (this._native) {
            out.set(
                this._native.convertToWorldSpaceARX(nodePoint.x, nodePoint.y),
                this._native.convertToWorldSpaceARY(nodePoint.x, nodePoint.y),
                0,
            );
        } else {
            out.set(nodePoint);
        }
        return out;
    }

    public getBoundingBox (): Rect {
        if (this._native) {
            return new Rect(
                this._native.getBoundingBoxX(),
                this._native.getBoundingBoxY(),
                this._native.getBoundingBoxWidth(),
                this._native.getBoundingBoxHeight(),
            );
        }
        return new Rect(0, 0, 0, 0);
    }

    public getBoundingBoxToWorld (): Rect {
        if (this._native) {
            return new Rect(
                this._native.getBoundingBoxToWorldX(),
                this._native.getBoundingBoxToWorldY(),
                this._native.getBoundingBoxToWorldWidth(),
                this._native.getBoundingBoxToWorldHeight(),
            );
        }
        return new Rect(0, 0, 0, 0);
    }

    public getBoundingBoxTo (targetMat: any): Rect {
        if (!this._native) {
            return new Rect(0, 0, 0, 0);
        }
        return new Rect(
            this._native.getBoundingBoxToX(targetMat),
            this._native.getBoundingBoxToY(targetMat),
            this._native.getBoundingBoxToWidth(targetMat),
            this._native.getBoundingBoxToHeight(targetMat),
        );
    }

    public getComputeAABB (out?: geometry.AABB): geometry.AABB {
        const box = this.getBoundingBoxToWorld();
        out = out || new geometry.AABB();
        geometry.AABB.set(out, box.x + box.width / 2, box.y + box.height / 2, 0, box.width / 2, box.height / 2, 0);
        return out;
    }

    protected _selfBoundingBox (out: Rect): Rect {
        const width = this._contentSize.width;
        const height = this._contentSize.height;
        out.set(-this._anchorPoint.x * width, -this._anchorPoint.y * height, width, height);
        return out;
    }

    protected _parentChanged (): void {
    }

    private _markRenderDataDirty (): void {
    }

    public static _sortSiblings (): void {
    }

    public static _cleanChangeMap (): void {
    }
}
