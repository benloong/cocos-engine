// Run inside the Native application with the bundled M6StaticAtlas resource.
module.exports = async function checkAtlasSceneRelease(cc) {
    const { director, Director, Scene, Node, Sprite, SpriteAtlas, resources, assetManager, isValid } = cc;
    const frame = () => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
    const load = expectedScene => new Promise((resolve, reject) => {
        resources.load('M6StaticAtlas/colors', SpriteAtlas, (error, atlas) => {
            if (error) reject(error);
            else if (director.getScene() !== expectedScene) reject(new Error('Callback delivered in the wrong scene'));
            else resolve(atlas);
        });
    });
    let previousAtlas = null;
    for (let cycle = 0; cycle < 32; cycle++) {
        const outgoing = new Scene('atlas-requester');
        director.runSceneImmediate(outgoing);
        const incoming = new Scene('atlas-consumer');
        const request = load(incoming);
        director.runSceneImmediate(incoming);
        const [late, atlas] = await Promise.all([request, load(incoming)]);
        if (isValid(outgoing) || director.getScene() !== incoming || late !== atlas || atlas === previousAtlas) {
            throw new Error('Unexpected scene or atlas identity at cycle ' + cycle);
        }
        atlas.addRef();
        const shared = atlas.getSpriteFrame('left');
        const texture = shared.texture;
        const node = new Node('shared-frame');
        incoming.addChild(node);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = shared;
        await frame();
        if (sprite.spriteFrame !== shared || !texture.getGFXTexture()) throw new Error('Missing live frame or texture');
        director.runSceneImmediate(new Scene('atlas-released'));
        await frame();
        if (isValid(sprite) || isValid(node) || isValid(incoming) || !isValid(shared) || !isValid(atlas)) {
            throw new Error('Scene retirement lost a retained asset or kept the consumer alive');
        }
        const id = atlas.uuid;
        atlas.decRef();
        for (let i = 0; i < 8 && isValid(atlas); i++) await frame();
        if (isValid(atlas) || assetManager.assets.has(id) || isValid(shared) || isValid(texture)) {
            throw new Error('Last owner release retained an atlas dependency at cycle ' + cycle);
        }
        previousAtlas = atlas;
    }
    return {cycles: 32, requestsAcrossSceneChanges: 32, releasedDependencyChains: 32};
};
