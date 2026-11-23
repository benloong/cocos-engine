import { Node } from '../../cocos/scene-graph/node';
import { Component } from '../../cocos/scene-graph/component';
import { NodeEventType } from '../../cocos/scene-graph/node-event';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { RichText as WebRichText } from '../../cocos/2d/components/rich-text';
import { Color, js } from '../../cocos/core';
import { deserialize, Details } from '../../cocos/serialization/deserialize';
import { instantiate } from '../../exports/base';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';

function createNative () {
    return {
        setNode: jest.fn(), setUITransform: jest.fn(), setEnabled: jest.fn(),
        setString: jest.fn(), setFontSize: jest.fn(), setLineHeight: jest.fn(), setMaxWidth: jest.fn(),
        setHorizontalAlign: jest.fn(), setVerticalAlign: jest.fn(), setFontFamily: jest.fn(),
        setFontAsset: jest.fn(), setFontColorRGBA: jest.fn(), setImageAtlas: jest.fn(), setCacheMode: jest.fn(),
        updateLayout: jest.fn(), getHitSegments: jest.fn(() => [0]),
        getSegmentClickHandler: jest.fn(() => 'clicked'), getSegmentClickParam: jest.fn(() => 'arg'),
    };
}
const created: ReturnType<typeof createNative>[] = [];
beforeAll(() => {
    // A native override replaces the Web module in production. This test loads
    // both for comparison, so free the Web registration before the override.
    js.unregisterClass(WebRichText);
    (global as any).n2d = { RichText: jest.fn(() => { const native = createNative(); created.push(native); return native; }) };
});
beforeEach(() => { created.length = 0; jest.clearAllMocks(); });

test('RichText shell preserves Web serialized defaults and component registration', () => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const web: any = new WebRichText(), rich: any = new RichText();
    for (const field of ['_lineHeight', '_string', '_horizontalAlign', '_verticalAlign', '_fontSize', '_fontColor',
        '_maxWidth', '_fontFamily', '_font', '_isSystemFontUsed', '_userDefinedFont', '_cacheMode', '_imageAtlas', '_handleTouchEvent']) {
        expect(RichText.__values__).toContain(field);
        expect(rich[field]).toEqual(web[field]);
    }
    expect(js.getClassById('cc.RichText')).toBe(RichText);
    expect(RichText.HorizontalAlign).toEqual(WebRichText.HorizontalAlign);
    expect(RichText.VerticalAlign).toEqual(WebRichText.VerticalAlign);
    expect(Object.prototype.hasOwnProperty.call(RichText.prototype, 'update')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(RichText.prototype, 'lateUpdate')).toBe(false);
});

test('RichText forwards initial state and explicit properties without JS segments', () => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const node = new Node('native-richtext'); const transform: any = node.addComponent(UITransform);
    transform._native = {};
    const rich: any = node.addComponent(RichText); rich.string = 'before load'; rich.onLoad(); rich.onEnable();
    const native = created[0];
    expect(native.setNode).toHaveBeenCalledWith(node);
    expect(native.setUITransform).toHaveBeenCalledWith(transform._native);
    expect(native.setString).toHaveBeenCalledWith('before load');
    rich.string = '<b>after</b>'; rich.fontSize = 22; rich.lineHeight = 28; rich.maxWidth = 200;
    rich.horizontalAlign = 2; rich.verticalAlign = 1; rich.fontFamily = 'test'; rich.cacheMode = 2;
    rich.fontColor = new Color(1, 2, 3, 4); rich.imageAtlas = {};
    expect(native.setString).toHaveBeenLastCalledWith('<b>after</b>');
    expect(native.setFontSize).toHaveBeenLastCalledWith(22);
    expect(native.setLineHeight).toHaveBeenLastCalledWith(28);
    expect(native.setMaxWidth).toHaveBeenLastCalledWith(200);
    expect(native.setFontColorRGBA).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(node.children).toEqual([]);
    expect(rich._segments).toBeUndefined();
    expect(native.updateLayout).not.toHaveBeenCalled();
    rich.onDestroy();
    expect(native.setNode).toHaveBeenLastCalledWith(null);
    expect(native.setFontAsset).toHaveBeenLastCalledWith(null);
    expect(native.setImageAtlas).toHaveBeenLastCalledWith(null);
});

