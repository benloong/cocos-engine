'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const build = path.join(__dirname, 'build');
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const renderer = path.resolve(__dirname, '../../cocos/platform/win32/modules/DirectWriteFont.cpp');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function readGlyph(kit, file) {
    const builder = new kit.PathBuilder();
    let width, height, matrix, pen;
    for (const line of fs.readFileSync(file, 'utf8').trimEnd().split(/\r?\n/)) {
        const [op, ...fields] = line.split(' ');
        const points = fields.map(value => Math.fround(Number(value)));
        switch (op) {
        case 'S': [width, height] = points; break;
        case 'T': {
            const [a, b, c, d, e, f, thickness] = points;
            matrix = [a, c, e, b, d, f, 0, 0, 1];
            pen = thickness;
            break;
        }
        case 'F': builder.setFillType(points[0] ? kit.FillType.Winding : kit.FillType.EvenOdd); break;
        case 'M': builder.moveTo(...points); break;
        case 'L': builder.lineTo(...points); break;
        case 'C': builder.cubicTo(...points); break;
        case 'E': if (points[0]) builder.close(); break;
        default: throw new Error('Unexpected path command: ' + op);
        }
    }
    const outline = builder.detachAndDelete();
    assert.ok(width > 0 && height > 0);
    return { outline, width, height, matrix, pen };
}

function scanGlyph(kit, glyph, stroke = true) {
    const { outline, width, height, matrix, pen } = glyph;
    const surface = kit.MakeSurface(width, height);
    assert.ok(surface);
    const paint = new kit.Paint();
    try {
        const canvas = surface.getCanvas();
        canvas.clear(kit.TRANSPARENT);
        paint.setAntiAlias(true);
        if (matrix) canvas.concat(matrix);
        if (pen && stroke) {
            paint.setStyle(kit.PaintStyle.Stroke);
            paint.setStrokeJoin(kit.StrokeJoin.Round);
            paint.setStrokeWidth(pen);
        }
        canvas.drawPath(outline, paint);
        const pixels = canvas.readPixels(0, 0, {
            width, height, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Premul, colorSpace: kit.ColorSpace.SRGB,
        });
        assert.equal(pixels.length, width * height * 4);
        const alpha = Buffer.alloc(width * height);
        for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
        return alpha;
    } finally {
        paint.delete();
        surface.dispose();
    }
}

function exportStroke(kit, outline) {
    const commands = outline.toCmds(), output = ['F ' + Number(outline.getFillType() === kit.FillType.Winding)];
    let previous;
    for (let index = 0; index < commands.length;) {
        const verb = commands[index++];
        if (verb === kit.CLOSE_VERB) {
            output.push('E');
            continue;
        }
        const op = {
            [kit.MOVE_VERB]: 'M', [kit.LINE_VERB]: 'L', [kit.QUAD_VERB]: 'Q',
            [kit.CONIC_VERB]: 'A', [kit.CUBIC_VERB]: 'C',
        }[verb];
        assert.ok(op, 'Unexpected CanvasKit path verb: ' + verb);
        const count = { M: 2, L: 2, Q: 4, A: 5, C: 6 }[op];
        const values = Array.from(commands.slice(index, index + count));
        index += count;
        if (op !== 'A') {
            output.push(op + ' ' + values.join(' '));
            previous = values.slice(-2);
            continue;
        }
        // Round joins are circular conics. Recover their circle in glyph coordinates
        // before the native sampler applies the nonuniform sampling transform.
        const [cx, cy, x, y, weight] = values, squared = weight * weight;
        assert.ok(weight > 0 && weight < 1, 'Expected a circular join below 180 degrees');
        const ox = ((previous[0] + x) / 2 - cx * squared) / (1 - squared);
        const oy = ((previous[1] + y) / 2 - cy * squared) / (1 - squared);
        const vx = previous[0] - ox, vy = previous[1] - oy;
        const dx = x - ox, dy = y - oy;
        const radius = Math.hypot(vx, vy);
        assert.ok(Math.abs(Math.hypot(dx, dy) - radius) < .002, 'Conic endpoints disagree on the join radius');
        output.push(['A', x, y, radius, Number(vx * dy - vy * dx > 0)].join(' '));
        previous = [x, y];
    }
    return output.join('\n') + '\n';
}

