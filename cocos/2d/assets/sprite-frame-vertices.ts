/*
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { Vec3 } from '../../core/math/vec3';

export interface IVertices {
    rawPosition: Vec3[]; // Original position of the vertex, pixel value
    positions: number[]; // The position of the vertex after being affected by the attribute
    indexes: number[]; // IB
    uv: number[]; // Pixel uv value
    nuv: number[]; // Normalized uv value
    minPos: Vec3;
    maxPos: Vec3;
}

export interface IVerticesSerialize { // hack for format
    rawPosition: number[];
    indexes: number[];
    uv: number[];
    nuv: number[];
    minPos: Pick<Vec3, 'x' | 'y' | 'z'>;
    maxPos: Pick<Vec3, 'x' | 'y' | 'z'>;
}

export function serializeFrameVertices (vertices: IVertices | null): IVerticesSerialize | undefined {
    if (!vertices) return undefined;
    const rawPosition: number[] = [];
    for (const point of vertices.rawPosition) rawPosition.push(point.x, point.y, point.z);
    return {
        rawPosition,
        indexes: vertices.indexes,
        uv: vertices.uv,
        nuv: vertices.nuv,
        minPos: { x: vertices.minPos.x, y: vertices.minPos.y, z: vertices.minPos.z },
        maxPos: { x: vertices.maxPos.x, y: vertices.maxPos.y, z: vertices.maxPos.z },
    };
}

export function cloneFrameVertices (vertices: IVertices | null): IVertices | null {
    return vertices && {
        rawPosition: vertices.rawPosition.slice(),
        positions: vertices.positions.slice(),
        indexes: vertices.indexes.slice(),
        uv: vertices.uv.slice(),
        nuv: vertices.nuv.slice(),
        minPos: vertices.minPos.clone(),
        maxPos: vertices.maxPos.clone(),
    };
}

export function deserializeFrameVertices (data: IVerticesSerialize, previous: IVertices | null): IVertices {
    const vertices = previous ?? {
        rawPosition: [] as Vec3[],
        positions: [],
        indexes: data.indexes,
        uv: data.uv,
        nuv: data.nuv,
        minPos: new Vec3(data.minPos.x, data.minPos.y, data.minPos.z),
        maxPos: new Vec3(data.maxPos.x, data.maxPos.y, data.maxPos.z),
    };
    vertices.rawPosition.length = 0;
    const raw = data.rawPosition;
    for (let i = 0; i < raw.length; i += 3) {
        vertices.rawPosition.push(new Vec3(raw[i], raw[i + 1], raw[i + 2]));
    }
    return vertices;
}
