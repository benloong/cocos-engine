import { readFileSync } from 'fs';
import { JSB } from 'internal:constants';
import { radialFilled } from '../../cocos/2d/assembler/sprite/radial-filled';
import { dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';
const fixture = process.env.CC_RADIAL_SPRITE_FIXTURE;
(fixture ? test : test.skip)('native radial triangles/UV match the actual Web assembler', () => {
    expect(JSB).toBe(false);
    const cases = JSON.parse(readFileSync(fixture!, 'utf8'));
    expect(cases).toHaveLength(3024);
    const pack = jest.spyOn(dynamicAtlasManager, 'packToDynamicAtlas').mockImplementation(() => {});
    try {
        for (const [caseIndex, item] of cases.entries()) {
            const data: any[] = [];
            const renderData: any = { data, vertDirty: true, vertexCount: 0, indexCount: 0,
                get dataLength() { return data.length; },
                set dataLength(value) {
                    while (data.length < value) data.push({});
                    data.length = value;
                },
                resize(vertices, indices) { this.dataLength = vertices; this.vertexCount = vertices; this.indexCount = indices; },
                updateRenderData() { },
            };
            const sprite: any = { renderData, fillStart: item.start, fillRange: item.range, fillCenter: { x: item.center[0], y: item.center[1] },
                node: { _getUITransformComp: () => ({ width: item.width, height: item.height, anchorX: item.anchor[0], anchorY: item.anchor[1] }) },
                spriteFrame: { width: 128, height: 256, getRect: () => ({ x: 7, y: 11, width: 40, height: 28 }), isRotated: () => item.rotated },
                _markForUpdateRenderData() { },
            };
            radialFilled.updateRenderData(sprite);
            const actual = data.map(v => [v.x, v.y, v.u, v.v]);
            if (actual.length !== item.vertices.length) {
                throw new Error(`case ${caseIndex}: count ${item.vertices.length} != Web ${actual.length}: ${JSON.stringify(item)}`);
            }
            for (let v = 0; v < actual.length; v++) {
                for (let axis = 0; axis < 4; axis++) {
                    if (!Number.isFinite(item.vertices[v][axis]) || Math.abs(actual[v][axis] - item.vertices[v][axis]) > 0.0001) {
                        throw new Error(`case ${caseIndex}, vertex ${v}, axis ${axis}: native=${item.vertices[v][axis]}, Web=${actual[v][axis]}, input=${JSON.stringify(item)}`);
                    }
                }
            }
            expect(item.indices).toEqual(actual.map((_, i) => i));
        }
    } finally {
        pack.mockRestore();
    }
});
