module.exports = function checkTransformDepth(cc) {
    const parent = new cc.Node('xyz-parent');
    cc.director.getScene().addChild(parent);
    const child = new cc.Node('xyz-child');
    parent.addChild(child);
    const ui = child.addComponent(cc.UITransform);
    const input = new cc.Vec3(2, 3, 5);
    const near = (v, x, y, z) => Math.abs(v.x - x) < 0.0001 && Math.abs(v.y - y) < 0.0001 && Math.abs(v.z - z) < 0.0001;
    try {
        parent.setPosition(50, 50, 0);
        child.setPosition(1, 2, 3);
        child.setRotationFromEuler(90, 0, 0);
        child.setScale(2, 3, 4);
        const world = ui.convertToWorldSpaceAR(input);
        if (world === input || !near(input, 2, 3, 5) || !near(world, 55, 32, 12)) throw new Error('Incorrect nested world coordinates');
        if (ui.convertToNodeSpaceAR(world, world) !== world || !near(world, 2, 3, 5)) throw new Error('Incorrect inverse or output identity');
        parent.setPosition(-5, 7, 11);
        if (ui.convertToWorldSpaceAR(world, world) !== world || !near(world, 0, -11, 23)) throw new Error('Stale transform after moving parent');
        const restored = ui.convertToNodeSpaceAR(world);
        if (restored === world || !near(restored, 2, 3, 5)) throw new Error('Incorrect inverse after moving parent');
        return {nested: true, parentMoved: true, inPlace: true, inputPreserved: true};
    } finally {
        parent.destroy();
    }
};
