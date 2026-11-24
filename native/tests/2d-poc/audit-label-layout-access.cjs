// Run from the repository root with the deployed application's Resources directory.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { build } = require('./audit-m6.cjs');

const fields = ['textStyle', 'textLayout', 'textLayoutData', 'textRenderData'];
const file = 'cocos/2d/components/label.ts';
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const label = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Label');
for (const name of fields) {
    const getter = label.members.find(m => ts.isGetAccessorDeclaration(m) && m.name.getText() === name);
    if (!getter || !ts.getJSDocTags(getter).some(tag => tag.tagName.text === 'engineInternal')) {
        throw new Error('Review the API status of Label.' + name);
    }
}

const { within2d } = build().entrypointImports;
for (const entry of ['cocos/2d/components/label.jsb.ts', 'cocos/2d/assembler/label/index.jsb.ts']) {
    if (!within2d.includes(entry)) throw new Error('Missing Native entry: ' + entry);
}
const member = new RegExp('(?:\\.\\s*|\\[\\s*["\'])(' + fields.join('|') + ')\\b', 'g');
const consumers = {};
for (const file of ts.sys.readDirectory('cocos', ['.ts'])) {
    const names = Array.from(fs.readFileSync(file, 'utf8').matchAll(member), match => match[1]);
    if (names.length) {
        consumers[file] = names;
        if (within2d.includes(file)) throw new Error('Direct layout access in Native import graph: ' + file);
    }
}
const resources = process.argv[2];
if (!resources) throw new Error('Supply the application Resources directory');
const engine = fs.readFileSync(path.join(resources, 'src/cocos-js/cc.js'), 'utf8');
if (!engine.includes('new n2d.Label(')) throw new Error('Missing Native Label construction');
const scripts = ts.sys.readDirectory(resources, ['.js']);
const token = new RegExp('\\b(?:' + fields.join('|') + ')\\b');
for (const script of scripts) {
    if (token.test(fs.readFileSync(script, 'utf8'))) throw new Error('Layout property name in ' + script);
}
console.log(JSON.stringify({ engineInternal: fields, consumers, deployedScripts: scripts.length }, null, 2));
