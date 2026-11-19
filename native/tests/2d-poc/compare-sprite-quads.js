const fs = require('fs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '../../../node_modules/pngjs'));
const { comparePng, writeDiffPng } = require('./compare-png');

const dir = process.argv[2] || path.join(__dirname, 'out');
const web = JSON.parse(fs.readFileSync(path.join(dir, 'web-sprite-quad.json'), 'utf8'));
const native = JSON.parse(fs.readFileSync(path.join(dir, 'native-sprite-quad.json'), 'utf8'));

let checks = 0;
let failures = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) { failures++; console.log('FAIL: ' + message); }
};

const pos = (q) => q.vertices.map((v) => [v[0], v[1]]);
check(web.stride === 9 && native.stride === 9, 'position, UV and color stride');
check(web.vertices.length === 4 && native.vertices.length === 4, 'four vertices each');
for (let i = 0; i < 4; i++) {
  const v = web.vertices[i];
  const other = native.vertices[i];
  check(v.length === web.stride && other.length === native.stride
    && v.every((value, j) => Math.abs(value - other[j]) < 1e-4), `vertex ${i} attributes`);
}
check(web.indices.length === 6 && native.indices.length === 6, 'six indices each');
check(web.indices.every((index, i) => Number.isInteger(index) && index >= 0 && index < 4 && index === native.indices[i]), 'matching triangle indices');

function triangleContains(px, py, a, b, c) {
  const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
  const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
  const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function rasterize(quad) {
  const png = new PNG({ width: 100, height: 100 });
  const p = pos(quad);
  const triangles = [];
  for (let t = 0; t < quad.indices.length; t += 3) {
    const [a, b, c] = quad.indices.slice(t, t + 3).map(index => p[index]);
    const area = a && b && c && (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    check(Number.isFinite(area) && area !== 0, `nondegenerate triangle ${t / 3}`);
    if (area) triangles.push([a, b, c]);
  }
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const px = x - 49.5;
      const py = 49.5 - y;
      const inside = triangles.some(([a, b, c]) => triangleContains(px, py, a, b, c));
      const o = (y * 100 + x) * 4;
      png.data[o] = inside ? 255 : 0;
      png.data[o + 1] = inside ? 64 : 0;
      png.data[o + 2] = inside ? 32 : 0;
      png.data[o + 3] = 255;
    }
  }
  return png;
}

const webPng = rasterize(web);
const nativePng = rasterize(native);
const webFile = path.join(dir, 'web-sprite-quad.png');
const nativeFile = path.join(dir, 'native-sprite-quad.png');
fs.writeFileSync(webFile, PNG.sync.write(webPng));
fs.writeFileSync(nativeFile, PNG.sync.write(nativePng));

const diff = comparePng(webFile, nativeFile, 0);
check(diff.passed, 'rasterized quad pixels match');
const report = {
  web: webFile,
  native: nativeFile,
  checkedVertices: 4,
  triangles: 2,
  diffPixels: diff.diffPixels,
  maxChannelDelta: diff.maxChannelDelta,
  passed: failures === 0,
};
fs.writeFileSync(path.join(dir, 'web-native-sprite-report.json'), JSON.stringify(report, null, 2));
writeDiffPng(diff, path.join(dir, 'web-native-sprite-diff.png'));

console.log(`${checks} checks, ${failures} failures`);
console.log(JSON.stringify(report));
process.exit(failures === 0 && diff.passed ? 0 : 1);



