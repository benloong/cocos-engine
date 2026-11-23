import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { EDITOR } from 'internal:constants';
import { Sprite as WebSprite } from '../../cocos/2d/components/sprite';
import { deserialize, Details } from '../../cocos/serialization/deserialize';
import { instantiate } from '../../exports/base';
import { SpriteAtlas } from '../../cocos/2d/assets/sprite-atlas';
import { Vec2 } from '../../cocos/core/math/vec2';
import { Color } from '../../cocos/core/math/color';
import { Material } from '../../cocos/asset/assets/material';

const builtinMaterial = {} as any;
const nativeMaterial = { parent: builtinMaterial } as any;
let nativeShared: any[] = [], nativeInstances: any[] = [];

const nativeSprite = {
    setNode: jest.fn(),
    setColorRGBA: jest.fn(),
    setMaterial: jest.fn((material) => { nativeShared[0] = material ?? builtinMaterial; nativeInstances[0] = null; }),
    setSharedMaterial: jest.fn((material, index, force) => {
        if (force || nativeShared[index] !== material) nativeInstances[index] = null;
        nativeShared[index] = material;
    }),
    getSharedMaterial: jest.fn((index) => nativeShared[index] ?? null),
    getMaterialInstanceCount: jest.fn(() => nativeInstances.length),
    getMaterialInstanceSlot: jest.fn((i) => nativeInstances[i] ?? null),
    writeMaterialSlot: jest.fn((sharedSlot, i, value) => { (sharedSlot ? nativeShared : nativeInstances)[i] = value; }),
    resizeMaterialArray: jest.fn((sharedSlot, size) => { (sharedSlot ? nativeShared : nativeInstances).length = size; }),
    getSharedMaterialCount: jest.fn(() => nativeShared.length),
    resizeMaterials: jest.fn((size) => { nativeShared.length = nativeInstances.length = size; }),
    getMaterialInstance: jest.fn((index) => {
        if (nativeInstances[index]) return nativeInstances[index];
        if (!nativeShared[index]) return null;
        return nativeInstances[index] = index === 0 ? nativeMaterial : { parent: nativeShared[index] };
    }),
    getRenderMaterial: jest.fn((index) => nativeInstances[index] ?? nativeShared[index] ?? null),
    setMaterialInstance: jest.fn((material, index) => {
        if (material?.parent) nativeInstances[index] = material;
        else { nativeShared[index] = material; nativeInstances[index] = null; }
    }),
    setType: jest.fn(),
    setTrim: jest.fn(),
    setGrayscale: jest.fn(),
    refreshMaterial: jest.fn(),
    setFillType: jest.fn(),
    setFillStart: jest.fn(),
    setFillRange: jest.fn(),
    fillX: 0, fillY: 0,
    setFillCenter: jest.fn(function (x, y) { this.fillX=x; this.fillY=y; }),
    getFillCenterX: jest.fn(function () { return this.fillX; }),
    getFillCenterY: jest.fn(function () { return this.fillY; }),
    setSizeMode: jest.fn(),
    setSrcBlendFactor: jest.fn(),
    setDstBlendFactor: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setFrame: jest.fn(),
    clearFrame: jest.fn(),
};

beforeAll(() => {
    (global as any).n2d = {
        Sprite: jest.fn(() => nativeSprite),
    };
});

beforeEach(() => { jest.clearAllMocks(); nativeShared = []; nativeInstances = []; });

test('Sprite M2 shell attaches and forwards SIMPLE frame data', () => {
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb') as typeof import('../../cocos/2d/components/sprite.jsb');
    const node = new Node('sprite');
    node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite) as InstanceType<typeof Sprite>;

    sprite.onLoad();
    expect((global as any).n2d.Sprite).toHaveBeenCalled();
    expect(nativeSprite.setNode).toHaveBeenCalledWith(node);
    expect(nativeSprite.setType).toHaveBeenCalledWith(0);
    expect(nativeSprite.setFillType).toHaveBeenCalledWith(0);
    expect(nativeSprite.setFillRange).toHaveBeenCalledWith(0);
    expect(nativeSprite.setSizeMode).toHaveBeenCalledWith(1);
    expect(nativeSprite.setSrcBlendFactor).toHaveBeenCalled();
    expect(nativeSprite.setDstBlendFactor).toHaveBeenCalled();
    expect(nativeSprite.setColorRGBA).toHaveBeenCalledWith(255, 255, 255, 255);

    const texture = { width: 128, height: 256 };
    sprite.spriteFrame = {
        texture,
        uuid: 'frame-uuid',
        name: 'frame-name',
        rect: { x: 1, y: 2, width: 3, height: 4 },
        originalSize: { width: 5, height: 6 },
        offset: { x: 7, y: 8 },
        rotated: false,
        insetLeft: 1,
        insetRight: 2,
        insetTop: 3,
        insetBottom: 4,
    } as any;
    expect(nativeSprite.setFrame).toHaveBeenLastCalledWith(sprite.spriteFrame);

    sprite.spriteFrame = null;
    expect(nativeSprite.clearFrame).toHaveBeenCalled();

    sprite.color = new Color(10, 20, 30, 255);
    expect(nativeSprite.setColorRGBA).toHaveBeenLastCalledWith(10, 20, 30, 255);
    const material = {} as any;
    sprite.customMaterial = material;
    expect(nativeSprite.setMaterial).toHaveBeenLastCalledWith(material);
    const material2 = {} as any;
    sprite.setSharedMaterial(material2, 1);
    expect(nativeSprite.setSharedMaterial).toHaveBeenLastCalledWith(material2, 1, false);
    const instance = sprite.getMaterialInstance(0);
    expect(instance).toBe(nativeMaterial);
    const shared = sprite.getSharedMaterial(0);
    expect(shared).toEqual({});
    expect(nativeSprite.getSharedMaterial).toHaveBeenCalledWith(0);
    sprite.onDisable();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    sprite.onDestroy();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    expect(nativeSprite.setNode).toHaveBeenLastCalledWith(null);
});


