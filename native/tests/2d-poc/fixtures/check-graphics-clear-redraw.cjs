module.exports = async function checkGraphicsClearRedraw(cc, parent, target) {
    const nextFrame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const pixels = async () => {
        await nextFrame();
        return new Uint8Array(target.readPixels());
    };
    const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
    const node = new cc.Node('graphics-clear-redraw');
    node.layer = parent.layer;
    parent.addChild(node);
    const graphics = node.addComponent(cc.Graphics);
    const implementationFields = Object.fromEntries(['impl', 'model', 'graphicsNativeProxy'].map(name => [name, name in graphics]));
    graphics.fillColor = new cc.Color(237, 19, 87, 255);
    const background = await pixels();
    graphics.fillRect(-16, -12, 32, 24);
    const drawn = await pixels();
    if (drawn.length !== 256 * 256 * 4 || same(drawn, background)) throw new Error('Missing initial rectangle');
    for (let cycle = 0; cycle < 8; cycle++) {
        graphics.clear();
        if (!same(await pixels(), background)) throw new Error('Clear retained geometry at cycle ' + cycle);
        graphics.rect(-16, -12, 32, 24);
        graphics.fill();
        if (!same(await pixels(), drawn)) throw new Error('Redrawn geometry or fill style changed at cycle ' + cycle);
    }
    node.destroy();
    if (!same(await pixels(), background) || cc.isValid(graphics)) throw new Error('Destroyed graphics remained visible');
    return {cycles: 8, implementationFields};
};
