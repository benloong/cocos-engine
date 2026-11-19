# 2D native PoC tests (M0)

Standalone tests for the pure parts of the M0 vertical slice:

- `native/cocos/2d/framework/UITransformMath.{h,cpp}` — bounding boxes and point conversion.
- `native/cocos/2d/renderer/SpriteGeometry.{h,cpp}` — SIMPLE sprite quad, UVs and world transform.
- `native/tests/2d-poc/test_2d_poc.cpp` — 39 assertions.

The test does **not** link the engine or `native/external`. It compiles only the
math sources and forces the Emscripten platform id so `MathBase` skips the
boost-based hash include. This keeps the test runnable on a machine without the
native external dependency package.

Run on Windows:

```powershell
pwsh ./native/tests/2d-poc/run-poc-tests.ps1
```

Expected output:

```
39 checks, 0 failures
```

Run all runnable M0 checks (C++ + PNG + tsc + Jest when `node_modules` exists):

```powershell
pwsh ./native/tests/2d-poc/run-m0-checks.ps1
```

PNG comparison helper (usable by the Web/native harness once captures exist):

```powershell
node ./native/tests/2d-poc/test-compare-png.js
node ./native/tests/2d-poc/compare-png.js <reference.png> <actual.png> --tolerance 1 --diff out.png
```

`compare-png.js` reports total pixels, differing pixels, max channel delta and
optionally writes a diff image. `--fail-on-diff` turns any difference above the
tolerance into exit code 1.

`visual-check.js` wraps the comparator into a versioned report (scene name,
Web/native engine versions, SHA-256 of both images, tolerance, diff pixels,
max channel delta, pass/fail, diff image path):

```powershell
node ./native/tests/2d-poc/visual-check.js `
  --reference ref.png --actual actual.png --scene sprite-simple `
  --web-engine 4.0.0-web --native-engine 4.0.0-native `
  --tolerance 1 --diff diff.png --out report.json
```

This covers the algorithm and image-comparison halves of M0.

## Native smoke test

`native/CMakeLists.txt` builds the real `cocos_engine` static library and links a
small console program (`native/main.cpp`). It initializes the GFX device, V8 and
`Root`, then verifies:

- `Node` + `UITransform` bounds, space conversions and world hit test;
- JSB runtime binding: `new n2d.UITransform()` / `new n2d.Sprite()` and their
  scalar setters/getters from an evaluated JavaScript snippet;
- SIMPLE sprite quad geometry;
- `Sprite::prepare()` creating a `RenderEntity` draw info with 4 vertices and
  6 indices plus material/texture.

Requires the v4 `native/external` package (tag `v4.0.0-10`). Run from an
"x64 Native Tools Command Prompt for VS" (or call `vcvars64.bat` first) so that
Ninja can find `cl.exe` and the MSVC standard library:

```powershell
cmake -S ./native/tests/2d-poc/native -B ./native/tests/2d-poc/native/out -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build ./native/tests/2d-poc/native/out --target cc2d_native_poc -- -j 8
./native/tests/2d-poc/native/out/cc2d_native_poc.exe

# Release
cmake -S ./native/tests/2d-poc/native -B ./native/tests/2d-poc/native/out-release -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build ./native/tests/2d-poc/native/out-release --target cc2d_native_poc -- -j 8
./native/tests/2d-poc/native/out-release/cc2d_native_poc.exe
```

Expected tail (values are machine dependent):

```
jsb bindings result: OK
native sprite prepare: 58.8 ns/op
native sprite scene: 1000 sprites, 230.6 us total, 230.6 ns/sprite
native 2D PoC: PASS
```

A JS-side reference for the same geometry work is in
`tests/ui/native-2d-poc-bench.test.ts` (Jest, no GPU).

## Web/native sprite geometry parity

`run-sprite-quad-parity.ps1` extracts the Web `Sprite.updateRenderer()`
quad (4 positions from `RenderData.data`), extracts the native
`buildSimpleSpriteQuad()` quad, rasterizes both into 100×100 solid PNGs, and
compares them:

```powershell
pwsh ./native/tests/2d-poc/run-sprite-quad-parity.ps1
```

Expected:

```
10 checks, 0 failures
{"diffPixels":0,"maxChannelDelta":0,"passed":true}
```

This is a geometry-level check, not a full GPU render: the Web path needs a
Creator builtin material bundle before the whole Sprite can be drawn (see
`web/README.md`).

The thin-shell contract is checked statically:

```powershell
node ./native/tests/2d-poc/check-thin-shell.js
```

`web/` contains a headless-Chrome boot probe for the H5 engine. Install
`systemjs` with `npm install --no-save systemjs`, build the engine with
`npm run build:dev`, run `node ./native/tests/2d-poc/web/server.js`,
and load `http://127.0.0.1:8130/native/tests/2d-poc/web/index.html`; it reaches
`BOOT OK` after `game.init`. Scene rendering and canvas readback are still WIP.

Native scene deserialization/`getComponent` through the engine JS runtime and
Web/native pixel capture are still open; the smaller Web-side registration and
`instantiate()` checks live in `tests/ui/ui-component-registration.test.ts`.
