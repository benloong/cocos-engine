'use strict';

const fs = require('node:fs');
const path = require('node:path');
const directory = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
function graph (entry) {
    const { snapshot, nodes, edges, strings } = JSON.parse(fs.readFileSync(path.join(directory, entry.file)));
    const meta = snapshot.meta, stride = meta.node_fields.length, step = meta.edge_fields.length;
    const field = name => meta.node_fields.indexOf(name);
    const nodeTypes = meta.node_types[field('type')];
    const id = i => nodes[i + field('id')];
    const name = i => strings[nodes[i + field('name')]];
    const kind = i => nodeTypes[nodes[i + field('type')]];
    const objects = new Map();
    for (let i = 0; i < nodes.length; i += stride) {
        if (kind(i) === 'object' && ['RenderData','StaticVBChunk'].includes(name(i))) objects.set(id(i),i);
    }
    const starts = new Uint32Array(nodes.length / stride + 1);
    for (let n = 0; n < starts.length-1; n++) starts[n+1] = starts[n]+nodes[n*stride+field('edge_count')]*step;
    function children (i, visit) {
        const n = i/stride;
        for (let e = starts[n]; e < starts[n+1]; e += step) {
            const type = meta.edge_types[0][edges[e]];
            if (type === 'weak') continue;
            const label = type === 'element' || type === 'hidden' ? String(edges[e+1]) : strings[edges[e+1]];
            visit(label, edges[e+2], type);
        }
    }
    function property (i, key) {
        let child;
        children(i, (label,to,type) => { if (label === key && type === 'property') child = to; });
        return child;
    }
    return { objects, nodes, stride, name, kind, id, children, property };
}
const before = new Set(graph(manifest.snapshots[0]).objects.keys());
const final = graph(manifest.snapshots[1]);
const added = new Map([...final.objects].filter(([id]) => !before.has(id)).map(([id,index]) => [index,{ id, name:final.name(index), owners:[] }]));
for (let i = 0; i < final.nodes.length; i += final.stride) {
    final.children(i, (label,to,type) => {
        const object = added.get(to);
        if (!object) return;
        const owner = { type, label, name: final.name(i), id: final.id(i) };
        let node = final.property(i,'node') ?? final.property(i,'_node');
        if (node !== undefined) {
            const chain = [];
            for (let depth = 0; depth < 16 && node !== undefined && ['Node','Scene'].includes(final.name(node)); depth++) {
                const text = final.property(node,'_name');
                chain.push({ type: final.name(node), name: text === undefined ? '' : final.name(text) });
                node = final.property(node,'_parent');
            }
            owner.chain = chain;
        }
        object.owners.push(owner);
    });
}
console.log(JSON.stringify([...added.values()],null,2));
