'use strict';

const fs = require('node:fs');
const [log, report] = process.argv.slice(2);
const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/);
const cases = {};
let active;
let recording = false;
let completed = 0;
for (const line of lines) {
    const begin = /M6_TRACE_BEGIN (setup|steady|explicit|mutation|flush|disable|enable|destroy) ([\w-]+)/.exec(line);
    if (begin) {
        if (active || recording) throw new Error('Missing trace terminator');
        const [, phase, name] = begin;
        const phases = cases[name] ||= {};
        if (phases[phase]) throw new Error('Duplicate trace window: ' + name);
        active = phases[phase] = { calls: {} };
    } else if (line.includes('Start print JSB function record info')) {
        if (!active || recording) throw new Error('Unexpected JSB records');
        const total = /record info\.+ (\d+) times/.exec(line);
        if (!total) throw new Error('Missing invocation total');
        active.totalCalls = Number(total[1]);
        recording = true;
    } else if (line.includes('End print JSB function record info')) {
        if (!active || !recording) throw new Error('Unexpected trace terminator');
        if (Object.values(active.calls).reduce((sum, n) => sum + n, 0) !== active.totalCalls) {
            throw new Error('Invocation records do not add up to the native total');
        }
        active = undefined;
        recording = false;
    } else if (recording) {
        const record = /\b(\w+) takes [\d.]+ ms, invoked (\d+) times/.exec(line);
        if (record) active.calls[record[1]] = (active.calls[record[1]] || 0) + Number(record[2]);
    } else if (line.includes('M6_TRACE_DONE ')) {
        completed = Number(line.split('M6_TRACE_DONE ')[1]);
    }
}

const expectedCases = ['Canvas', 'UITransform', 'RenderRoot2D', 'UIOpacity', 'UIRenderer-Sprite-SpriteFrame',
    'Label', 'LabelOutline', 'LabelShadow', 'Font-TTFFont', 'BitmapFont', 'LabelAtlas', 'Graphics', 'Mask', 'RichText-SpriteAtlas'];
if (active || recording || completed !== expectedCases.length || Object.keys(cases).length !== completed
    || expectedCases.some(name => !cases[name])) throw new Error('Incomplete per-component trace');
for (const [name, phases] of Object.entries(cases)) {
    if (!phases.setup || !phases.steady || phases.explicit?.calls.js_cc_SpriteFrame_getRectWidth !== 1) {
        throw new Error('Missing native positive control for ' + name);
    }
    for (const phase of ['setup', 'mutation', 'flush', 'disable', 'enable', 'destroy']) {
        if (!phases[phase] || phases[phase].calls.jsb_clearInvocationRecords !== 1) throw Error(name + ': missing ' + phase + ' window');
        const expected = phase === 'flush' ? 1 : phase === 'destroy' ? 3 : 0;
        if ((phases[phase].calls.js_cc_Root_frameMove || 0) !== expected) throw Error(name + ': wrong frame count in ' + phase);
    }
    const frameCalls = phases.steady.calls.js_cc_Root_frameMove;
    if (frameCalls !== 60) throw new Error(name + ': expected 60 native frame moves, saw ' + frameCalls);
    const migrated = /^(?:js_new_cc_|js_cc_|jsb_cc_)(?:UITransform|UIRenderer|UIOpacity|RenderRoot2D|Sprite|SpriteFrame|SpriteAtlas|Label|LabelAtlas|LabelOutline|LabelShadow|BitmapFont|TTFFont|Font|Graphics|Mask|RichText)(?:_|$)/;
    for (const phase of Object.values(phases)) {
        phase.componentCalls = Object.entries(phase.calls).reduce((sum, [method, calls]) =>
            sum + (migrated.test(method) ? calls : 0), 0);
    }
    const count = phases.steady.componentCalls;
    const baseline = cases.Canvas.steady.calls;
    const delta = {};
    for (const method of new Set([...Object.keys(baseline), ...Object.keys(phases.steady.calls)])) {
        const difference = (phases.steady.calls[method] || 0) - (baseline[method] || 0);
        if (difference && !method.startsWith('js_delete_')) delta[method] = difference;
    }
    phases.steady.deltaFromCanvasExceptFinalizers = delta;
    if (count || phases.steady.calls.js_cc_UIRendererManager_updateAllDirtyRenderers !== frameCalls) {
        throw new Error(name + ': unexpected steady component or manager calls');
    }
    console.log(name + ': ' + count + ' direct migrated binding calls / ' + frameCalls + ' frames');
}
fs.writeFileSync(report, JSON.stringify({ warmupFrames: 12, measuredFrames: 60, cases }, null, 2) + '\n');
