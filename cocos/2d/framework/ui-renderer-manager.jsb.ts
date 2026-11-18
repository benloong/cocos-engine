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

import type { UIMeshRenderer } from '../components/ui-mesh-renderer';
import type { UIRenderer } from './ui-renderer';

type Renderer = UIRenderer | UIMeshRenderer;
interface NativeManager {
    addRenderer(): number;
    removeRenderer(id: number): void;
    markDirtyRenderer(id: number, flags: number): void;
    takeDirtyRenderers(): number[];
}
declare const n2d: { UIRendererManager: new () => NativeManager };

/** @mangle */
export class UIRendererManager {
    private _native?: NativeManager;
    private readonly _renderers: ({ renderer: Renderer } | undefined)[] = [];
    private _dirtyVersion = 0;
    private _pending = false;
    private _updating = false;

    public addRenderer (renderer: Renderer): void {
        if (renderer._internalId !== -1) return;
        const native = this._native ??= new n2d.UIRendererManager();
        const id = native.addRenderer();
        this._renderers[id] = { renderer };
        renderer._internalId = id;
    }

    public removeRenderer (renderer: Renderer): void {
        const id = renderer._internalId;
        if (id === -1) return;
        this._native!.removeRenderer(id);
        this._renderers[id] = undefined;
        renderer._internalId = -1;
        renderer._dirtyVersion = -1;
    }

    public markDirtyRenderer (renderer: Renderer): void {
        if (renderer._internalId === -1 || renderer._dirtyVersion === this._dirtyVersion) return;
        this._native!.markDirtyRenderer(renderer._internalId, 1);
        renderer._dirtyVersion = this._dirtyVersion;
        this._pending = true;
    }

    public updateAllDirtyRenderers (): void {
        if (!this._pending || this._updating) return;
        this._updating = true;
        try {
            while (this._pending) {
                this._pending = false;
                // Capture registrations before callbacks can disable components and reuse their slots.
                const batch = this._native!.takeDirtyRenderers().map((id) => this._renderers[id]!);
                for (let i = 0; i < batch.length; ++i) {
                    const entry = batch[i];
                    if (this._renderers[entry.renderer._internalId] !== entry) continue;
                    try {
                        entry.renderer.updateRenderer();
                    } catch (error) {
                        for (const pending of batch.slice(i)) {
                            const id = pending.renderer._internalId;
                            if (this._renderers[id] === pending) {
                                this._native!.markDirtyRenderer(id, 1);
                                this._pending = true;
                            }
                        }
                        throw error;
                    }
                }
            }
            ++this._dirtyVersion;
        } finally {
            this._updating = false;
        }
    }
}

export const uiRendererManager = new UIRendererManager();
