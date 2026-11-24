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
        child.setRotationFromEuler(0, 0, 90);
        ui.setContentSize(10, 12);
        ui.setAnchorPoint(0, 0);
        const descendant = new cc.Node('outside-self-bounds');
        child.addChild(descendant);
        descendant.setPosition(200, 0, 0);
        descendant.addComponent(cc.UITransform).setContentSize(20, 20);
        const bounds = ui.getComputeAABB();
        if (!near(bounds.center, -22, 19, 14) || !near(bounds.halfExtents, 18, 10, 0.001)
            || ui.getBoundingBoxToWorld().height <= 20) throw new Error('Self and subtree bounds disagree with expected geometry');
        parent.setPosition(-5, 7, -12);
        if (ui.getComputeAABB(bounds) !== bounds || !near(bounds.center, -22, 19, -9)) throw new Error('Stale depth in caller-owned AABB');
        return {nested: true, parentMoved: true, inPlace: true, inputPreserved: true, selfBounds: true};
    } finally {
        parent.destroy();
    }
};
