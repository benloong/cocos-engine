module.exports = async function checkTransformEvents(cc, parent) {
    const nextFrame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const node = new cc.Node('transform-event-order');
    parent.addChild(node);
    const ui = node.addComponent(cc.UITransform);
    const native = ui._native;
    const sizes = [];
    node.on(cc.Node.EventType.SIZE_CHANGED, () => {
        if (ui.width !== native.getWidth() || ui.height !== native.getHeight()) throw new Error('Stale size during notification');
        sizes.push([ui.width, ui.height]);
        if (ui.width === 41) ui.width = 43;
    });
    const anchors = [];
    node.on(cc.Node.EventType.ANCHOR_CHANGED, anchor => {
        if (anchor.x !== native.getAnchorX() || anchor.y !== native.getAnchorY()) throw new Error('Stale anchor during notification');
        anchors.push([anchor.x, anchor.y]);
        if (anchor.x === 0.25) ui.anchorX = 0.75;
    });
    ui.setContentSize(new cc.Size(41, 29));
    ui.setContentSize(43, 29);
    native.setContentSizeXY(53, 31);
    ui.setAnchorPoint(new cc.Vec2(0.25, 0.125));
    ui.setAnchorPoint(0.75, 0.125);
    await nextFrame();
    if (JSON.stringify(sizes) !== '[[41,29],[43,29],[53,31]]'
        || JSON.stringify(anchors) !== '[[0.25,0.125],[0.75,0.125]]') throw new Error('Unexpected transform event sequence');
    ui.destroy();
    await nextFrame();
    const replacement = node.addComponent(cc.UITransform);
    const initial = [replacement.width, replacement.height];
    native.setContentSizeXY(61, 37);
    if (cc.isValid(ui) || replacement.width !== initial[0] || replacement.height !== initial[1] || sizes.length !== 3) {
        throw new Error('Retired native transform notified the replacement');
    }
    node.destroy();
    await nextFrame();
    return {sizes, anchors, detachedCallbackSilent: true};
};
