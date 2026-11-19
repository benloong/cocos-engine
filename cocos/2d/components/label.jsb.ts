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
import type { Material } from '../../asset/assets';
import { EDITOR } from 'internal:constants';
import { Color, Vec2 } from '../../core';
import { UITransform } from '../framework/ui-transform';
import { UIRenderer } from '../framework/ui-renderer';
import { bindNativeMaterialSlots, patchNativeMaterialAPIs, releaseNativeMaterialSlots, syncNativeMaterialSlots } from '../framework/native-ui-materials';
import { Font } from '../assets/font';
import { BitmapFont } from '../assets/bitmap-font';
import type { FontAtlas } from '../assets/bitmap-font';
import type { SpriteFrame } from '../assets/sprite-frame';
import { LetterRenderTexture } from '../assembler/label/font-utils';

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
    protected _string = 'label';

    @serializable
    protected _fontSize = 40;
    @serializable
    protected _isBold = false;
    @serializable
    protected _isItalic = false;
    @serializable
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
    protected _horizontalAlign = HorizontalTextAlignment.CENTER;

    @serializable
    protected _verticalAlign = VerticalTextAlignment.CENTER;

    @serializable
    protected _spacingX = 0;

    @serializable
    protected _cacheMode = CacheMode.NONE;

    @serializable
    protected _isSystemFontUsed = true;

    @serializable
    protected _font: any = null;
    protected _userDefinedFont: Font | null = null;
    protected _fontAtlas: FontAtlas | null = null;

    /** @deprecated Preserved for callers of the legacy Label atlas accessor. */
    get fontAtlas (): FontAtlas | null { return this._fontAtlas; }
    set fontAtlas (value: FontAtlas | null) { this._fontAtlas = value; }

    get ttfSpriteFrame (): SpriteFrame | null { return this._native?.getTTFSpriteFrame() ?? null; }

    private _letterTexture: LetterRenderTexture | null = null;

    get spriteFrame (): SpriteFrame | LetterRenderTexture | null {
        if (this._font instanceof BitmapFont) return this._font.spriteFrame;
        return this._cacheMode === CacheMode.CHAR ? this._letterTexture : this.ttfSpriteFrame;
    }

    private _acquireLetterTexture (): void {
        if (!this._native || this._letterTexture || this._cacheMode !== CacheMode.CHAR || this._font instanceof BitmapFont) return;
        let texture: LetterRenderTexture = this._native.getLetterTexture();
        if (!texture) {
            texture = new LetterRenderTexture();
            this._native.setLetterTexture(texture);
        }
        texture.addRef();
        this._letterTexture = texture;
    }

    private _releaseLetterTexture (): void {
        const texture = this._letterTexture;
        if (!texture) return;
        this._letterTexture = null;
        texture.decRef(false);
        if (texture.refCount === 0) texture.destroy();
    }
    @serializable
    protected _enableOutline = false;
    @serializable
    protected _outlineColor = new Color(0, 0, 0, 255);
    @serializable
    protected _outlineWidth = 2;
    @serializable
    protected _enableShadow = false;
    @serializable
    protected _shadowColor = new Color(0, 0, 0, 255);
    @serializable
    protected _shadowBlur = 2;
    @serializable
    protected _shadowOffset = new Vec2(2, 2);

    @serializable
    protected _actualFontSize = 0;

    @serializable
    protected _underlineHeight = 2;

    private _native: any = null;
    protected _contentWidth = 0;

    get contentWidth (): number { return this._native?.getTTFContentWidth() ?? this._contentWidth; }
    set contentWidth (width: number) {
        this._contentWidth = width;
        this._native?.setTTFContentWidth(width);
    }

    public onLoad (): void {
        this._native = new n2d.Label();
        this._native.setTTFContentWidth(this._contentWidth);
        this._native.setNode(this.node);
        const transform = this.node.getComponent(UITransform);
        if (transform && (transform as any)._native) {
            this._native.setUITransform((transform as any)._native);
        }
        this._native.setPriority(this.priority);
        bindNativeMaterialSlots(this);
        this._syncAll();
    }

    public updateRenderData (force = false): void {
        this._native?.updateRenderData(force);
    }

    public onEnable (): void {
        this._native?.setEnabled(true);
        this._acquireLetterTexture();
    }

    public onDisable (): void {
        this._native?.setEnabled(false);
    }

    public onDestroy (): void {
        this._releaseLetterTexture();
        releaseNativeMaterialSlots(this);
        if (this._native) {
            this._native.setEnabled(false);
            this._native.setNode(null);
            this._native.setFontAsset(null);
            this._native.destroyTTFSpriteFrame();
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

    get actualFontSize (): number { return this._native?.getActualFontSize() ?? this._actualFontSize; }
    set actualFontSize (value: number) { this._actualFontSize = value; this._native?.setActualFontSize(value); }

    get underlineHeight (): number { return this._underlineHeight; }
    set underlineHeight (value: number) { this._underlineHeight = value; this._native?.setUnderlineHeight(value); }

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

    @type(Font)
    get font (): any {
        return this._font;
    }

    /** @deprecated Use BitmapFont.fontSize directly. */
    get _bmFontOriginalSize (): number {
        return this._font instanceof BitmapFont ? this._font.fontSize : -1;
    }

    set font (value: any) {
        if (this._font === value) return;
        this._font = value;
        this._fontAtlas = null;
        this._isSystemFontUsed = !value;
        if (EDITOR) this._userDefinedFont = value;
        this._syncFont();
        this.updateRenderData(true);
        this._acquireLetterTexture();
    }

    get useSystemFont (): boolean {
        return this._isSystemFontUsed;
    }

    set useSystemFont (value: boolean) {
        if (this._isSystemFontUsed === value) return;
        if (EDITOR && !value && this._isSystemFontUsed && this._userDefinedFont) {
            this.font = this._userDefinedFont;
            return;
        }
        this._isSystemFontUsed = !!value;
        if (value && this._font) {
            this.font = null;
            return;
        }
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

    @type(CacheMode)
    get cacheMode (): CacheMode {
        return this._cacheMode;
    }

    set cacheMode (value: CacheMode) {
        if (this._cacheMode === value) return;
        this._releaseLetterTexture();
        this._cacheMode = value;
        this._native?.setCacheMode(value);
        this.updateRenderData(true);
        this._acquireLetterTexture();
    }

    get color (): Readonly<Color> {
        return this._color;
    }

    set color (value: Readonly<Color>) {
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
        if (this._native) {
            this._native.setMaterial(value);
            syncNativeMaterialSlots(this);
        }
    }

    get enableOutline (): boolean { return this._enableOutline; }
    set enableOutline (value: boolean) {
        this._enableOutline = value;
        this._native?.setEnableOutline(value);
    }

    get outlineColor (): Readonly<Color> { return this._outlineColor; }
    set outlineColor (value: Readonly<Color>) {
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
    set shadowColor (value: Readonly<Color>) {
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

    private _syncFont (): void {
        this._native?.setFontAsset(this._isSystemFontUsed ? null : this._font);
        this._native?.setFont(`${this._fontSize}px ${this._fontFamily}`);
        this._native?.setFontSize(this._fontSize);
    }

    private _syncAll (): void {
        this._native?.setString(this._string);
        this._syncFont();
        this._native?.setActualFontSize(this._actualFontSize);
        this._native?.setIsBold(this._isBold);
        this._native?.setIsItalic(this._isItalic);
        this._native?.setIsUnderline(this._isUnderline);
        this._native?.setUnderlineHeight(this._underlineHeight);
        this._native?.setLineHeight(this._lineHeight);
        this._native?.setEnableWrapText(this._enableWrapText);
        this._native?.setOverflow(this._overflow);
        this._native?.setHorizontalAlign(this._horizontalAlign);
        this._native?.setVerticalAlign(this._verticalAlign);
        this._native?.setSpacingX(this._spacingX);
        this._native?.setColorRGBA(this._color.r, this._color.g, this._color.b, this._color.a);
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

patchNativeMaterialAPIs(Label);
