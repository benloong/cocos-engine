import { cclegacy, Rect, Size, Vec2 } from '../../cocos/core';
import { SpriteFrame as WebSpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { AttributeName } from '../../cocos/gfx';

const defaults = {
    RectX: 0, RectY: 0, RectWidth: 0, RectHeight: 0,
    OriginalWidth: 0, OriginalHeight: 0, OffsetX: 0, OffsetY: 0,
    InsetLeft: 0, InsetRight: 0, InsetTop: 0, InsetBottom: 0,
    Rotated: false, FlipUVX: false, FlipUVY: false, Packable: true,
    PixelsToUnit: 100, PivotX: 0.5, PivotY: 0.5, MeshType: 0, AtlasUuid: '',
};
class NativeFrame {
    hasDynamicAtlasFrame (): boolean { return false; }
    data: Record<string, any> = { ...defaults };
    texture: any;
    emit = jest.fn();
    constructor () { (this as any)._ctor(); }
}
// Model native storage only. UV math is tested against Web with the C++ fixture.
const proto: any = NativeFrame.prototype;
for (const field of Object.keys(defaults)) {
    proto['get' + field] = function () { return this.data[field]; };
    proto['set' + field] = jest.fn(function (value) { this.data[field] = value; });
}
proto.isRotated = proto.getRotated;
proto.getTexture = function () { return this._testTexture ?? null; };
proto.setTexture = jest.fn(function (value) { this._testTexture = value; });
proto.setRect = jest.fn(function (x, y, width, height) {
    Object.assign(this.data, { RectX: x, RectY: y, RectWidth: width, RectHeight: height });
});
proto.setOriginalSize = jest.fn(function (width, height) {
    Object.assign(this.data, { OriginalWidth: width, OriginalHeight: height });
});
proto.setOffset = jest.fn(function (x, y) { Object.assign(this.data, { OffsetX: x, OffsetY: y }); });
proto.setInsets = jest.fn(function (left, right, top, bottom) {
    Object.assign(this.data, { InsetLeft: left, InsetRight: right, InsetTop: top, InsetBottom: bottom });
});
proto.resetFrame = jest.fn(function (clearData) {
    if (clearData) {
        for (const key of ['RectX', 'RectY', 'RectWidth', 'RectHeight', 'OriginalWidth', 'OriginalHeight',
            'OffsetX', 'OffsetY', 'InsetLeft', 'InsetRight', 'InsetTop', 'InsetBottom', 'Rotated']) this.data[key] = defaults[key];
    }
});
proto.resetTexture = jest.fn(function (texture) {
    this._testTexture = texture;
    if (texture) {
        this.data.RectWidth = texture.width;
        this.data.RectHeight = texture.height;
        this.data.RectX = this.data.RectY = 0;
        if (!this.data.OriginalWidth || !this.data.OriginalHeight) {
            this.data.OriginalWidth = texture.width;
            this.data.OriginalHeight = texture.height;
        }
    }
});
proto.resetWithTexture = jest.fn(function (texture) { this.resetFrame(true); this.resetTexture(texture); });
proto.loadTexture = jest.fn(function (texture) { this._testTexture = texture; });
proto.copyFrom = jest.fn(function (other) { this.data = { ...other.data }; this._testTexture = other._testTexture; });
proto.getUV = jest.fn(() => [0, 1, 1, 1, 0, 0, 1, 0]);
proto.getSlicedUV = jest.fn(() => [0, 1, 0.25, 1, 0.75, 1, 1, 1]);
const assetCtor = jest.fn();

test('Web generated mesh buffers, clone and texture refresh match the Windows JSB fixture', () => {
    const frame = new WebSpriteFrame();
    const texture = { width: 4, height: 4 } as any;
    frame.texture = texture;
    frame._deserialize({ rect: new Rect(1, 0, 2, 3), pixelsToUnit: 2, pivot: new Vec2(0.25, 0.75) }, null);
    expect(frame.mesh).toBeNull();
    frame.ensureMeshData();
    const mesh = frame.mesh!;
    const vertices = frame.vertices!;
    const positions = [-0.25, -1.125, 0, 0.75, -1.125, 0, -0.25, 0.375, 0, 0.75, 0.375, 0];
    expect(Array.from(mesh.readAttribute(0, AttributeName.ATTR_POSITION)!)).toEqual(positions);
    expect(Array.from(mesh.readAttribute(0, AttributeName.ATTR_TEX_COORD)!)).toEqual([0.25, 0.25, 0.75, 0.25, 0.25, 1, 0.75, 1]);
    expect(Array.from(mesh.readIndices(0)!)).toEqual([0, 1, 2, 2, 1, 3]);
    expect(vertices.uv).toEqual([1, 4, 3, 4, 1, 1, 3, 1]);
    expect(mesh.struct.minPosition).toMatchObject({ x: -0.25, y: -1.125, z: 0 });
    expect(mesh.struct.maxPosition).toMatchObject({ x: 0.75, y: 0.375, z: 0 });
    frame.ensureMeshData();
    frame.texture = texture;
    expect(frame.mesh).toBe(mesh);
    const clone = frame.clone();
    expect(clone.mesh).not.toBe(mesh);
    expect(Array.from(clone.mesh!.readAttribute(0, AttributeName.ATTR_POSITION)!)).toEqual(positions);
    frame.texture = { width: 8, height: 8 } as any;
    expect(frame.mesh).not.toBe(mesh);
    expect(frame.vertices).toBe(vertices);
    expect(vertices.rawPosition[0].x).toBe(-4);
    const polygon = new WebSpriteFrame();
    polygon._deserialize({ meshType: WebSpriteFrame.MeshType.POLYGON, pixelsToUnit: 100 }, null);
    polygon.ensureMeshData();
    expect(polygon.mesh!.struct.vertexBundles[0].view.count).toBe(0);
    expect(polygon.vertices!.indexes).toEqual([]);
});

test('authored polygon vertices survive Web and native serialization and cloning', () => {
    const vertices = {
        rawPosition: [-20, -18, 1, 20, -18, 2, 0, 18, 0], indexes: [0, 2, 1],
        uv: [0, 36, 40, 36, 20, 0], nuv: [0, 1, 1, 1, 0.5, 0],
        minPos: { x: -20, y: -18, z: 0 }, maxPos: { x: 20, y: 18, z: 2 },
    };
    const data = { vertices, pixelsToUnit: 4, rect: new Rect(0, 0, 40, 36), pivot: new Vec2(0.25, 0.75) };
    const positions = [-2.5, -6.75, 1, 7.5, -6.75, 2, 2.5, 2.25, 0];
    proto.transformMeshPositions = jest.fn(() => positions.slice());
    const frame = createFrame();
    const web = new WebSpriteFrame();
    web._deserialize(data, null);
    frame._deserialize(data);
    expect(proto.transformMeshPositions).toHaveBeenCalledWith(vertices.rawPosition);
    expect(web.vertices!.positions).toEqual(positions);
    expect(frame.vertices).toEqual(web.vertices);
    expect(frame._serialize().vertices).toEqual(vertices);
    const clone = frame.clone();
    expect(clone.vertices).toEqual(web.clone().vertices);
    clone.vertices.indexes.pop();
    clone.vertices.minPos.x = 0;
    expect(frame.vertices.indexes).toEqual([0, 2, 1]);
    expect(frame.vertices.minPos.x).toBe(-20);
});

beforeAll(() => {
    (global as any).jsb = { Asset: { prototype: { _ctor: assetCtor } }, SpriteFrame: NativeFrame };
});
beforeEach(() => { jest.clearAllMocks(); });

function createFrame (): any {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb');
    return new SpriteFrame();
}

test('SpriteFrame is the native asset, with no native property or JS field copies', () => {
    const frame = createFrame();
    expect(cclegacy.SpriteFrame).toBe(NativeFrame);
    expect(Object.getPrototypeOf(frame)).toBe(NativeFrame.prototype);
    expect(assetCtor.mock.instances).toContain(frame);
    for (const field of ['native', '_texture', '_rect', '_originalSize', '_offset', '_rotated', '_capInsets']) {
        expect(field in frame).toBe(false);
    }
    expect(frame.packable).toBe(true);
    expect(frame.pixelsToUnit).toBe(100);
    expect(frame.pivot).toEqual(new Vec2(0.5, 0.5));
});

test('math views write through and observe native mutations without replacing references', () => {
    const frame = createFrame();
    const rect = frame.rect;
    const size = frame.originalSize;
    const offset = frame.offset;
    const pivot = frame.pivot;
    rect.set(1, 2, 3, 4);
    size.set(5, 6);
    offset.x = 7;
    offset.y = 8;
    pivot.set(0, 1);
    expect(frame.getRectWidth()).toBe(3);
    expect(frame.getOriginalWidth()).toBe(5);
    expect(frame.getOffsetX()).toBe(7);
    frame.setRectWidth(20);
    frame.setOriginalHeight(30);
    expect(rect.width).toBe(20);
    expect(size.height).toBe(30);
    frame.rect = new Rect(9, 8, 7, 6);
    expect(frame.rect).toBe(rect);
    const out = new Rect();
    expect(frame.getRect(out)).toBe(out);
    expect(out).toEqual(new Rect(9, 8, 7, 6));
    expect(frame.getRect()).not.toBe(rect);
    expect(createFrame().offset).toEqual(new Vec2());
});

test('UV arrays and sliced pairs are obtained from native, not calculated by the shell', () => {
    const frame = createFrame();
    expect(frame.uv).toEqual(proto.getUV());
    expect(frame.unbiasUV).toEqual(frame.uv);
    expect(frame.uvSliced).toEqual([{ u: 0, v: 1 }, { u: 0.25, v: 1 }, { u: 0.75, v: 1 }, { u: 1, v: 1 }]);
    frame.texture = { width: 128, height: 256 };
    frame._calculateUV();
    expect(frame.emit).toHaveBeenCalledWith('uv_updated', frame);
});

test('reset preserves geometry unless clearData is explicitly requested', () => {
    const frame = createFrame();
    const rect = frame.rect;
    frame.reset({ texture: { width: 128, height: 256 }, rect: new Rect(1, 2, 3, 4),
        originalSize: new Size(5, 6), offset: new Vec2(7, 8), isRotate: true,
        isFlipUv: true, borderLeft: 10, borderRight: 20, borderTop: 30, borderBottom: 40 }, true);
    expect(frame.width).toBe(128);
    expect(frame.height).toBe(256);
    expect(frame.rect).toEqual(new Rect(1, 2, 3, 4));
    expect(frame.rotated).toBe(true);
    expect(frame.flipUVY).toBe(true);
    expect(frame.insetRight).toBe(20);
    frame.reset();
    expect(frame.rect).toEqual(new Rect(1, 2, 3, 4));
    frame.reset(undefined, true);
    expect(frame.rect).toBe(rect);
    expect(frame.rect).toEqual(new Rect());
    expect(frame.offset).toEqual(new Vec2());
    expect(frame.rotated).toBe(false);
});

test('clone delegates the value copy to native and has independent math views', () => {
    const frame = createFrame();
    const texture = { width: 128, height: 256 };
    frame.texture = texture;
    frame.rect = new Rect(1, 2, 30, 40);
    frame.flipUVX = true;
    frame.insetLeft = 5;
    frame.pivot = new Vec2(0.2, 0.8);
    frame.atlasUuid = 'atlas';
    const clone = frame.clone();
    expect(proto.copyFrom).toHaveBeenCalledWith(frame);
    expect(clone.texture).toBe(texture);
    expect(clone.rect).toEqual(frame.rect);
    expect(clone.rect).not.toBe(frame.rect);
    expect(clone.flipUVX).toBe(true);
    expect(clone.atlasUuid).toBe('atlas');
    clone.rect.width = 10;
    clone.insetLeft = 2;
    clone.pivot.x = 0;
    expect(frame.rect.width).toBe(30);
    expect(frame.insetLeft).toBe(5);
    expect(frame.pivot.x).toBe(0.2);
});

test('deserialization preserves defaults and resolves texture without resetting serialized geometry', () => {
    const frame = createFrame();
    const push = jest.fn();
    frame._deserialize({ name: 'frame', atlas: 'atlas', texture: 'tex-id',
        rect: { x: 1, y: 2, width: 3, height: 4 }, offset: { x: 5, y: 6 },
        originalSize: { width: 7, height: 8 }, rotated: true, capInsets: [9, 10, 11, 12] }, { result: { push } });
    expect(push).toHaveBeenCalledWith(frame, '_textureSource', 'tex-id', expect.any(String));
    const texture = { width: 128, height: 256, _uuid: 'tex-id' };
    frame._textureSource = texture;
    expect(proto.loadTexture).toHaveBeenLastCalledWith(texture);
    expect(frame.rect).toEqual(new Rect(1, 2, 3, 4));
    const data = frame._serialize();
    expect(data.capInsets).toEqual([9, 10, 11, 12]);
    expect(data.texture).toBe('tex-id');
    expect(data.packable).toBe(true);
    expect(data.pixelsToUnit).toBe(100);
    expect(data.pivot).toEqual({ x: 0.5, y: 0.5 });
    const roundTrip = createFrame();
    roundTrip._deserialize(data);
    roundTrip._textureSource = texture;
    expect(roundTrip._serialize()).toEqual(data);
    const dependsOn = jest.fn();
    const exported = frame._serialize({ dependsOn });
    expect(dependsOn).toHaveBeenCalledWith('_textureSource', 'tex-id');
    expect(exported.texture).toBeUndefined();
    expect(exported.atlas).toBeUndefined();
});
