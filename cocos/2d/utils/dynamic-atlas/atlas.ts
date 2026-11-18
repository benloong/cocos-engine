/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

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

import { PixelFormat } from '../../../asset/assets/asset-enum';
import { ImageAsset } from '../../../asset/assets/image-asset';
import { Texture2D } from '../../../asset/assets/texture-2d';
import { BufferTextureCopy } from '../../../gfx';
import { cclegacy, js, warnID } from '../../../core';
import { SpriteFrame } from '../../assets/sprite-frame';

const space = 2;

function drawTextureAt (texture: DynamicAtlasTexture, image: ImageAsset, x: number, y: number): void {
    texture.drawTextureAt(image, x, y);
}

export class Atlas {
    public static fits (texture: Texture2D, width: number, height: number): boolean {
        return texture.width + space * 2 <= width && texture.height + space * 2 <= height;
    }

    private declare _texture: DynamicAtlasTexture;
    private declare _width: number;
    private declare _height: number;
    private declare _x: number;
    private declare _y: number;
    private declare _nextY: number;
    private _innerTextureInfos: Record<string, {
            x: number,
            y: number,
            texture: Texture2D,
        }> = {};
    private _innerSpriteFrames: SpriteFrame[] = [];
    private _count: number = 0;

    constructor (width: number, height: number) {
        const texture = new DynamicAtlasTexture();
        texture.initWithSize(width, height);
        this._texture = texture;

        this._width = width;
        this._height = height;

        this._x = space;
        this._y = space;
        this._nextY = space;
    }

    /**
     * @en
     * Append a sprite frame into the dynamic atlas.
     *
     * @zh
     * 添加碎图进入动态图集。
     *
     * @method insertSpriteFrame
     * @param spriteFrame  the sprite frame that will be inserted in the atlas.
     */
    public insertSpriteFrame (spriteFrame: SpriteFrame, texture: Texture2D): {
        x: number;
        y: number;
        texture: DynamicAtlasTexture;
    } | null {
        const rect = spriteFrame.rect;
        const info = this._innerTextureInfos[texture.getId()];

        let sx = rect.x;
        let sy = rect.y;

        if (info) {
            sx += info.x;
            sy += info.y;
        } else {
            const width = texture.width;
            const height = texture.height;

            if (!Atlas.fits(texture, this._width, this._height)) return null;

            let x = this._x;
            let y = this._y;
            if (x + width + space > this._width) {
                x = space;
                y = this._nextY;
            }
            const nextY = Math.max(this._nextY, y + height + space);
            if (nextY > this._height) return null;

            const thisTexture = this._texture;
            const image = texture.image!;

            if (cclegacy.internal.dynamicAtlasManager.textureBleeding) {
                // Smaller frame is more likely to be affected by linear filter
                if (width <= 8 || height <= 8) {
                    drawTextureAt(thisTexture, image, x - 1, y - 1);
                    drawTextureAt(thisTexture, image, x - 1, y + 1);
                    drawTextureAt(thisTexture, image, x + 1, y - 1);
                    drawTextureAt(thisTexture, image, x + 1, y + 1);
                }

                drawTextureAt(thisTexture, image, x - 1, y);
                drawTextureAt(thisTexture, image, x + 1, y);
                drawTextureAt(thisTexture, image, x, y - 1);
                drawTextureAt(thisTexture, image, x, y + 1);
            }

            drawTextureAt(thisTexture, image, x, y);

            this._innerTextureInfos[texture.getId()] = {
                x: x,
                y: y,
                texture,
            };

            this._count++;

            sx += x;
            sy += y;

            this._x = x + width + space;
            this._y = y;
            this._nextY = nextY;
        }

        const frame = {
            x: sx,
            y: sy,
            texture: this._texture,
        };

        this._innerSpriteFrames.push(spriteFrame);

        return frame;
    }

    public hasTexture (texture: Texture2D): boolean {
        return !!this._innerTextureInfos[texture.getId()];
    }

    public removeSpriteFrame (spriteFrame: SpriteFrame): void {
        js.array.fastRemove(this._innerSpriteFrames, spriteFrame);
    }

    /**
     * @en
     * Delete a texture from the atlas.
     *
     * @zh
     * 从动态图集中删除某张纹理。
     *
     * @method deleteAtlasTexture
     * @param texture  the texture that will be removed from the atlas.
     */
    public deleteInnerTexture (texture: Texture2D): void {
        if (texture && this._innerTextureInfos[texture.getId()]) {
            delete this._innerTextureInfos[texture.getId()];
            this._count--;
        }
    }

    /**
     * @en
     * Whether the atlas is empty.
     *
     * @zh
     * 图集是否为空图集。
     *
     * @method isEmpty
     */
    public isEmpty (): boolean {
        return this._count <= 0;
    }

    /**
     * @en
     * Reset the dynamic atlas.
     *
     * @zh
     * 重置该动态图集。
     *
     * @method reset
    */
    public reset (): void {
        this._x = space;
        this._y = space;
        this._nextY = space;

        const frames = this._innerSpriteFrames;
        for (let i = 0, l = frames.length; i < l; i++) {
            const frame = frames[i];
            if (!frame.isValid) {
                continue;
            }
            frame._resetDynamicAtlasFrame();
        }
        this._innerSpriteFrames.length = 0;
        this._innerTextureInfos = {};
        this._count = 0;
    }

    /**
     * @en
     * Reset the dynamic atlas, and destroy the texture of the atlas.
     *
     * @zh
     * 重置该动态图集，并销毁该图集的纹理。
     *
     * @method destroy
    */
    public destroy (): void {
        this.reset();
        this._texture.destroy();
    }
}

export class DynamicAtlasTexture extends Texture2D {
    /**
     * @en
     * Initialize the render texture.
     *
     * @zh
     * 初始化 render texture。
     *
     * @method initWithSize
     */
    public initWithSize (width: number, height: number, format: number = PixelFormat.RGBA8888): void {
        this.reset({
            width,
            height,
            format,
        });
    }

    /**
     * @en
     * Draw a texture to the specified position.
     *
     * @zh
     * 将指定的图片渲染到指定的位置上。
     *
     * @method drawTextureAt
     * @param {Texture2D} image
     * @param {Number} x
     * @param {Number} y
     */
    public drawTextureAt (image: ImageAsset, x: number, y: number): void {
        const gfxTexture = this.getGFXTexture();
        if (!image || !gfxTexture) {
            return;
        }

        const gfxDevice = this._getGFXDevice();
        if (!gfxDevice) {
            warnID(16363);
            return;
        }

        const region = new BufferTextureCopy();
        region.texOffset.x = x;
        region.texOffset.y = y;
        region.texExtent.width = image.width;
        region.texExtent.height = image.height;
        const data = image.data;
        if (ArrayBuffer.isView(data)) {
            // Memory-backed ImageAssets carry pixels, not DOM/native images.
            // Keep the view (including its byte offset) for the buffer API.
            gfxDevice.copyBuffersToTexture([data], gfxTexture, [region]);
        } else {
            gfxDevice.copyTexImagesToTexture([data as HTMLCanvasElement], gfxTexture, [region]);
        }
    }
}
