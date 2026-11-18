'use strict';
const fs = require('fs');
const path = require('path');
const project = path.resolve(process.argv[2] || path.join(__dirname, '../../../../cocos-m1-test'));
const target = path.join(project, 'assets/scripts');
if (!fs.existsSync(path.join(project, 'package.json')) || !fs.existsSync(target)) throw new Error('Acceptance project not found: ' + project);
for (const file of ['LabelSpike.ts', 'M4Probe.ts', 'M4ExtraProbe.ts', 'RichTextProbe.ts', 'BitmapGpuProbe.ts', 'StaticAtlasProbe.ts']) {
    if (!fs.existsSync(path.join(target, file + '.meta'))) {
        const meta = path.join(__dirname, 'fixtures/acceptance', file + '.meta');
        if (!fs.existsSync(meta)) throw new Error('Expected existing probe metadata: ' + file);
        fs.copyFileSync(meta, path.join(target, file + '.meta'));
    }
    fs.copyFileSync(path.join(__dirname, 'fixtures/acceptance', file), path.join(target, file));
    console.log('Synced ' + file);
}

const resources = path.join(project, 'assets/resources');
const fixtureResources = path.join(__dirname, 'fixtures/acceptance/resources');
const fixtureAtlas = path.join(fixtureResources, 'M6StaticAtlas');
const atlasDirectory = path.join(resources, 'M6StaticAtlas');
fs.mkdirSync(atlasDirectory, { recursive: true });
for (const file of ['AtlasSprite.prefab', 'colors.plist', 'sheet.png']) {
    const metadata = path.join(atlasDirectory, file + '.meta');
    const sourceMetadata = path.join(fixtureAtlas, file + '.meta');
    if (fs.existsSync(metadata)) {
        const existing = JSON.parse(fs.readFileSync(metadata, 'utf8'));
        const expected = JSON.parse(fs.readFileSync(sourceMetadata, 'utf8'));
        if (existing.uuid !== expected.uuid) throw new Error('Unexpected fixture UUID: ' + metadata);
    } else {
        fs.copyFileSync(sourceMetadata, metadata);
    }
    fs.copyFileSync(path.join(fixtureAtlas, file), path.join(atlasDirectory, file));
}
const atlasMetadata = atlasDirectory + '.meta';
if (!fs.existsSync(atlasMetadata)) fs.copyFileSync(fixtureAtlas + '.meta', atlasMetadata);
console.log('Synced M6StaticAtlas resources');
