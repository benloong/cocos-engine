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
    for (const slots of [owner._materials, owner._materialInstances]) {
        const binding = materialViews.get(slots);
        if (binding) binding.owner = null;
    }
    for (const instance of owner._materialInstances as any[]) {
        if (instance && instance._owner === owner) instance._owner = null;
    }
    owner._native?.resizeMaterials(0);
    owner._materials.length = owner._materialInstances.length = 0;
}

export function syncNativeMaterialSlots (component: UIRenderer): void {
    const owner = component as Owner;
    const count = owner._native.getSharedMaterialCount();
    const instanceCount = owner._native.getMaterialInstanceCount();
    for (let i = 0; i < Math.max(instanceCount, owner._materialInstances.length); i++) {
        const current = i < instanceCount ? owner._native.getMaterialInstanceSlot(i) : null;
        const previous = owner._materialInstances[i] as any;
        if (previous && previous !== current && previous._owner === owner && previous._subModelIdx === i) {
            previous._owner = null;
        }
        if ((previous ?? null) !== current) owner._materialInstances[i] = current;
    }
    owner._materialInstances.length = instanceCount;
    owner._materials.length = count;
    for (let i = 0; i < count; i++) {
        const material = owner._native.getSharedMaterial(i);
        if ((owner._materials[i] ?? null) !== material) owner._materials[i] = material;
    }
    for (let i = 0; i < instanceCount; i++) {
        // An instance may occupy multiple slots. Retain its callback slot until that slot is replaced.
        const instance = owner._materialInstances[i] as any;
        if (instance?.parent && !instance._owner) Object.assign(instance, { _owner: owner, _subModelIdx: i });
    }
}

type SlotBinding = { owner: Owner | null; view: (Material | null)[] };
const materialViews = new WeakMap<(Material | null)[], SlotBinding>();

function slotIndex (key: PropertyKey): number {
    if (typeof key !== 'string') return -1;
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < 0xffffffff && String(index) === key ? index : -1;
}

function materialView (owner: Owner, shared: boolean): (Material | null)[] {
    const slots = shared ? owner._materials : owner._materialInstances;
    const existing = materialViews.get(slots);
    if (existing) return existing.view;
    const binding: SlotBinding = { owner, view: slots };
    function detachRemovedInstances (removed: (Material | null)[]): void {
        for (const value of removed) {
            const instance = value as any;
            if (!instance || !binding.owner || instance._owner !== binding.owner || slots[instance._subModelIdx] === instance) continue;
            const alias = slots.indexOf(instance);
            if (alias < 0) instance._owner = null;
            else instance._subModelIdx = alias;
        }
    }
    function write (key: PropertyKey): void {
        const component = binding.owner;
        if (!component?._native || slots !== (shared ? component._materials : component._materialInstances)) return;
        if (key === 'length') {
            component._native.resizeMaterialArray(shared, slots.length);
        } else {
            const index = slotIndex(key);
            if (index >= 0) component._native.writeMaterialSlot(shared, index, slots[index] ?? null);
        }
    }
    const view = new Proxy(slots, {
        defineProperty (target, key, descriptor) {
            const index = slotIndex(key);
            let removed: (Material | null)[] = [];
            if (!shared && index >= 0) removed = [target[index]];
            if (!shared && key === 'length' && descriptor.value < target.length) removed = target.slice(descriptor.value);
            if (!Reflect.defineProperty(target, key, descriptor)) return false;
            write(key);
            detachRemovedInstances(removed);
            const instance = descriptor.value;
            if (!shared && index >= 0 && instance?.parent && !instance._owner && binding.owner) {
                Object.assign(instance, { _owner: binding.owner, _subModelIdx: index });
            }
            return true;
        },
        deleteProperty (target, key) {
            const present = Object.prototype.hasOwnProperty.call(target, key);
            const previous = present && !shared ? Reflect.get(target, key) : null;
            if (!Reflect.deleteProperty(target, key)) return false;
            if (present) write(key);
            if (previous) detachRemovedInstances([previous]);
            return true;
        },
    });
    binding.view = view;
    materialViews.set(slots, binding);
    return view;
}

export function bindNativeMaterialSlots (component: UIRenderer): void {
    const owner = component as Owner;
    const shared = owner._materials.slice(), instances = owner._materialInstances.slice();
    owner._native.setMaterial(owner._customMaterial);
    for (let i = 0; i < shared.length; i++) {
        if (i === 0 && owner._customMaterial) continue;
        owner._native.setSharedMaterial(shared[i], i);
    }
    for (let i = 0; i < instances.length; i++) {
        if (instances[i]) owner._native.writeMaterialSlot(false, i, instances[i]);
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
            if (!this._native) return base.getSharedMaterial.call(this, index);
            const material = this._native.getSharedMaterial(index);
            if (material === null && index >= 0 && index < this._materials.length && this._materials[index] === undefined) return this._materials[index];
            return material;
        },
        setSharedMaterial (this: Owner, material: Material | null, index: number, forceUpdate = false): void {
            if (!this._native) { base.setSharedMaterial.call(this, material, index, forceUpdate); return; }
            this._native.setSharedMaterial(material, index, forceUpdate);
            this._materials[index] = material;
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
                return EDITOR ? this._materials.slice() : materialView(this, true);
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
                for (let i = 0; i < this._materials.length; i++) {
                    if (!this._native) this._materialInstances[i] = this.getMaterialInstance(i);
                    else if (this._materials[i]) this._native.getMaterialInstance(i);
                    else this._native.writeMaterialSlot(false, i, null);
                }
                if (this._native) syncNativeMaterialSlots(this);
                for (let i = 0; i < this._materials.length; i++) this._materialInstances[i] ??= null;
                return materialView(this, false);
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
