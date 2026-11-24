module.exports = async function checkDefaultNativeEntry(cc, parent) {
    const {jsb, n2d} = globalThis;
    const assets = ['SpriteFrame', 'SpriteAtlas', 'Font', 'TTFFont', 'BitmapFont', 'LabelAtlas'];
    for (const name of assets) {
        if (typeof cc[name] !== 'function' || cc[name] !== jsb[name]) throw new Error('Asset binding: ' + name);
    }
    const components = ['UITransform', 'Sprite', 'Label', 'Graphics', 'Mask', 'RichText'];
    const nodes = [];
    for (const name of components) {
        const node = new cc.Node(name);
        parent.addChild(node);
        const component = node.addComponent(cc[name]);
        if (!(component._native instanceof n2d[name])) throw new Error('Component binding: ' + name);
        nodes.push(node);
    }
    for (const node of nodes) node.destroy();
    await new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    if (nodes.some(node => cc.isValid(node))) throw new Error('Default-entry nodes survived destruction');
    return {assets, components};
};