function compare(actual, expected, offset = 0, stride = 1) {
    assert.equal(actual.length, expected.length);
    let max = 0, pixels = 0;
    for (let i = offset; i < actual.length; i += stride) {
        const diff = Math.abs(actual[i] - expected[i]);
        max = Math.max(max, diff);
        if (diff > 1) pixels++;
    }
    return { max, pixels };
}

async function main() {
    const [, , replayArg, kitArg] = process.argv;
    assert.ok(replayArg && kitArg, 'Usage: node compare-ttf-canvaskit.cjs <stroke-replay directory> <CanvasKit package>');
    const replay = path.resolve(replayArg), packageDir = path.resolve(kitArg);
    const input = JSON.parse(fs.readFileSync(path.join(replay, 'comparison.json')));
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json')));
    const wasm = path.join(packageDir, 'bin/canvaskit.wasm');
    const loader = path.join(packageDir, 'bin/canvaskit.js');
    assert.equal(manifest.name, 'canvaskit-wasm');
    assert.equal(manifest.version, '0.42.0');
    assert.equal(hash(wasm), '25ebed8e60158c5854f8dc807b936daca21354f8bfb6a2231266b0a93812f301');
    assert.equal(hash(loader), '443777592179808354031cf411d8d43cac9f6b98d1227123c5c22d401b0fbf7f');
    assert.equal(input.rendererSha256, hash(renderer));
    assert.equal(input.fontSha256, hash(font));
    assert.equal(input.strokeWidth, 4);
    const kit = await require(loader)({ locateFile: file => path.join(packageDir, 'bin', file) });
    const scratch = fs.mkdtempSync(path.join(build, 'canvaskit-stroke-'));
    const report = { browser: input.browser, fontSha256: input.fontSha256, rendererSha256: input.rendererSha256,
        canvasKitVersion: manifest.version, canvasKitWasmSha256: hash(wasm), canvasKitLoaderSha256: hash(loader),
        glyphMasks: input.glyphMasks, configurations: {} };
    const chrome = path.join(build, 'ttf-raster-web-green-latin-stroke-round');
    for (const config of ['out', 'out-release2']) {
        const source = path.join(replay, config);
        const work = path.join(scratch, config);
        fs.mkdirSync(work);
        const binary = path.join(__dirname, 'native', config, 'cc2d_ttf_stroke_replay.exe');
        const stages = {};
        const environment = { ...process.env };
        for (const key of ['CC2D_STROKE_REPLAY', 'CC2D_STROKE_PATH', 'CC2D_FILL_IMPORTED_PATH', 'CC2D_CAPTURE_WIC_PATH', 'CC2D_STROKE_BOUNDARY',
            'CC2D_DIRECT_STROKE', 'CC2D_WIDEN_TOLERANCE', 'CC2D_EDGE_TOLERANCE', 'CC2D_PEN_SCALE']) delete environment[key];
        function compose(stage, env) {
            const output = path.join(work, stage);
            execFileSync(binary, [font, output, 'green', 'latin', 'stroke-round'], { cwd: work, env });
            return input.rows.map(row => {
                const file = row.size + '-' + row.style + '.rgba';
                const reference = path.join(chrome, file);
                const native = path.join(output, file);
                assert.equal(hash(reference), row.webHash);
                return { size: row.size, style: row.style, sha256: hash(native),
                    ...compare(fs.readFileSync(native), fs.readFileSync(reference), 3, 4) };
            });
        }
        const expandedMasks = [];
        for (const stage of ['center', 'widened']) {
            const files = fs.readdirSync(source).filter(file => file.endsWith('.' + stage + '.path')).sort();
            assert.equal(files.length, input.glyphMasks);
            const masks = files.map(file => {
                const glyph = readGlyph(kit, path.join(source, file));
                const alpha = scanGlyph(kit, glyph);
                const chromeMask = fs.readFileSync(path.join(source, file.replace('.path', '.alpha')));
                fs.writeFileSync(path.join(work, file.replace('.path', '.alpha')), alpha);
                if (stage === 'center') {
                    assert.deepEqual(glyph.matrix.slice(0, 2), [4, 0]);
                    assert.deepEqual(glyph.matrix.slice(3, 5), [0, 1]);
                    const outline = glyph.outline.makeStroked({ width: glyph.pen, join: kit.StrokeJoin.Round, precision: 4 });
                    assert.ok(outline);
                    const expandedAlpha = scanGlyph(kit, { ...glyph, outline }, false);
                    expandedMasks.push({ file, ...compare(expandedAlpha, alpha) });
                    fs.writeFileSync(path.join(work, file.replace('.center.path', '.skia.alpha')), expandedAlpha);
                    fs.writeFileSync(path.join(work, file.replace('.center.path', '.skia.stroke')), exportStroke(kit, outline));
                    outline.delete();
                }
                glyph.outline.delete();
                return { file, ...compare(alpha, chromeMask) };
            });
            stages[stage] = { masks, images: compose(stage, { ...environment, CC2D_STROKE_REPLAY: stage }) };
        }
        assert.ok(expandedMasks.every(row => row.max <= 1), 'Expanded CanvasKit paths must reproduce its original pen masks');
        for (const stage of ['nativeSampled', 'nativeDirect']) {
            const env = { ...environment, CC2D_STROKE_PATH: '1' };
            if (stage === 'nativeDirect') env.CC2D_FILL_IMPORTED_PATH = '1';
            const images = compose(stage, env);
            const masks = expandedMasks.map(({ file }) => {
                const stem = file.replace('.center.path', '');
                const actual = fs.readFileSync(path.join(work, stem + '.' + stage + '.alpha'));
                const expected = fs.readFileSync(path.join(work, stem + '.skia.alpha'));
                return { file, ...compare(actual, expected) };
            });
            stages[stage] = { masks, images };
        }
        const baseline = compose('wicBaseline', { ...environment, CC2D_CAPTURE_WIC_PATH: '1' });
        assert.deepEqual(baseline.map(row => row.sha256), input.rows.map(row => row.stages.production.hash));
        const wicFiles = fs.readdirSync(work).filter(file => file.endsWith('.wic.path')).sort();
        assert.equal(wicFiles.length, input.glyphMasks);
        const sameLines = wicFiles.map(file => {
            const source = path.join(work, file);
            assert.ok(fs.readFileSync(source, 'utf8').trimEnd().split(/\r?\n/).every(line => /^[SFMLE] /.test(line)));
            const glyph = readGlyph(kit, source);
            const alpha = scanGlyph(kit, glyph);
            glyph.outline.delete();
            fs.writeFileSync(path.join(work, file.replace('.wic.path', '.wic-skia.alpha')), alpha);
            return { file, ...compare(alpha, fs.readFileSync(path.join(work, file.replace('.path', '.alpha')))) };
        });
        stages.sameLines = { masks: sameLines, images: compose('sameLines', { ...environment, CC2D_STROKE_REPLAY: 'wic-skia' }) };
        report.configurations[config] = { executableSha256: hash(binary), expandedMasks, stages };
    }
    assert.deepEqual(report.configurations.out.stages, report.configurations['out-release2'].stages);
    assert.deepEqual(report.configurations.out.expandedMasks, report.configurations['out-release2'].expandedMasks);
    const destination = path.join(scratch, 'comparison.json');
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    console.log('CanvasKit expanded versus direct strokes:', JSON.stringify({
        mismatchedMasks: report.configurations.out.expandedMasks.filter(row => row.max > 1).length,
        mismatchedMaskSamples: report.configurations.out.expandedMasks.reduce((sum, row) => sum + row.pixels, 0),
    }));
    for (const [stage, { masks, images }] of Object.entries(report.configurations.out.stages)) {
        console.log(stage, JSON.stringify({
            mismatchedMasks: masks.filter(row => row.max > 1).length,
            mismatchedMaskSamples: masks.reduce((sum, row) => sum + row.pixels, 0),
            imagesWithinTolerance: images.filter(row => row.max <= 1).length,
            imageDifferences: images.reduce((sum, row) => sum + row.pixels, 0),
            maximumImageDifference: Math.max(...images.map(row => row.max)),
        }));
    }
    console.log(destination);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
