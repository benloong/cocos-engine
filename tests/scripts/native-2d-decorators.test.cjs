'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generate, generateClass, OUTPUT } = require('../../scripts/generate-native-2d-decorators.cjs');

test('repository metadata is deterministic and matches committed generated output', () => {
    assert.equal(generate(), generate());
    assert.equal(fs.readFileSync(path.resolve(__dirname, '../..', OUTPUT), 'utf8').replace(/\r\n/g, '\n'), generate());
});

test('field decorators retain default factories and type injection instead of accessor descriptors', () => {
    const text = generateClass(`@ccclass('cc.Example') class Example {
        @serializable @editable field = -2;
        @type(SpriteFrame) sprite = null;
        @serializable frames = js.createMap();
    }`, 'fixture.ts', 'Example');
    assert.match(text, /SpriteFrame: any/);
    assert.match(text, /'field', \(\) => -2/);
    assert.match(text, /'frames', \(\) => js.createMap\(\)/);
    assert.match(text, /\$\.type\(SpriteFrame\)\(Example.prototype, 'sprite', \(\) => null\)/);
    assert.ok(text.indexOf("'editable'") < text.indexOf("'serializable'"));
    assert.doesNotMatch(text, /getOwnPropertyDescriptor/);
});

test('accessor overrides use descriptors and class registration comes last', () => {
    const text = generateClass(`@ccclass('cc.Example') class Example {
        @override @string get asset() { return ''; }
        set asset(value) {}
    }`, 'fixture.ts', 'Example');
    assert.match(text, /getOwnPropertyDescriptor\(Example.prototype, 'asset'\)/);
    assert.ok(text.indexOf("'string'") < text.indexOf("'override'"));
    assert.ok(text.indexOf("'override'") < text.indexOf("'ccclass'"));
});

test('new unsupported metadata fails explicitly rather than silently dropping fields', () => {
    for (const member of ['@newDecorator field = 1;', '@serializable field = arbitrary();', '@type([SpriteFrame]) field = null;']) {
        assert.throws(() => generateClass(`@ccclass('cc.Example') class Example { ${member} }`, 'fixture.ts', 'Example'), /unsupported/i);
    }
    assert.throws(() => generateClass('class Example {}', 'fixture.ts', 'Example'), /missing ccclass/);
    assert.throws(() => generateClass('class Other {}', 'fixture.ts', 'Example'), /missing Example/);
});
