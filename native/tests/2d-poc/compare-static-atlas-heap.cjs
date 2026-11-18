'use strict';

const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(process.argv[2] || path.join(__dirname, 'build/static-atlas-heap'));
const { result, snapshots, noOptimizingJit } = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
if (result?.cycles !== 1000 || snapshots?.length !== 2 || snapshots[0].cycle !== 100 || snapshots[1].cycle !== 1000) {
    throw new Error('Run the Web static atlas stress probe with heap snapshots first');
}

function summarize (file) {
    const { snapshot, nodes, strings } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const fields = snapshot.meta.node_fields;
    const type = fields.indexOf('type');
    const name = fields.indexOf('name');
    const size = fields.indexOf('self_size');
    if ([type, name, size].includes(-1) || nodes.length % fields.length) throw new Error('Invalid heap snapshot: ' + file);

    const types = snapshot.meta.node_types[type];
    const byType = new Map();
    const byName = new Map();
    for (let i = 0; i < nodes.length; i += fields.length) {
        const kind = types[nodes[i + type]];
        const bytes = nodes[i + size];
        add(byType, kind, bytes);
        add(byName, kind + ':' + strings[nodes[i + name]], bytes);
    }
    return { byType, byName };
}

function add (map, key, bytes) {
    let row = map.get(key);
    if (!row) {
        row = { count: 0, bytes: 0 };
        map.set(key, row);
    }
    row.count++;
    row.bytes += bytes;
}

function difference (before, after, key) {
    const start = before.get(key) || { count: 0, bytes: 0 };
    const end = after.get(key) || { count: 0, bytes: 0 };
    return {
        key,
        beforeCount: start.count,
        afterCount: end.count,
        countDelta: end.count - start.count,
        selfBytesDelta: end.bytes - start.bytes,
    };
}

function compare (before, after) {
    return [...new Set([...before.keys(), ...after.keys()])]
        .map(key => difference(before, after, key))
        .sort((a, b) => b.selfBytesDelta - a.selfBytesDelta);
}

const baseline = summarize(path.join(directory, snapshots[0].file));
const end = summarize(path.join(directory, snapshots[1].file));
const byType = compare(baseline.byType, end.byType);
const top = compare(baseline.byName, end.byName).slice(0, 20);
const assetNames = ['Prefab', 'SpriteAtlas', 'SpriteFrame', 'Texture2D', 'ImageAsset', 'Node', 'Sprite', 'RenderData', 'StaticVBChunk'];
const assetCounts = assetNames.map(name => difference(baseline.byName, end.byName, 'object:' + name));
const totalSelfBytesDelta = byType.reduce((sum, row) => sum + row.selfBytesDelta, 0);
console.log(JSON.stringify({ noOptimizingJit, totalSelfBytesDelta, byType, top, assetCounts }, null, 2));
