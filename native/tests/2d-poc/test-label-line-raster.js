// Runs in the Windows application, after the timed workloads.
async function checkLabelLineRaster (cc, parent, nextFrame) {
    const makeLabel = () => {
        const node = new cc.Node();
        node.layer = parent.layer;
        parent.addChild(node);
        node.addComponent(cc.UITransform);
        return node.addComponent(cc.Label);
    };
    const read = (label) => {
        const texture = label.ttfSpriteFrame.texture;
        const copy = new cc.gfx.BufferTextureCopy();
        copy.texExtent.width = texture.width;
        copy.texExtent.height = texture.height;
        const pixels = new Uint8Array(texture.width * texture.height * 4);
        cc.director.root.device.copyTextureToBuffers(texture.getGFXTexture(), [pixels], [copy]);
        return pixels;
    };
    const variants = [
        {}, { text: 'CD' }, { width: 81 }, { height: 37 }, { horizontal: 1 }, { horizontal: 2 },
        { vertical: 1 }, { vertical: 2 }, { color: cc.Color.RED }, { fontSize: 22 },
        { family: 'Consolas' }, { italic: true }, { bold: true }, { underline: true },
        { text: ' fi AV ' }, { text: 'office' }, { text: 'A\nB' }, { text: '中文' },
    ];
    const draw = (label, { text = 'AB', width = 80, height = 36, horizontal = 0, vertical = 0,
        color = cc.Color.WHITE, fontSize = 16, family = 'Arial', italic = false, bold = false, underline = false }) => {
        label.overflow = cc.Label.Overflow.CLAMP;
        label.node.getComponent(cc.UITransform).setContentSize(width, height);
        label.fontFamily = family;
        label.fontSize = fontSize;
        label.lineHeight = 18;
        label.horizontalAlign = horizontal;
        label.verticalAlign = vertical;
        label.color = color;
        label.isItalic = italic;
        label.isBold = bold;
        label.isUnderline = underline;
        label.string = text;
        label.updateRenderData(true);
    };
    const source = makeLabel();
    const peer = makeLabel();
    const expected = [];
    const check = (actual, index) => {
        const pixels = expected[index];
        if (actual.length !== pixels.length || actual.some((value, i) => value !== pixels[i])) {
            throw new Error('Label raster pixels differ for variant ' + index);
        }
    };
    try {
        for (const variant of variants) {
            await nextFrame();
            draw(source, variant);
            const pixels = read(source);
            if (!pixels.some((value, i) => i % 4 === 3 && value > 1)) throw new Error('Empty Label raster');
            expected.push(pixels);
        }
        await nextFrame();
        for (const [index, variant] of variants.entries()) {
            draw(source, variant);
            draw(peer, variant);
            check(read(peer), index);
            if (source.ttfSpriteFrame.texture === peer.ttfSpriteFrame.texture) throw new Error('Labels share a texture');
            draw(source, variants[(index + 1) % variants.length]);
            check(read(peer), index);
        }
    } finally {
        source.node.destroy();
        peer.node.destroy();
    }
    return variants.length;
}
