'use strict';

const fs = require('node:fs');
const [log, report] = process.argv.slice(2);
const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/);
const cases = {};
let active;
let recording = false;
let completed = 0;
for (const line of lines) {
    const begin = /M6_TRACE_BEGIN (setup|steady|explicit) ([\w-]+)/.exec(line);
    if (begin) {
        if (active || recording) throw new Error('Missing trace terminator');
        const [, phase, name] = begin;
        const phases = cases[name] ||= {};
        if (phases[phase]) throw new Error('Duplicate trace window: ' + name);
        active = phases[phase] = { calls: {} };
    } else if (line.includes('Start print JSB function record info')) {
        if (!active || recording) throw new Error('Unexpected JSB records');
        recording = true;
    } else if (line.includes('End print JSB function record info')) {
        if (!active || !recording) throw new Error('Unexpected trace terminator');
        active = undefined;
        recording = false;
    } else if (recording) {
        const record = /\b(\w+) takes [\d.]+ ms, invoked (\d+) times/.exec(line);
        if (record) active.calls[record[1]] = (active.calls[record[1]] || 0) + Number(record[2]);
    } else if (line.includes('M6_TRACE_DONE ')) {
        completed = Number(line.split('M6_TRACE_DONE ')[1]);
    }
}

if (active || recording || completed !== 14 || Object.keys(cases).length !== completed) throw new Error('Incomplete per-component trace');
for (const [name, phases] of Object.entries(cases)) {
    if (!phases.setup || !phases.steady || phases.explicit?.calls.js_cc_SpriteFrame_getRectWidth !== 1) {
        throw new Error('Missing native positive control for ' + name);
    }
    const frameCalls = phases.steady.calls.js_cc_Root_frameMove;
    if (frameCalls !== 60) throw new Error(name + ': expected 60 native frame moves, saw ' + frameCalls);
    const migrated = /^(?:js_(?:new_)?cc_|jsb_cc_)(?:UITransform|UIRenderer|UIOpacity|RenderRoot2D|Sprite|SpriteFrame|SpriteAtlas|Label|LabelAtlas|BitmapFont|TTFFont|Font|Graphics|Mask|RichText)_/;
    const count = Object.entries(phases.steady.calls).reduce((n, [method, calls]) => n + (migrated.test(method) ? calls : 0), 0);
    phases.steady.componentCalls = count;
    const baseline = cases.Canvas.steady.calls;
    const delta = {};
    for (const method of new Set([...Object.keys(baseline), ...Object.keys(phases.steady.calls)])) {
        const difference = (phases.steady.calls[method] || 0) - (baseline[method] || 0);
        if (difference && !method.startsWith('js_delete_')) delta[method] = difference;
    }
    phases.steady.deltaFromCanvasExceptFinalizers = delta;
    console.log(name + ': ' + count + ' direct migrated binding calls / ' + frameCalls + ' frames');
}
fs.writeFileSync(report, JSON.stringify({ warmupFrames: 12, measuredFrames: 60, cases }, null, 2) + '\n');
