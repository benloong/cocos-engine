module.exports = function checkMaskPendingFrame(cc) {
    const frame = new cc.SpriteFrame();
    const hostFrame = new cc.SpriteFrame();
    const results = [];
    try {
        for (const pending of ['unset', 'frame', 'null']) {
            const node = new cc.Node('pending-' + pending);
            try {
                const host = node.addComponent(cc.Sprite);
                host.spriteFrame = hostFrame;
                const mask = node.addComponent(cc.Mask);
                if (pending !== 'unset') mask.spriteFrame = frame;
                if (pending === 'null') mask.spriteFrame = null;
                mask.type = cc.Mask.Type.SPRITE_STENCIL;
                const expected = pending === 'unset' ? hostFrame : pending === 'frame' ? frame : null;
                const check = () => {
                    if (mask.subComp !== host || mask.spriteFrame !== expected || host.spriteFrame !== expected) {
                        throw new Error('Unexpected host Sprite or frame for ' + pending);
                    }
                };
                check();
                cc.director.getScene().addChild(node);
                check();
                mask.type = cc.Mask.Type.GRAPHICS_RECT;
                mask.type = cc.Mask.Type.SPRITE_STENCIL;
                if (mask.subComp === host || !mask.subComp || mask.spriteFrame !== null) {
                    throw new Error('Consumed frame reused after stencil replacement for ' + pending);
                }
                results.push(pending);
            } finally {
                node.destroy();
            }
        }
        return results;
    } finally {
        frame.destroy();
        hostFrame.destroy();
    }
};
