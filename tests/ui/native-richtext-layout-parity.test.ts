import { readFileSync } from 'fs';
import { RichText } from '../../cocos/2d/components/rich-text';
import { Label } from '../../cocos/2d/components/label';
import { Sprite } from '../../cocos/2d/components/sprite';
import { Rect, Vec3 } from '../../cocos/core';

const fixture = process.env.CC_RICHTEXT_LAYOUT_FIXTURE;

// Isolate platform font metrics while executing actual Web parsing, wrapping,
// segment creation rules, long-text splitting and position calculation.
function webLayout (input: any): any {
    const rich: any = new RichText();
    const root: any = { width: 0, height: 0, anchorX: input.anchorX, anchorY: input.anchorY,
        setContentSize (width, height) { this.width = width; this.height = height; } };
    rich.node = { children: [], layer: 0, _getUITransformComp: () => root,
        insertChild (node, index) { this.children.splice(index, 0, node); node.parent = this; } };
    Object.defineProperty(rich, 'enabledInHierarchy', { value: true });
    Object.assign(rich, { _string: input.html, _fontSize: input.fontSize, _lineHeight: input.lineHeight,
        _maxWidth: input.maxWidth, _horizontalAlign: input.align, _verticalAlign: 0 });
    rich._imageAtlas = { getSpriteFrame: name => name === 'icon' ? { rect: new Rect(0, 0, 24, 12) } : name === 'wide' ? { rect: new Rect(0, 0, 200, 30) } : null };
    const makeSegment = (text: string, image: boolean): any => {
        const transform: any = { width: 0, height: 0, anchorY: 0,
            get contentSize () { return { width: this.width, height: this.height, x: this.width, y: this.height }; },
            setAnchorPoint (_x, y) { this.anchorY = y; },
            setContentSize (width, height) { this.width = width; this.height = height; } };
        const comp: any = { string: text, updateRenderData () {
            const outline = this.enableOutline ? this.outlineWidth : 0;
            transform.width = this.string.length * this.fontSize * 0.5 * (this.isBold ? 1.1 : 1) + (this.string.length ? 2 * outline : 0);
            transform.height = this.fontSize * 1.26 + 2 * outline;
        } };
        const node: any = { position: new Vec3(), _getUITransformComp: () => transform,
            setPosition (x, y, z = 0) { this.position.set(x, y, z); },
            getComponent: type => type === (image ? Sprite : Label) ? comp : null };
        return { node, comp, type: image ? 'RICHTEXT_Image_CHILD' : 'RICHTEXT_CHILD',
            styleIndex: 0, lineCount: 0, imageOffset: '', clickHandler: '', clickParam: '' };
    };
    rich._createFontLabel = text => makeSegment(text, false);
    let imageSpan = 0;
    const addImage = rich._addRichTextImageElement;
    rich._addRichTextImageElement = element => {
        imageSpan = rich._textArray.indexOf(element);
        addImage.call(rich, element);
    };
    rich._createImage = () => Object.assign(makeSegment('', true), { styleIndex: imageSpan });
    rich._updateRichText();
    return { width: root.width, height: root.height, lineCount: rich._lineCount, linesWidth: rich._linesWidth,
        placements: rich._segments.map(segment => {
            const transform = segment.node._getUITransformComp();
            return { spanIndex: segment.styleIndex, text: segment.comp.string ?? '', image: segment.type === 'RICHTEXT_Image_CHILD',
                line: segment.lineCount, x: segment.node.position.x, y: segment.node.position.y,
                width: transform.width, height: transform.height, anchorY: transform.anchorY };
        }) };
}

(fixture ? test : test.skip)('native RichText layout matches actual Web layout with equal measurements', () => {
    const { inputs, backends } = JSON.parse(readFileSync(fixture!, 'utf8'));
    expect(inputs.length).toBeGreaterThan(1000);
    expect(backends.length).toBeGreaterThan(0);
    const compare = (native: any, web: any, path: string) => {
        if (typeof web === 'number' && typeof native === 'number') {
            if (Math.abs(native - web) > 0.0001) throw new Error(`${path}: native ${native}, Web ${web}`);
        } else if (web && typeof web === 'object') {
            expect(Object.keys(native)).toEqual(Object.keys(web));
            for (const key of Object.keys(web)) compare(native[key], web[key], `${path}.${key}`);
        } else expect(native).toEqual(web);
    };
    const expected = inputs.map(webLayout);
    for (const backend of backends) {
        expect(backend.outputs).toHaveLength(inputs.length);
        for (let i = 0; i < inputs.length; i++) {
            try { compare(backend.outputs[i], expected[i], `case ${i}`); } catch (error) {
                throw new Error(`${backend.name}: ${JSON.stringify(inputs[i])}\n${error}\nnative: ${JSON.stringify(backend.outputs[i])}\nWeb: ${JSON.stringify(expected[i])}`);
            }
        }
    }
});
