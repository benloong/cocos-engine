# Web boot probe

Minimal headless-Chrome harness that loads the engine built by
`npm run build:dev` (`bin/dev/cc`) through SystemJS, boots the GFX device and
reaches `game.init`. It is the starting point for Web/native screenshot
comparison.

From the repository root (`v4`):

```powershell
npm install --no-save systemjs
npm run build:dev
node ./native/tests/2d-poc/web/server.js
```

Open `http://127.0.0.1:8130/native/tests/2d-poc/web/index.html`. With headless
Chrome:

```powershell
chrome --headless=old --disable-gpu --no-sandbox `
  --virtual-time-budget=12000 --dump-dom `
  http://127.0.0.1:8130/native/tests/2d-poc/web/index.html
```

- `index.html`: expected status `BOOT OK` (engine modules + `game.init`).
- `scene.html`: expected status `SCENE OK` (adds Canvas/Camera/Sprite on top of
  the boot probe). Do not call `game.step()` there yet; the first headless WebGL
  frame raises `TypeError: Overload resolution failed`.

Known gap: creating the Canvas/Camera/Sprite scene works (`scene.html`).
`render.html` additionally runs five frames. The first failure was inside
`DynamicAtlasManager.packToDynamicAtlas` → `copyTexImagesToTexture` at a
9-argument `texSubImage2D` (`TypeError: Overload resolution failed`). Disabling
`dynamicAtlasManager.enabled` gets past that (`RENDER OK`), but the Sprite is
still not drawn because the minimal bootstrap only initializes textures, not the
builtin material assets: `builtinResMgr.get('ui-sprite-material')` is undefined,
so `Sprite._material` is null and `_canRender()` is false.

Rendering a Sprite on Web therefore needs the Creator builtin asset bundle
(effect/material assets), not just the engine modules. A real Creator project,
or a hand-built material/effect, is required for the Web/native pixel report.
