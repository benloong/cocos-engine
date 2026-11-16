/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
*/

import { ccclass, disallowMultiple, executeInEditMode, executionOrder, help, menu, requireComponent } from 'cc.decorator';
import { Component } from '../../scene-graph/component';
import { UITransform } from './ui-transform';

declare const n2d: any;

/**
 * Native RenderRoot2D shell. The node is registered directly into the native
 * Batcher2d root list; Canvas keeps its JS camera/adaptation logic on top.
 */
@ccclass('cc.RenderRoot2D')
@help('i18n:cc.RenderRoot2D')
@executionOrder(100)
@menu('2D/RenderRoot2D')
@requireComponent(UITransform)
@disallowMultiple
@executeInEditMode
export class RenderRoot2D extends Component {
    private _nativeRoot: any = null;

    public onLoad (): void {
        if (this._nativeRoot) return;
        this._nativeRoot = new n2d.RenderRoot2D();
        this._nativeRoot.setNode(this.node);
    }

    public onEnable (): void {
        this._nativeRoot?.setEnabled(true);
    }

    public onDisable (): void {
        this._nativeRoot?.setEnabled(false);
    }

    public onDestroy (): void {
        if (this._nativeRoot) {
            this._nativeRoot.setEnabled(false);
            this._nativeRoot.setNode(null);
            this._nativeRoot = null;
        }
    }
}
