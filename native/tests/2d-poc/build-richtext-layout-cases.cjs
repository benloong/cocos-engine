'use strict';
const fs = require('node:fs');
const path = require('node:path');
const texts = [
    '', 'hello', 'hello world again', 'many words across several lines and spaces', 'abcdefghijklmnopqrstuvwxyz',
    '中文换行测试，标点不在行首。', '日本語テキスト 한국어 문장', '😀🚗😀', '👩‍👩‍👧‍👦 family text',
    'a\nb', '\n', '\n\n', 'a\n\n', 'a\nb\n', '<br/>', '<br/>a<br/>', '<b>a<br/>b</b>',
    '<size=30>big word</size> tail', '<color=red>red</color><i>italic text</i>', '<u>one</u><b>bold word next</b>',
    '<outline width=2 color=red>outline text</outline> tail',
    '<img src="icon"/>', 'before<img src="icon"/>after', '<img src="wide"/>tail',
    '<img src="icon" width=16 height=20 align=top offset=2,3/>tail',
    '<img src="icon" align=center offset=4/>tail', '<img src="icon" align=bottom offset=2.5,3/>tail',
    '<img src="missing"/>tail', '<b>word</b>中文 <size=12>small text</size>',
    'école русский tiếng Việt Ελληνικά', 'a'.repeat(260), ('long words 中文，next sentence. ').repeat(14),
];
const cases = [];
for (const html of texts) for (const maxWidth of [0, 1, 35, 95, 220]) for (const align of [0, 1, 2]) for (const anchor of [[0, 0], [0.5, 0.5], [0.25, 0.75]]) {
    cases.push({ html, maxWidth, align, anchorX: anchor[0], anchorY: anchor[1], fontSize: 20, lineHeight: 24 });
}
const out = path.join(__dirname, 'build'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'richtext-layout-input.json'), JSON.stringify(cases));
console.log(`RichText layout: ${cases.length} cases`);
