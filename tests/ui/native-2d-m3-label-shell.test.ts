import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { Color } from '../../cocos/core/math/color';

const nativeLabel = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setMaterial: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setString: jest.fn(),
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    setLineHeight: jest.fn(),
    setEnableWrapText: jest.fn(),
    setOverflow: jest.fn(),
    setHorizontalAlign: jest.fn(),
    setVerticalAlign: jest.fn(),
    setSpacingX: jest.fn(),
    setColorRGBA: jest.fn(),
    setEnableOutline: jest.fn(),
    setOutlineColor: jest.fn(),
    setOutlineWidth: jest.fn(),
    setEnableShadow: jest.fn(),
    setShadowColor: jest.fn(),
    setShadowBlur: jest.fn(),
    setShadowOffset: jest.fn(),
    setCacheMode: jest.fn(),
    getContentHeight: jest.fn(() => 90),
};

beforeAll(() => {
    (global as any).n2d = {
        Label: jest.fn(() => nativeLabel),
    };
});

test('Label M3 shell attaches and forwards text properties', () => {
    const { Label, Overflow, HorizontalTextAlignment } = require('../../cocos/2d/components/label.jsb') as typeof import('../../cocos/2d/components/label.jsb');
    const node = new Node('label');
    node.addComponent(UITransform);
    const label = node.addComponent(Label) as InstanceType<typeof Label>;

    label.onLoad();
    expect((global as any).n2d.Label).toHaveBeenCalled();
    expect(nativeLabel.setNode).toHaveBeenCalledWith(node);
    expect(nativeLabel.setMaterial).toHaveBeenCalled();

    label.string = 'Hello';
    label.fontSize = 24;
    label.lineHeight = 30;
    label.enableWrapText = true;
    label.overflow = Overflow.RESIZE_HEIGHT;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = 2;
    label.spacingX = 2;
    label.cacheMode = 2;

    expect(nativeLabel.setString).toHaveBeenLastCalledWith('Hello');
    expect(nativeLabel.setFont).toHaveBeenLastCalledWith('24px Arial');
    expect(nativeLabel.setLineHeight).toHaveBeenLastCalledWith(30);
    expect(nativeLabel.setEnableWrapText).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setOverflow).toHaveBeenLastCalledWith(Overflow.RESIZE_HEIGHT);
    expect(nativeLabel.setHorizontalAlign).toHaveBeenLastCalledWith(1);
    expect(nativeLabel.setVerticalAlign).toHaveBeenLastCalledWith(2);
    expect(nativeLabel.setSpacingX).toHaveBeenLastCalledWith(2);
    expect(nativeLabel.setCacheMode).toHaveBeenLastCalledWith(2);

    label.color = new Color(10, 20, 30, 255);
    expect(nativeLabel.setColorRGBA).toHaveBeenLastCalledWith(10, 20, 30, 255);

    label.lateUpdate();
    expect(node.getComponent(UITransform)?.contentSize.height).toBe(90);

    label.enableOutline = true;
    label.outlineWidth = 2;
    expect(nativeLabel.setEnableOutline).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setOutlineWidth).toHaveBeenLastCalledWith(2);

    label.enableShadow = true;
    label.shadowBlur = 2;
    expect(nativeLabel.setEnableShadow).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setShadowBlur).toHaveBeenLastCalledWith(2);
});