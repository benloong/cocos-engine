module.exports = async function checkMaskStencilApi(cc, parent) {
    const node = new cc.Node('mask-stencil-api');
    parent.addChild(node);
    const mask = node.addComponent(cc.Mask);
    const types = cc.Mask.Type;
    const colors = [31, 63, 95, 127];
    const graphics = mask.subComp;
    for (let i = 0; i < colors.length; ++i) {
        mask.type = types.SPRITE_STENCIL;
        const sprite = mask.subComp;
        if (!(sprite instanceof cc.Sprite) || sprite !== node.getComponent(cc.Sprite) || mask.graphics !== sprite) {
            throw new Error('Sprite stencil lookup or legacy alias mismatch');
        }
        sprite.color = new cc.Color(colors[i], 83, 197, 255);
        if (mask.graphics.color.r !== colors[i]) throw new Error('Sprite stencil color write lost');
        mask.type = types.GRAPHICS_STENCIL;
        if (cc.isValid(sprite) || !(graphics instanceof cc.Graphics) || mask.graphics !== graphics || mask.subComp !== graphics) {
            throw new Error('Graphics stencil lookup, lifetime or legacy alias mismatch');
        }
        graphics.lineWidth = i + 2;
        if (mask.graphics.lineWidth !== i + 2) throw new Error('Graphics stencil style write lost');
    }
    const missing = ['customMaterial', 'color', 'markForUpdateRenderData', 'requestRenderData', 'destroyRenderData',
        'updateRenderer', 'fillBuffers', 'postUpdateAssembler', 'setNodeDirty', 'setTextureDirty', 'sharedMaterial',
        'sharedMaterials', 'material', 'materials', 'getMaterial', 'setMaterial', 'getMaterialInstance',
        'setMaterialInstance', 'getRenderMaterial'].filter(name => !(name in mask));
    node.destroy();
    await new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    if (cc.isValid(mask) || cc.isValid(graphics) || mask.subComp !== null) throw new Error('Disposed stencil remained accessible');
    return {typeSwitches: 8, missing};
};
