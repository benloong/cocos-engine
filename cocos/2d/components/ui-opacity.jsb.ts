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

import { ccclass, disallowMultiple, editable, executeInEditMode, executionOrder, help, menu, serializable, tooltip } from 'cc.decorator';
import { EDITOR_NOT_IN_PREVIEW } from 'internal:constants';
import { Component } from '../../scene-graph/component';
import { clamp } from '../../core';

declare const n2d: any;

/**
 * Native M1 shell for UIOpacity. Serialization and editor metadata stay here;
 * the native UIOpacity owns the 0..255 value and Node::_localOpacity writes.
 */
@ccclass('cc.UIOpacity')
@help('i18n:cc.UIOpacity')
@executionOrder(110)
@menu('UI/UIOpacity')
@executeInEditMode
@disallowMultiple
export class UIOpacity extends Component {
    @editable
    @tooltip('i18n:UIOpacity.opacity')
    get opacity (): number {
        return this._opacity;
    }

    set opacity (value: number) {
        if (this._opacity === value) {
            return;
        }
        value = clamp(value, 0, 255);
        this._opacity = value;
        this._native?.setOpacity(value);

        if (EDITOR_NOT_IN_PREVIEW) {
            setTimeout(() => {
                EditorExtends.Node.emit('change', this.node.uuid, this.node);
            }, 200);
        }
    }

    @serializable
    protected _opacity = 255;

    private _native: any = null;

    public onLoad (): void {
        this._native = new n2d.UIOpacity(this.node);
        this._native.setActive(false);
    }

    public onEnable (): void {
        this._native?.setOpacity(this._opacity);
        this._native?.setActive(true);
    }

    public onDisable (): void {
        this._native?.setActive(false);
    }

    public onDestroy (): void {
        this._native?.detach();
        this._native = null;
    }
}
