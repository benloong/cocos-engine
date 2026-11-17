'use strict';
const fs = require('fs');
const path = require('path');
const project = path.resolve(process.argv[2] || path.join(__dirname, '../../../../cocos-m1-test'));
const target = path.join(project, 'assets/scripts');
if (!fs.existsSync(path.join(project, 'package.json')) || !fs.existsSync(target)) throw new Error('Acceptance project not found: ' + project);
for (const file of ['M4Probe.ts', 'M4ExtraProbe.ts', 'RichTextProbe.ts', 'BitmapGpuProbe.ts']) {
    if (!fs.existsSync(path.join(target, file + '.meta'))) {
        const meta = path.join(__dirname, 'fixtures/acceptance', file + '.meta');
        if (!fs.existsSync(meta)) throw new Error('Expected existing probe metadata: ' + file);
        fs.copyFileSync(meta, path.join(target, file + '.meta'));
    }
    fs.copyFileSync(path.join(__dirname, 'fixtures/acceptance', file), path.join(target, file));
    console.log('Synced ' + file);
}
