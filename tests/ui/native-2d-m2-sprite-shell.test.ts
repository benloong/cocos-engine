import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { EDITOR } from 'internal:constants';
import { Sprite as WebSprite } from '../../cocos/2d/components/sprite';
import { deserialize, Details } from '../../cocos/serialization/deserialize';
import { instantiate } from '../../exports/base';
import { SpriteAtlas } from '../../cocos/2d/assets/sprite-atlas';
import { Color } from '../../cocos/core/math/color';

const nativeMaterial = { parent: null } as any;

const nativeSprite = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setColorRGBA: jest.fn(),
    setMaterial: jest.fn(),
    setSharedMaterial: jest.fn(),
    getSharedMaterial: jest.fn(() => ({})),
    getMaterialInstance: jest.fn(() => nativeMaterial),
    getRenderMaterial: jest.fn(() => nativeMaterial),
    setMaterialInstance: jest.fn(),
    setType: jest.fn(),
    setTrim: jest.fn(),
    setGrayscale: jest.fn(),
    refreshMaterial: jest.fn(),
    setFillType: jest.fn(),
    setFillStart: jest.fn(),
    setFillRange: jest.fn(),
    setFillCenter: jest.fn(),
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

beforeEach(() => { jest.clearAllMocks(); });

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
    expect(nativeSprite.setSharedMaterial).toHaveBeenLastCalledWith(material2, 1);
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

test('legacy Sprite atlas/style fields deserialize and clone independently of native objects', () => {
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
