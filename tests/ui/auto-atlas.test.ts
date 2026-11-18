import { director, DirectorEvent } from '../../cocos/game';
import { Sprite, SpriteFrame } from '../../cocos/2d';
import { DynamicAtlasManager, dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';
import { ImageAsset, RenderTexture, Texture2D } from '../../cocos/asset/assets';

function setPixels (texture: Texture2D, width: number, height: number): void {
    texture.image = new ImageAsset({
        _data: new Uint8Array(width * height * 4), width, height, format: Texture2D.PixelFormat.RGBA8888,
    } as any);
}

test('Pack to DynamicAtlas', function () {

    dynamicAtlasManager.enabled = true;
    let sprite = new Sprite();
    dynamicAtlasManager.packToDynamicAtlas(sprite,null);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    let spriteFrame_0 = new SpriteFrame();
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    let texture_0 = new Texture2D();
    spriteFrame_0.texture = texture_0;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    setPixels(texture_0, 1, 1);
    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);
});

test('Delete Atlas SpriteFrame', function () {

    dynamicAtlasManager.reset();

    let sprite = new Sprite();
    let spriteFrame_0 = new SpriteFrame();
    let texture_0 = new Texture2D();
    spriteFrame_0.texture = texture_0;
    setPixels(texture_0, 1, 1);
    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);

    dynamicAtlasManager.deleteAtlasSpriteFrame(spriteFrame_0);
    spriteFrame_0._resetDynamicAtlasFrame();
    expect(dynamicAtlasManager.atlasCount).toBe(0);
    expect(spriteFrame_0.original === null);

    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);

});

test('DynamicAtlasManager-insertSpriteFrame' ,function(){
    dynamicAtlasManager.reset();
    dynamicAtlasManager.enabled = true;
    dynamicAtlasManager.maxAtlasCount = 2;
    dynamicAtlasManager.textureSize = 500;

    for(let i = 0; i < 2 * 4; ++i) {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        setPixels(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        dynamicAtlasManager.insertSpriteFrame(spriteFrame);
    }
    {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        setPixels(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        expect(dynamicAtlasManager.insertSpriteFrame(spriteFrame)).toEqual(null);
    }
    {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        setPixels(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        expect(dynamicAtlasManager.insertSpriteFrame(spriteFrame)).toEqual(null);
    }

});
test('unpackable sources and failed placement leave existing page capacity usable', () => {
    const manager = new DynamicAtlasManager();
    manager.textureSize = 24;
    manager.maxAtlasCount = 1;
    manager.enabled = true;

    function frame (width: number, height: number): SpriteFrame {
        const texture = new Texture2D();
        setPixels(texture, width, height);
        const result = new SpriteFrame();
        result.texture = texture;
        result.packable = true;
        return result;
    }

    function expectOriginal (source: SpriteFrame): void {
        const texture = source.texture;
        manager.packToDynamicAtlas(null, source);
        expect(source.texture).toBe(texture);
        expect(source.original).toBeNull();
    }

    try {
        const gpuOnly = new Texture2D();
        gpuOnly.create(4, 4);
        const gpuOnlyFrame = new SpriteFrame();
        gpuOnlyFrame.texture = gpuOnly;
        gpuOnlyFrame.packable = true;
        expectOriginal(gpuOnlyFrame);
        const renderTexture = new RenderTexture();
        renderTexture.reset({ width: 4, height: 4 });
        const renderFrame = new SpriteFrame();
        renderFrame.texture = renderTexture;
        renderFrame.packable = true;
        expectOriginal(renderFrame);
        const compressed = frame(4, 4);
        const format = jest.spyOn(compressed.texture, 'isCompressed', 'get').mockReturnValue(true);
        try { expectOriginal(compressed); } finally { format.mockRestore(); }
        expectOriginal(frame(21, 4));
        expect(manager.atlasCount).toBe(0);

        const first = frame(12, 12);
        const shared = first.clone();
        manager.packToDynamicAtlas(null, first);
        expect(first.original).not.toBeNull();
        expectOriginal(frame(12, 12));
        const small = frame(4, 4);
        manager.packToDynamicAtlas(null, small);
        manager.packToDynamicAtlas(null, shared);
        expect(small.texture).toBe(first.texture);
        expect(shared.texture).toBe(first.texture);
        expect(manager.atlasCount).toBe(1);
        manager.reset();
        expect(first.original).toBeNull();
        expect(shared.original).toBeNull();
        expect(small.original).toBeNull();
    } finally {
        manager.enabled = false;
    }
});

test('removing packed frames preserves shared uploads and scene launch restores clones', () => {
    const manager = new DynamicAtlasManager();
    manager.textureSize = 16;
    manager.maxAtlasCount = 1;
    manager.enabled = true;
    const texture = new Texture2D();
    setPixels(texture, 4, 4);
    const source = new SpriteFrame();
    source.texture = texture;
    source.packable = true;
    const peer = source.clone();
    manager.packToDynamicAtlas(null, source);
    manager.packToDynamicAtlas(null, peer);
    const clone = source.clone();
    const page = source.texture;
    expect(clone.texture).toBe(page);

    try {
        manager.deleteAtlasSpriteFrame(source);
        expect(source.texture).toBe(texture);
        expect(peer.texture).toBe(page);
        expect(clone.texture).toBe(page);
        expect(manager.atlasCount).toBe(1);
        peer.destroy();
        expect(clone.texture).toBe(page);
        expect(manager.atlasCount).toBe(1);

        director.emit(DirectorEvent.BEFORE_SCENE_LAUNCH);
        expect(clone.texture).toBe(texture);
        expect(clone.original).toBeNull();
        expect(manager.atlasCount).toBe(0);

        manager.packToDynamicAtlas(null, clone);
        const copied = clone.clone();
        manager.deleteAtlasTexture(texture);
        expect(clone.texture).toBe(texture);
        expect(copied.texture).toBe(texture);
        expect(manager.atlasCount).toBe(0);
        copied.destroy();

        manager.packToDynamicAtlas(null, clone);
        clone._resetDynamicAtlasFrame();
        expect(clone.original).toBeNull();
        expect(manager.atlasCount).toBe(0);

        const replacement = new Texture2D();
        setPixels(replacement, 4, 4);
        manager.packToDynamicAtlas(null, clone);
        clone.texture = replacement;
        expect(clone.texture).toBe(replacement);
        expect(clone.original).toBeNull();
        expect(manager.atlasCount).toBe(0);
        clone.texture = texture;
        replacement.destroy();
    } finally {
        manager.enabled = false;
        source.destroy();
        clone.destroy();
        texture.destroy();
    }
});
