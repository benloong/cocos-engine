'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const baseline = require('../../../docs/native-2d-m6.0-baseline.json');
const root = path.resolve(__dirname, '../../..');
const classes = new Set([
    'UIRenderer', 'UITransform', 'RenderRoot2D', 'UIOpacity', 'Sprite', 'Label', 'Mask', 'Graphics', 'RichText',
    'Font', 'TTFFont', 'BitmapFont', 'LabelAtlas', 'SpriteAtlas', 'SpriteFrame',
]);
const runtimeNames = { MaskComponent: 'Mask', GraphicsComponent: 'Graphics', RichTextComponent: 'RichText' };
const omittedTags = new Set(['deprecated', 'internal', 'engineInternal', 'private']);
const inventory = {};

function readSource(file) {
    return ts.createSourceFile(file, fs.readFileSync(path.resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
}

function memberId(member) {
    const isStatic = member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword);
    return (isStatic ? 'static.' : '') + member.name.text;
}

function visit(node) {
    if (!ts.isClassDeclaration(node) || !node.name) return ts.forEachChild(node, visit);
    const name = runtimeNames[node.name.text] || node.name.text;
    if (!classes.has(name)) return;
    if (inventory[name]) throw new Error('Ambiguous public class declaration for ' + name);
    const source = readSource(baseline.classes.find(entry => entry.name === name).source);
    const cls = source.statements.find(entry => ts.isClassDeclaration(entry) && entry.name?.text === name);
    const excluded = new Set([...cls.members, ...node.members]
        .filter(member => member.name && ts.getJSDocTags(member).some(tag => omittedTags.has(tag.tagName.text)))
        .map(memberId));
    const members = new Map();
    for (const member of node.members) {
        if (!member.name || !ts.isIdentifier(member.name) || member.name.text.startsWith('_')) continue;
        if (member.modifiers?.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind))) continue;
        const id = memberId(member);
        if (!excluded.has(id)) members.set(id, { key: member.name.text, isStatic: id.startsWith('static.') });
    }
    inventory[name] = [...members.values()];
}

visit(readSource(process.argv[3] || 'bin/.declarations/cc.d.ts'));
for (const name of classes) {
    if (!inventory[name]) throw new Error('Missing public class declaration for ' + name);
}
fs.writeFileSync(process.argv[2], JSON.stringify(inventory, null, 2));
