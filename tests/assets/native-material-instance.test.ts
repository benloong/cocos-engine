const materialCtor=jest.fn();
const register=jest.fn();
class NativeMaterial {
    constructor (public nativeParent: any = null) {}
    get parent () { return this.nativeParent; }
}
class NativeInstance extends NativeMaterial {
    passes = [];
    getPasses () { return this.passes; }
    _registerListeners () { register(this); }
    _destroy () { this.passes.length = 0; return true; }
}
beforeAll(() => {
    (NativeMaterial.prototype as any)._ctor=materialCtor;
    (global as any).jsb={Material:NativeMaterial,MaterialInstance:NativeInstance};
    require('../../cocos/render-scene/core/material-instance.jsb');
});
beforeEach(()=>jest.clearAllMocks());

test('native-created MaterialInstance initializes without constructor arguments',()=>{
    const parent=new NativeMaterial(); const instance: any=new NativeInstance(parent);
    instance._ctor();
    expect(materialCtor.mock.instances).toContain(instance);
    expect(register).toHaveBeenCalledWith(instance);
    expect(instance.parent).toBe(parent);
    expect(instance.owner).toBeNull();
    expect(instance._passes).toBe(instance.passes);
    instance._parent=null;
    expect(instance.parent).toBe(parent);
});

test('destroying a MaterialInstance delegates to native pass disposal', () => {
    const instance: any = new NativeInstance(new NativeMaterial());
    instance._ctor();
    instance.passes.push({});
    const dispose = jest.spyOn(instance, '_destroy');
    expect(instance.destroy()).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(instance.passes).toHaveLength(0);
    expect(instance._objFlags).toBeUndefined();
});

test('JS-created MaterialInstance retains owner and PSO notifications',()=>{
    const parent=new NativeMaterial(), owner={_onRebuildPSO:jest.fn()};
    const instance: any=new NativeInstance(parent);
    instance._ctor({parent,owner,subModelIdx:2}); instance._onRebuildPSO();
    expect(instance.owner).toBe(owner);
    expect(owner._onRebuildPSO).toHaveBeenCalledWith(2,instance);
    instance._owner=null; instance._onRebuildPSO();
    expect(owner._onRebuildPSO).toHaveBeenCalledTimes(1);
});
