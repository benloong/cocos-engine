// Keep the historical QUnit inputs and supplement them with deterministic cases.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '../../..');
const cases = [], historical = [];
vm.runInNewContext(fs.readFileSync(path.join(repo, 'tests/utils/test-html-text-parser.js'), 'utf8'), {
    largeModule() {},
    require(id) {
        if (id !== '../../cocos/2d/utils/html-text-parser') throw new Error('Unexpected parser fixture module: ' + id);
        return { HtmlTextParser: class { parse(input) { return input; } } };
    },
    test(_name, run) { run(); },
    deepEqual(input, expected, label) {
        historical.push({ input, expected, label });
        cases.push(input);
    },
});
const wrappers = [
    ['b', 'b'], ['i', 'i'], ['u', 'u'], ['on click="tap" param="data"', 'on'],
    ['color=#aabbcc', 'color'], ['size=24', 'size'], ['size=0', 'size'], ['size=oops', 'size'],
    ['size=-3', 'size'], ['size=0x20', 'size'], ['color=red click="go" param="arg"', 'color'],
    ['outline', 'outline'], ['outline color=blue width=3', 'outline'], ['outline width=0', 'outline'],
    ['outline width=NaN click="tap" param="arg"', 'outline'], ['unknown', 'unknown'],
    ['b click=unquoted', 'b'], ['u click="tap"', 'i'], ['size\t=\t18', 'size'],
    ['color\u00a0=\u3000red', 'color'], ['B', 'B'], ['color=', 'color'],
    ['size=-0', 'size'], ['size=9007199254740993', 'size'], ['size=0x20000000000001', 'size'], ['size=1e3', 'size'],
];
const bodies = [
    'hello', '中文 😀 e\u0301', 'a\nb', '&lt;&gt;&amp;&quot;&apos;', '&amp;lt;&#65;&unknown;',
    '<br/>tail', '<br />tail', '<img src="icon" width=16 height=20 align=TOP />tail',
    '<img src=icon/>tail', '<img src="two words" offset=1,2 click="tap" param="hello" />tail',
    '<>empty</>', '',
];
for (const [open, close] of wrappers) for (const body of bodies) {
    cases.push(`<${open}>${body}</${close}>`);
    cases.push(`prefix<${open}>${body}suffix`);
    for (const [inner, end] of wrappers.slice(0, 10)) {
        cases.push(`<${open}>before<${inner}>${body}</${end}>after</${close}>tail`);
    }
}
for (const space of ['\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2000', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff']) {
    cases.push(`<size${space}=${space}24>x</size>`);
    cases.push(`<b${space}click${space}=${space}"tap"${space}param="arg">x</b>`);
    cases.push(`<img${space}src${space}=${space}"two words" width=16/>`);
}
cases.push('', '<', '>', '<x hello world', 'a<>b', 'a<b', '<b>a</b>tail', '<b>x<i>tail',
    '<img src="icon"/><b>after</b>', '<size=18>a<size=0>b</size>c</size>',
    '<b click="parent"><i click=invalid>x</i></b>', '<b>one</b>', '', '<i>two</i>');
const out = path.join(__dirname, 'build'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'richtext-parser-input.json'), JSON.stringify(cases));
fs.writeFileSync(path.join(out, 'richtext-parser-historical.json'), JSON.stringify(historical));
console.log(`RichText parser: ${cases.length} cases, including ${historical.length} historical inputs`);
