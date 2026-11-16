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

import { ccclass, executeInEditMode, executionOrder, help, menu, multiline, requireComponent, serializable, type } from 'cc.decorator';
import { EDITOR } from 'internal:constants';
import { Color, cclegacy } from '../../core';
import { Component } from '../../scene-graph/component';
import { NodeEventType } from '../../scene-graph/node-event';
import type { EventTouch } from '../../input/types/event/event-touch';
import { UITransform } from '../framework/ui-transform';
import { Font } from '../assets/font';
import type { TTFFont } from '../assets/ttf-font';
import { SpriteAtlas } from '../assets/sprite-atlas';
import { CacheMode, HorizontalTextAlignment, VerticalTextAlignment } from './label';

declare const n2d: any;

/** Native owns parsing, measurements, layout and segment renderers. */
@ccclass('cc.RichText')
@requireComponent(UITransform)
@help('i18n:cc.RichText')
@executionOrder(110)
@menu('2D/RichText')
@executeInEditMode
export class RichText extends Component {
    public static HorizontalAlign = HorizontalTextAlignment;
    public static VerticalAlign = VerticalTextAlignment;
    @serializable protected _lineHeight = 40;
    @serializable protected _string = '<color=#00ff00>Rich</color><color=#0fffff>Text</color>';
    @serializable protected _horizontalAlign = HorizontalTextAlignment.LEFT;
    @serializable protected _verticalAlign = VerticalTextAlignment.TOP;
    @serializable protected _fontSize = 40;
    @serializable protected _fontColor = Color.WHITE.clone();
    @serializable protected _maxWidth = 0;
    @serializable protected _fontFamily = 'Arial';
    @serializable protected _font: TTFFont | null = null;
    @serializable protected _isSystemFontUsed = true;
    @serializable protected _userDefinedFont: TTFFont | null = null;
    @serializable protected _cacheMode = CacheMode.NONE;
    @serializable protected _imageAtlas: SpriteAtlas | null = null;
    @serializable protected _handleTouchEvent = true;
    private _native: any = null;
    private _listening = false;

    @multiline
    get string (): string { return this._string; }
    set string (value: string) { this._string = value; this._native?.setString(value); }
    @type(HorizontalTextAlignment)
    get horizontalAlign (): HorizontalTextAlignment { return this._horizontalAlign; }
    set horizontalAlign (value: HorizontalTextAlignment) { this._horizontalAlign = value; this._native?.setHorizontalAlign(value); }
    @type(VerticalTextAlignment)
    get verticalAlign (): VerticalTextAlignment { return this._verticalAlign; }
    set verticalAlign (value: VerticalTextAlignment) { this._verticalAlign = value; this._native?.setVerticalAlign(value); }
    get fontSize (): number { return this._fontSize; }
    set fontSize (value: number) { this._fontSize = value; this._native?.setFontSize(value); }
    @type(Color)
    get fontColor (): Color { return this._fontColor; }
    set fontColor (value: Color) {
        this._fontColor = value;
        this._native?.setFontColorRGBA(value.r, value.g, value.b, value.a);
    }
    get fontFamily (): string { return this._fontFamily; }
    set fontFamily (value: string) { this._fontFamily = value; this._native?.setFontFamily(value); }
    @type(Font)
    get font (): TTFFont | null { return this._font; }
    set font (value: TTFFont | null) {
        if (this._font === value) return;
        this._font = value;
        if (EDITOR && value) this._userDefinedFont = value;
        this._isSystemFontUsed = !value;
        this._syncFont();
    }
    get useSystemFont (): boolean { return this._isSystemFontUsed; }
    set useSystemFont (value: boolean) {
        this._isSystemFontUsed = value;
        if (EDITOR) {
            if (value) this._font = null;
            else if (this._userDefinedFont) this._font = this._userDefinedFont;
        }
        this._syncFont();
    }
    get cacheMode (): CacheMode { return this._cacheMode; }
    set cacheMode (value: CacheMode) { this._cacheMode = value; this._native?.setCacheMode(value); }
    get maxWidth (): number { return this._maxWidth; }
    set maxWidth (value: number) { this._maxWidth = value; this._native?.setMaxWidth(value); }
    get lineHeight (): number { return this._lineHeight; }
    set lineHeight (value: number) { this._lineHeight = value; this._native?.setLineHeight(value); }
    @type(SpriteAtlas)
    get imageAtlas (): SpriteAtlas | null { return this._imageAtlas; }
    set imageAtlas (value: SpriteAtlas | null) { this._imageAtlas = value; this._native?.setImageAtlas(value); }
    get handleTouchEvent (): boolean { return this._handleTouchEvent; }
    set handleTouchEvent (value: boolean) {
        this._handleTouchEvent = value;
        if (value && this.enabledInHierarchy) this._addEventListeners();
        else this._removeEventListeners();
    }

    public onLoad (): void {
        const native = this._native = new n2d.RichText();
        native.setEnabled(false);
        native.setString(this._string); native.setFontSize(this._fontSize);
        native.setLineHeight(this._lineHeight); native.setMaxWidth(this._maxWidth);
        native.setHorizontalAlign(this._horizontalAlign); native.setVerticalAlign(this._verticalAlign);
        native.setFontFamily(this._fontFamily); this._syncFont();
        native.setFontColorRGBA(this._fontColor.r, this._fontColor.g, this._fontColor.b, this._fontColor.a);
        native.setCacheMode(this._cacheMode); native.setImageAtlas(this._imageAtlas);
        native.setNode(this.node);
        const transform = this.node.getComponent(UITransform) as any;
        if (transform?._native) native.setUITransform(transform._native);
        native.setEnabled(this.enabledInHierarchy);
    }
    public onEnable (): void {
        this._native?.setEnabled(true);
        if (this._handleTouchEvent) this._addEventListeners();
    }
    public onDisable (): void {
        this._removeEventListeners(); this._native?.setEnabled(false);
    }
    public onRestore (): void {
        if (EDITOR) { if (this.enabledInHierarchy) this.onEnable(); else this.onDisable(); }
    }
    public onDestroy (): void {
        this._removeEventListeners();
        if (this._native) {
            this._native.setEnabled(false); this._native.setNode(null);
            this._native.setFontAsset(null); this._native.setImageAtlas(null);
            this._native = null;
        }
    }
    private _syncFont (): void { this._native?.setFontAsset(this._isSystemFontUsed ? null : this._font); }
    protected _updateRichText (): void { this._native?.updateLayout(); }
    protected _addEventListeners (): void {
        if (!this._listening) { this.node.on(NodeEventType.TOUCH_END, this._onTouchEnded, this); this._listening = true; }
    }
    protected _removeEventListeners (): void {
        if (this._listening) { this.node.off(NodeEventType.TOUCH_END, this._onTouchEnded, this); this._listening = false; }
    }
    protected _onTouchEnded (event: EventTouch): void {
        const native = this._native;
        if (!native || !this._handleTouchEvent) return;
        const point = event.touch!.getUILocation();
        const hits: number[] = native.getHitSegments(point.x, point.y);
        const components = this.node.getComponents(Component);
        for (const index of hits) {
            if (this._native !== native) break;
            const name = native.getSegmentClickHandler(index), param = native.getSegmentClickParam(index);
            for (const component of components) {
                const handler = (component as any)[name];
                if (component.enabledInHierarchy && handler) handler.call(component, event, param);
            }
            event.propagationStopped = true;
        }
    }
}

cclegacy.RichText = RichText;
