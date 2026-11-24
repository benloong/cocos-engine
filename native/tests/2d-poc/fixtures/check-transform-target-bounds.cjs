module.exports = function checkTargetBounds(cc) {
    const scene = cc.director.getScene();
    const source = new cc.Node('bounds-source');
    const target = new cc.Node('bounds-target');
    scene.addChild(source);
    scene.addChild(target);
    try {
        target.setPosition(4, 8, 0);
        target.setRotationFromEuler(0, 0, 90);
        target.setScale(2, 4, 1);
        const ui = source.addComponent(cc.UITransform);
        ui.setContentSize(8, 4);
        ui.setAnchorPoint(0, 0);
        const child = new cc.Node('bounds-child');
        source.addChild(child);
        const childUI = child.addComponent(cc.UITransform);
        childUI.setAnchorPoint(1, 1);
        childUI.setContentSize(12, 6);
        const grandchild = new cc.Node('bounds-grandchild');
        child.addChild(grandchild);
        grandchild.setPosition(100, 100, 0);
        grandchild.addComponent(cc.UITransform);
        const results = [];
        function check(expected) {
            const box = ui.getBoundingBoxTo(target.worldMatrix);
            const actual = [box.x, box.y, box.width, box.height];
            if (!actual.every((n, i) => Math.abs(n - expected[i]) < 0.0001)) {
                throw new Error('Unexpected target bounds: ' + actual + ', expected ' + expected);
            }
            results.push(actual);
        }
        // The target transforms world (x,y) to ((y-8)/2,(4-x)/4).
        check([-7, -1, 5, 5]);
        child.active = false;
        check([-4, -1, 2, 2]);
        child.active = true;
        childUI.width = 0;
        check([-4, -1, 2, 2]);
        childUI.width = 12;
        ui.height = 0;
        check([-7, 1, 3, 3]);
        return results;
    } finally {
        source.destroy();
        target.destroy();
    }
};