test('RichText dependencies deserialize and instantiate without copying native state', () => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const details = new Details(); details.init();
    const rich: any = deserialize([{ __type__: 'cc.RichText', _string: 'legacy', _font: { __uuid__: 'font' },
        _isSystemFontUsed: false, _maxWidth: 100 }], details, { classFinder: () => RichText });
    const font = new TTFFont();
    details.uuidObjList![0][details.uuidPropList![0]] = font;
    rich.node = new Node('loaded'); rich.node.addComponent(UITransform); rich.onLoad();
    expect(created[0].setFontAsset).toHaveBeenCalledWith(font);
    const clone: any = instantiate(rich);
    expect(clone._native).toBeNull(); expect(clone.font).toBe(font); expect(clone.string).toBe('legacy');
    expect(clone.fontColor).not.toBe(rich.fontColor);
    rich.useSystemFont = true;
    expect(created[0].setFontAsset).toHaveBeenLastCalledWith(null);
    rich.onDestroy();
});

test('native hit results dispatch user handlers once and detach on disable/destroy', () => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const node = new Node('click'); node.addComponent(UITransform);
    const rich: any = node.addComponent(RichText); rich.onLoad(); rich.onEnable(); rich.onEnable();
    class Handler extends Component { clicked = jest.fn(); }
    const handler = node.addComponent(Handler);
    Object.defineProperty(handler, 'enabledInHierarchy', { value: true });
    const event = { touch: { getUILocation: () => ({ x: 2, y: 3 }) }, propagationStopped: false };
    node.emit(NodeEventType.TOUCH_END, event);
    expect(created[0].getHitSegments).toHaveBeenCalledWith(2, 3);
    expect(handler.clicked).toHaveBeenCalledTimes(1);
    expect(handler.clicked).toHaveBeenCalledWith(event, 'arg');
    expect(event.propagationStopped).toBe(true);
    rich.onDisable(); node.emit(NodeEventType.TOUCH_END, event);
    expect(handler.clicked).toHaveBeenCalledTimes(1);
    rich.onEnable(); rich.onDestroy(); node.emit(NodeEventType.TOUCH_END, event);
    expect(handler.clicked).toHaveBeenCalledTimes(1);
});

test.each(['destroy', 'disable', 'touch-off'])('RichText stops dispatch after a handler changes its lifetime: %s', (action) => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const node = new Node('reentrant-click'); node.addComponent(UITransform);
    const rich: any = node.addComponent(RichText); rich.onLoad(); rich.onEnable();
    class First extends Component {
        clicked = jest.fn(() => {
            if (action === 'destroy') rich.onDestroy();
            else if (action === 'disable') rich.onDisable();
            else rich.handleTouchEvent = false;
        });
    }
    class Second extends Component { clicked = jest.fn(); }
    const first = node.addComponent(First), second = node.addComponent(Second);
    for (const handler of [first, second]) Object.defineProperty(handler, 'enabledInHierarchy', { value: true });
    const event = { touch: { getUILocation: () => ({ x: 2, y: 3 }) }, propagationStopped: false };
    node.emit(NodeEventType.TOUCH_END, event);
    expect(first.clicked).toHaveBeenCalledTimes(1);
    expect(second.clicked).not.toHaveBeenCalled();
    expect(event.propagationStopped).toBe(true);
    node.emit(NodeEventType.TOUCH_END, event);
    expect(first.clicked).toHaveBeenCalledTimes(1);
});

test('RichText snapshots native hit metadata before user callbacks can relayout the segments', () => {
    const { RichText } = require('../../cocos/2d/components/rich-text.jsb');
    const node = new Node('relayout-click'); node.addComponent(UITransform);
    const rich: any = node.addComponent(RichText); rich.onLoad(); rich.onEnable();
    const native = created[0];
    let relaid = false;
    native.getHitSegments.mockReturnValue([0, 1]);
    native.getSegmentClickHandler.mockImplementation(index => relaid ? 'replacement' : 'clicked');
    native.getSegmentClickParam.mockImplementation(index => `original-${index}`);
    class Handler extends Component {
        clicked = jest.fn(() => { rich.string = 'replacement'; relaid = true; });
        replacement = jest.fn();
    }
    const handler = node.addComponent(Handler);
    Object.defineProperty(handler, 'enabledInHierarchy', { value: true });
    const event = { touch: { getUILocation: () => ({ x: 2, y: 3 }) }, propagationStopped: false };
    node.emit(NodeEventType.TOUCH_END, event);
    expect(handler.clicked.mock.calls.map(args => args[1])).toEqual(['original-0', 'original-1']);
    expect(handler.replacement).not.toHaveBeenCalled();
    rich.onDestroy();
});