test('Sprite metadata, enums and serialized defaults match Web', () => {
    const {Sprite} = require('../../cocos/2d/components/sprite.jsb');
    const web: any = new WebSprite(), native: any = new Sprite();
    for (const field of ['_spriteFrame','_type','_fillType','_sizeMode','_fillCenter','_fillStart','_fillRange','_isTrimmedMode','_useGrayscale','_atlas']) {
        expect(Sprite.__values__).toContain(field);
        expect(native[field]).toEqual(web[field]);
    }
    for (const name of ['FillType','Type','SizeMode','EventType']) expect(Sprite[name]).toEqual(WebSprite[name]);
});

test('Sprite API forwards trim/grayscale, clamps fill values, switches atlas frames and clears custom material', () => {
    const {Sprite} = require('../../cocos/2d/components/sprite.jsb');
    const node=new Node('sprite-api'); node.addComponent(UITransform);
    const sprite: any=node.addComponent(Sprite); sprite.onLoad();
    sprite.trim=false; sprite.grayscale=true;
    expect(nativeSprite.setTrim).toHaveBeenLastCalledWith(false);
    expect(nativeSprite.setGrayscale).toHaveBeenLastCalledWith(true);
    sprite.fillStart=2; sprite.fillRange=-2;
    expect(sprite.fillStart).toBe(1); expect(sprite.fillRange).toBe(-1);
    expect(nativeSprite.setFillStart).toHaveBeenLastCalledWith(1);
    expect(nativeSprite.setFillRange).toHaveBeenLastCalledWith(-1);
    const frame={texture:null};
    sprite.spriteAtlas={getSpriteFrame: jest.fn(() => frame)};
    const changed=jest.fn(); node.on(Sprite.EventType.SPRITE_FRAME_CHANGED,changed);
    sprite.changeSpriteFrameFromAtlas('hero');
    expect(sprite.spriteAtlas.getSpriteFrame).toHaveBeenCalledWith('hero');
    expect(sprite.spriteFrame).toBe(frame);
    expect(nativeSprite.setFrame).toHaveBeenLastCalledWith(frame);
    expect(changed).toHaveBeenCalledTimes(EDITOR?1:0);
    sprite.spriteFrame=frame;
    expect(changed).toHaveBeenCalledTimes(EDITOR?1:0);
    sprite.customMaterial={} as any; sprite.customMaterial=null;
    expect(nativeSprite.setMaterial).toHaveBeenLastCalledWith(null);
    sprite.changeMaterialForDefine(); expect(nativeSprite.refreshMaterial).toHaveBeenCalled();
    sprite.onDestroy();
});

test('Sprite atlas and style fields deserialize and clone independently of native objects', () => {
    const {Sprite}=require('../../cocos/2d/components/sprite.jsb');
    const details=new Details(); details.init();
    const sprite: any=deserialize([{__type__:'cc.Sprite',_atlas:{__uuid__:'atlas-id'},_isTrimmedMode:false,_useGrayscale:true,_fillRange:-0.5}], details, {classFinder:()=>Sprite});
    expect(details.uuidPropList).toEqual(['_atlas']);
    const atlas=new SpriteAtlas(); atlas._uuid='atlas-id';
    details.uuidObjList![0][details.uuidPropList![0]]=atlas;
    sprite.node=new Node('loaded-sprite'); sprite.node.addComponent(UITransform); sprite.onLoad();
    expect(nativeSprite.setTrim).toHaveBeenLastCalledWith(false);
    expect(nativeSprite.setGrayscale).toHaveBeenLastCalledWith(true);
    expect(nativeSprite.setFillRange).toHaveBeenLastCalledWith(-0.5);
    const clone: any=instantiate(sprite);
    expect(clone.spriteAtlas).toBe(atlas);
    expect(clone.trim).toBe(false); expect(clone.grayscale).toBe(true); expect(clone._native).toBeNull();
    sprite.onDestroy();
});


