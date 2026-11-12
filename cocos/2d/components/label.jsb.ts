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

import { ccclass, displayOrder, executionOrder, help, menu, multiline, requireComponent, serializable, type } from 'cc.decorator';
import { builtinResMgr } from '../../asset/asset-manager/builtin-res-mgr';
import { Material } from '../../asset/assets';
import { Color, Vec2 } from '../../core';
import { UITransform } from '../framework/ui-transform';
import { UIRenderer } from '../framework/ui-renderer';

declare const n2d: any;

export enum HorizontalTextAlignment {
    LEFT = 0,
    CENTER = 1,
    RIGHT = 2,
}

export enum VerticalTextAlignment {
    TOP = 0,
    CENTER = 1,
    BOTTOM = 2,
}

export enum Overflow {
    NONE = 0,
    CLAMP = 1,
    SHRINK = 2,
    RESIZE_HEIGHT = 3,
}

export enum CacheMode {
    NONE = 0,
    BITMAP = 1,
    CHAR = 2,
}

/**
 * Native M3 Label shell.
 *
 * The shell owns serialization and the public Label API. Text measurement,
 * wrapping, alignment and texture generation are done by the native Label.
 */
@ccclass('cc.Label')
@help('i18n:cc.Label')
@executionOrder(110)
@menu('2D/Label')
@requireComponent(UITransform)
export class Label extends UIRenderer {
    public static HorizontalAlign = HorizontalTextAlignment;
    public static VerticalAlign = VerticalTextAlignment;
    public static Overflow = Overflow;
    public static CacheMode = CacheMode;

    @serializable
    protected _string = '';

    @serializable
    protected _fontSize = 40;
    protected _isBold = false;
    protected _isItalic = false;
    protected _isUnderline = false;

    @serializable
    protected _lineHeight = 40;

    @serializable
    protected _fontFamily = 'Arial';

    @serializable
    protected _overflow = Overflow.NONE;

    @serializable
    protected _enableWrapText = true;

    @serializable
    protected _horizontalAlign = HorizontalTextAlignment.LEFT;

    @serializable
    protected _verticalAlign = VerticalTextAlignment.TOP;

    @serializable
    protected _spacingX = 0;

    @serializable
    protected _cacheMode = CacheMode.NONE;

    @serializable
    protected _useSystemFont = true;

    protected _font: any = null;
    protected _enableOutline = false;
    protected _outlineColor = new Color(0, 0, 0, 255);
    protected _outlineWidth = 0;
    protected _enableShadow = false;
    protected _shadowColor = new Color(0, 0, 0, 255);
    protected _shadowBlur = 0;
    protected _shadowOffset = new Vec2(0, 0);

    private _native: any = null;

    public onLoad (): void {
        this._native = new n2d.Label();
        this._native.setNode(this.node);
        const transform = this.node.getComponent(UITransform);
        if (transform && (transform as any)._native) {
            this._native.setUITransform((transform as any)._native);
        }
        const material = builtinResMgr.get<Material>('ui-sprite-material');
        if (material) {
            this._native.setMaterial(material);
        }
        this._native.setPriority(this.priority);
        this._syncAll();
    }

    public updateRenderData (_force = false): void {
        if (!this._native) {
            return;
        }
        const transform = this.node.getComponent(UITransform);
        if (!transform) {
            return;
        }
        transform.setContentSize(0, 0);
        this._native.updateRenderData?.();
        const width = this._native.getContentWidth?.() ?? 0;
        const height = this._native.getContentHeight?.() ?? 0;
        if (width > 0 && height > 0) {
            transform.setContentSize(width, height);
        }
    }

