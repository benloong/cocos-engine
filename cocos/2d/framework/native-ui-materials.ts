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

import { EDITOR } from 'internal:constants';
import { warnID } from '../../core';
import type { Material } from '../../asset/assets/material';
import type { MaterialInstance } from '../../render-scene/core/material-instance';
import type { UIRenderer } from './ui-renderer';

// Component identity and serialized references stay in JS. All live material
// slots and instances belong to native; arrays here are API compatibility views.
type Owner = UIRenderer & {
    _native: any;
    _materials: (Material | null)[];
    _materialInstances: (MaterialInstance | null)[];
    _customMaterial: Material | null;
};

export function releaseNativeMaterialSlots (component: UIRenderer): void {
    const owner = component as Owner;
    for (const instance of owner._materialInstances as any[]) {
        if (instance && instance._owner === owner) instance._owner = null;
    }
    owner._native?.resizeMaterials(0);
    owner._materials.length = owner._materialInstances.length = 0;
}

export function syncNativeMaterialSlots (component: UIRenderer): void {
    const owner = component as Owner;
    const count = owner._native.getSharedMaterialCount();
    for (let i = 0; i < Math.max(count, owner._materialInstances.length); i++) {
        const rendered = i < count ? owner._native.getRenderMaterial(i) : null;
        const current = rendered?.parent ? rendered : null;
        const previous = owner._materialInstances[i] as any;
        if (previous && previous !== current && previous._owner === owner && previous._subModelIdx === i) {
            previous._owner = null;
        }
        owner._materialInstances[i] = current;
    }
    owner._materialInstances.length = owner._materials.length = count;
    for (let i = 0; i < count; i++) {
        owner._materials[i] = owner._native.getSharedMaterial(i);
        // An instance may occupy multiple slots. Retain its callback slot until that slot is replaced.
        const instance = owner._materialInstances[i] as any;
        if (instance && !instance._owner) Object.assign(instance, { _owner: owner, _subModelIdx: i });
    }
}

export function bindNativeMaterialSlots (component: UIRenderer): void {
    const owner = component as Owner;
    const shared = owner._materials.slice(), instances = owner._materialInstances.slice();
    owner._native.setMaterial(owner._customMaterial);
    for (let i = 0; i < shared.length; i++) {
        if (i === 0 && owner._customMaterial) continue;
        owner._native.setSharedMaterial(shared[i], i);
        if (instances[i]) owner._native.setMaterialInstance(instances[i], i);
    }
    syncNativeMaterialSlots(component);
}

function resizeMaterialSlots (owner: Owner, size: number): void {
    if (owner._native) {
        owner._native.resizeMaterials(size);
        syncNativeMaterialSlots(owner);
    } else {
        owner._materials.length = owner._materialInstances.length = size;
    }
}

/** Install the same explicit API bridges on native-backed component shells. */
export function patchNativeMaterialAPIs (Component: typeof UIRenderer): void {
    const proto = Component.prototype as any;
    const base = Object.getPrototypeOf(proto);
    Object.assign(proto, {
        getSharedMaterial (this: Owner, index = 0): Material | null {
            return this._native ? this._native.getSharedMaterial(index) : base.getSharedMaterial.call(this, index);
        },
        setSharedMaterial (this: Owner, material: Material | null, index: number, forceUpdate = false): void {
            if (!this._native) { base.setSharedMaterial.call(this, material, index, forceUpdate); return; }
            this._native.setSharedMaterial(material, index, forceUpdate);
            syncNativeMaterialSlots(this);
        },
        getMaterialInstance (this: Owner, index = 0): MaterialInstance | null {
            if (!this._native) return base.getMaterialInstance.call(this, index);
            const instance = this._native.getMaterialInstance(index);
            syncNativeMaterialSlots(this);
            return instance;
        },
        setMaterialInstance (this: Owner, material: Material | MaterialInstance | null, index = 0): void {
            if (typeof material === 'number') {
                warnID(12007);
                const oldIndex = material;
                material = index as any; index = oldIndex;
            }
            if (!this._native) { base.setMaterialInstance.call(this, material, index); return; }
            this._native.setMaterialInstance(material, index);
            syncNativeMaterialSlots(this);
        },
        getRenderMaterial (this: Owner, index = 0): Material | null {
            return this._native ? this._native.getRenderMaterial(index) : base.getRenderMaterial.call(this, index);
        },
    });
    Object.defineProperties(proto, {
        sharedMaterials: {
            configurable: true,
            get (this: Owner): (Material | null)[] {
                if (this._native) syncNativeMaterialSlots(this);
                return EDITOR ? this._materials.slice() : this._materials;
            },
            set (this: Owner, values: (Material | null)[]) {
                const shared = values.slice();
                if (this._native) syncNativeMaterialSlots(this);
                for (let i = 0; i < shared.length; i++) this.setSharedMaterial(shared[i], i);
                for (let i = shared.length; i < this._materials.length; i++) this.setSharedMaterial(null, i);
                resizeMaterialSlots(this, shared.length);
            },
        },
        materials: {
            configurable: true,
            get (this: Owner): (Material | MaterialInstance | null)[] {
                if (this._native) syncNativeMaterialSlots(this);
                for (let i = 0; i < this._materials.length; i++) this.getMaterialInstance(i);
                return this._materialInstances;
            },
            set (this: Owner, values: (Material | MaterialInstance | null)[]) {
                const instances = values.slice();
                if (this._native) syncNativeMaterialSlots(this);
                for (let i = instances.length; i < this._materials.length; i++) this.setMaterialInstance(null, i);
                for (let i = 0; i < instances.length; i++) this.setMaterialInstance(instances[i], i);
                resizeMaterialSlots(this, instances.length);
            },
        },
    });
}