test('fillCenter is a native writable view, with independent clone and detached lifetime', () => {
    const {Sprite}=require('../../cocos/2d/components/sprite.jsb');
    const node=new Node('fill-center-view'); node.addComponent(UITransform);
    const sprite: any=node.addComponent(Sprite);
    const center=sprite.fillCenter;
    center.x=0.25; center.y=0.75;
    sprite.onLoad();
    expect(nativeSprite.setFillCenter).toHaveBeenCalledWith(0.25,0.75);
    expect(sprite.fillCenter).toBe(center);
    center.x=0.125; expect(nativeSprite.setFillCenter).toHaveBeenLastCalledWith(0.125,0.75);
    nativeSprite.setFillCenter(0.5,0.25);
    expect(center.equals(new Vec2(0.5,0.25))).toBe(true);
    sprite.fillCenter=new Vec2(0.75,0.5);
    expect(center.equals(new Vec2(0.75,0.5))).toBe(true);
    const clone: any=instantiate(sprite);
    expect(clone.fillCenter).not.toBe(center);
    expect(clone.fillCenter.equals(center)).toBe(true);
    clone.fillCenter.x=0;
    expect(center.x).toBe(0.75);
    sprite.onDestroy();
    expect(Object.getOwnPropertyDescriptor(center,'x')!.get).toBeUndefined();
    const calls=nativeSprite.setFillCenter.mock.calls.length;
    center.x=1.25;
    expect(nativeSprite.setFillCenter).toHaveBeenCalledTimes(calls);
    expect(center.y).toBe(0.5);
    const cloneCenter = clone.fillCenter;
    clone.onDestroy();
    expect(Object.getOwnPropertyDescriptor(cloneCenter, 'x')!.get).toBeUndefined();
    expect(cloneCenter.x).toBe(0);
});

test('material arrays retain staged slots, replace instances and release truncated owners', () => {
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb');
    const node = new Node('material-slots'); node.addComponent(UITransform);
    const sprite: any = node.addComponent(Sprite);
    const first = new Material(), second = new Material();
    sprite.sharedMaterials = [first, second];
    sprite.onLoad();
    expect(sprite.sharedMaterials).toEqual([first, second]);
    expect(sprite.materials).toHaveLength(2);
    const old = sprite.materials[1];
    expect(old._owner).toBe(sprite);
    expect(old._subModelIdx).toBe(1);
    const replacement: any = { parent: first, destroy: jest.fn() };
    sprite.materials = [replacement];
    expect(sprite.material).toBe(replacement);
    expect(old._owner).toBeNull();
    expect(nativeSprite.getSharedMaterialCount()).toBe(1);
    sprite.sharedMaterials = [];
    expect(sprite.sharedMaterials).toEqual([]);
    expect(sprite.materials).toEqual([]);
    expect(sprite.getRenderMaterial(0)).toBeNull();
    expect(replacement._owner).toBeNull();
    expect(replacement.destroy).not.toHaveBeenCalled();
    sprite.onDestroy();
});

test('shared array replacement, forced update and explicit null follow Web slots', () => {
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb');
    const node = new Node('material-parity'); node.addComponent(UITransform);
    const sprite: any = node.addComponent(Sprite), web: any = new WebSprite();
    sprite.onLoad();
    const first = new Material(), second = new Material();
    for (const values of [[first, second], [first], [null], [], [null, second]]) {
        sprite.sharedMaterials = values;
        web.sharedMaterials = values;
        expect(sprite.sharedMaterials).toEqual(web.sharedMaterials);
        for (let i = 0; i < 3; i++) expect(sprite.getSharedMaterial(i)).toBe(web.getSharedMaterial(i));
    }
    sprite.sharedMaterials = [first];
    const instance = sprite.material;
    sprite.setSharedMaterial(first, 0);
    expect(sprite.material).toBe(instance);
    sprite.setSharedMaterial(first, 0, true);
    expect(instance._owner).toBeNull();
    expect(sprite.getRenderMaterial(0)).toBe(first);
    sprite.setSharedMaterial(null, 0);
    expect(sprite.getRenderMaterial(0)).toBeNull();
    sprite.customMaterial = null;
    expect(sprite.getSharedMaterial(0)).toBe(builtinMaterial);
    sprite.onDestroy();
});

test('retained material views support pre-load edits and detach on destroy', () => {
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb');
    const node = new Node('retained-materials'); node.addComponent(UITransform);
    const sprite: any = node.addComponent(Sprite);
    const first = new Material(), second = new Material();
    sprite.sharedMaterials = [first];
    const shared = sprite.sharedMaterials;
    shared[0] = second;
    sprite.onLoad();
    expect(sprite.getSharedMaterial(0)).toBe(EDITOR ? first : second);
    const instances = sprite.materials;
    instances[0] = null;
    expect(sprite.getRenderMaterial(0)).toBe(EDITOR ? first : second);
    sprite.onDestroy();
    nativeSprite.writeMaterialSlot.mockClear();
    shared[0] = first;
    instances[0] = second;
    expect(nativeSprite.writeMaterialSlot).not.toHaveBeenCalled();
});