    public lateUpdate (): void {
        if (!this._native || this._overflow !== Overflow.RESIZE_HEIGHT) {
            return;
        }
        const height = this._native.getContentHeight();
        const transform = this.node.getComponent(UITransform);
        if (height > 0 && transform && Math.abs(transform.contentSize.height - height) > 0.5) {
            transform.setContentSize(transform.contentSize.width, height);
        }
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

    get string (): string {
        return this._string;
    }

    set string (value: string) {
        const text = value === null || value === undefined ? '' : value.toString();
        if (this._string === text) {
            return;
        }
        this._string = text;
        this._native?.setString(text);
    }

    @displayOrder(4)
    @multiline
    get text (): string {
        return this._string;
    }

    set text (value: string) {
        this.string = value;
    }

    get fontSize (): number {
        return this._fontSize;
    }

    get isBold (): boolean { return this._isBold; }
    set isBold (value: boolean) {
        this._isBold = value;
        this._native?.setIsBold(value);
    }

    get isItalic (): boolean { return this._isItalic; }
    set isItalic (value: boolean) {
        this._isItalic = value;
        this._native?.setIsItalic(value);
    }

    get isUnderline (): boolean { return this._isUnderline; }
    set isUnderline (value: boolean) {
        this._isUnderline = value;
        this._native?.setIsUnderline(value);
    }

    set fontSize (value: number) {
        if (this._fontSize === value) {
            return;
        }
        this._fontSize = value;
        this._syncFont();
    }

    get lineHeight (): number {
        return this._lineHeight;
    }

    set lineHeight (value: number) {
        if (this._lineHeight === value) {
            return;
        }
        this._lineHeight = value;
        this._native?.setLineHeight(value);
    }

    get fontFamily (): string {
        return this._fontFamily;
    }

    set fontFamily (value: string) {
        if (this._fontFamily === value) {
            return;
        }
        this._fontFamily = value;
        this._syncFont();
    }

    get font (): any {
        return this._font;
    }

    set font (value: any) {
        this._font = value;
        this._useSystemFont = !value;
        if (value && value.spriteFrame && value.fontDefDictionary) {
            this._applyBitmapFont(value);
        } else {
            this._native?.clearBitmapFont();
            this._syncFont();
        }
    }

    get useSystemFont (): boolean {
        return this._useSystemFont;
    }

    set useSystemFont (value: boolean) {
        this._useSystemFont = value;
        this._syncFont();
    }

    @type(Overflow)
    @displayOrder(5)
    get overflow (): Overflow {
        return this._overflow;
    }

    set overflow (value: Overflow) {
        if (this._overflow === value) {
            return;
        }
        this._overflow = value;
        this._native?.setOverflow(value);
    }

    get enableWrapText (): boolean {
        return this._enableWrapText;
    }

    set enableWrapText (value: boolean) {
        if (this._enableWrapText === value) {
            return;
        }
        this._enableWrapText = value;
        this._native?.setEnableWrapText(value);
    }

    @type(HorizontalTextAlignment)
    get horizontalAlign (): HorizontalTextAlignment {
        return this._horizontalAlign;
    }

    set horizontalAlign (value: HorizontalTextAlignment) {
        if (this._horizontalAlign === value) {
            return;
        }
        this._horizontalAlign = value;
        this._native?.setHorizontalAlign(value);
    }

    @type(VerticalTextAlignment)
    get verticalAlign (): VerticalTextAlignment {
        return this._verticalAlign;
    }

    set verticalAlign (value: VerticalTextAlignment) {
        if (this._verticalAlign === value) {
            return;
        }
        this._verticalAlign = value;
        this._native?.setVerticalAlign(value);
    }

    get spacingX (): number {
        return this._spacingX;
    }

    set spacingX (value: number) {
        this._spacingX = value;
        this._native?.setSpacingX(value);
    }

    get cacheMode (): CacheMode {
        return this._cacheMode;
    }

    set cacheMode (value: CacheMode) {
        this._cacheMode = value;
        this._native?.setCacheMode(value);
    }

    get color (): Readonly<Color> {
        return this._color;
    }

    set color (value: Color) {
        if (this._color.equals(value)) {
            return;
        }
        this._color.set(value);
        this._native?.setColorRGBA(value.r, value.g, value.b, value.a);
    }

    get customMaterial (): Material | null {
        return this._customMaterial;
    }

    set customMaterial (value: Material | null) {
        this._customMaterial = value;
        this._native?.setMaterial(value);
    }

    get enableOutline (): boolean { return this._enableOutline; }
    set enableOutline (value: boolean) {
        this._enableOutline = value;
        this._native?.setEnableOutline(value);
    }

    get outlineColor (): Readonly<Color> { return this._outlineColor; }
    set outlineColor (value: Color) {
        this._outlineColor.set(value);
        this._native?.setOutlineColor(value);
    }

    get outlineWidth (): number { return this._outlineWidth; }
    set outlineWidth (value: number) {
        this._outlineWidth = value;
        this._native?.setOutlineWidth(value);
    }

    get enableShadow (): boolean { return this._enableShadow; }
    set enableShadow (value: boolean) {
        this._enableShadow = value;
        this._native?.setEnableShadow(value);
    }

    get shadowColor (): Readonly<Color> { return this._shadowColor; }
    set shadowColor (value: Color) {
        this._shadowColor.set(value);
        this._native?.setShadowColor(value);
    }

    get shadowBlur (): number { return this._shadowBlur; }
    set shadowBlur (value: number) {
        this._shadowBlur = value;
        this._native?.setShadowBlur(value);
    }

    get shadowOffset (): Vec2 { return this._shadowOffset; }
    set shadowOffset (value: Vec2) {
        this._shadowOffset.set(value);
        this._native?.setShadowOffset(value.x, value.y);
    }

    private _applyBitmapFont (font: any): void {
        if (!this._native || !font.spriteFrame) {
            return;
        }
        this._native.setBitmapAtlas(font.spriteFrame.native, font.fontSize > 0 ? font.fontSize : this._lineHeight);
        this._native.clearGlyphs();
        this._native.clearKerning();
        const definitions = font.fontDefDictionary?.letterDefinitions ?? {};
        const kerning = font.fntConfig?.kerningDict ?? {};
        for (const left of Object.keys(kerning)) {
            for (const right of Object.keys(kerning[left])) {
                this._native.addKerning(Number(left), Number(right), kerning[left][right]);
            }
        }
        for (const key of Object.keys(definitions)) {
            const glyph = definitions[key];
            this._native.addGlyph(
                Number(key),
                glyph.u,
                glyph.v,
                glyph.w,
                glyph.h,
                glyph.offsetX,
                glyph.offsetY,
                glyph.xAdvance,
            );
        }
    }

    private _syncFont (): void {
        this._native?.setFont(`${this._fontSize}px ${this._fontFamily}`);
        this._native?.setFontSize(this._fontSize);
    }

    private _syncAll (): void {
        this._native?.setString(this._string);
        this._native?.setFont(`${this._fontSize}px ${this._fontFamily}`);
        this._native?.setFontSize(this._fontSize);
        this._native?.setLineHeight(this._lineHeight);
        this._native?.setEnableWrapText(this._enableWrapText);
        this._native?.setOverflow(this._overflow);
        this._native?.setHorizontalAlign(this._horizontalAlign);
        this._native?.setVerticalAlign(this._verticalAlign);
        this._native?.setSpacingX(this._spacingX);
        this._native?.setColorRGBA(this._color.r, this._color.g, this._color.b, this._color.a);
        if (this._font && this._font.spriteFrame && this._font.fontDefDictionary) {
            this._applyBitmapFont(this._font);
        }
        this._native?.setEnableOutline(this._enableOutline);
        this._native?.setOutlineColor(this._outlineColor);
        this._native?.setOutlineWidth(this._outlineWidth);
        this._native?.setEnableShadow(this._enableShadow);
        this._native?.setShadowColor(this._shadowColor);
        this._native?.setShadowBlur(this._shadowBlur);
        this._native?.setShadowOffset(this._shadowOffset.x, this._shadowOffset.y);
        this._native?.setCacheMode(this._cacheMode);
    }
}
