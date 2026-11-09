# Native 2D M2 Sprite 启用门槛

> 适用：`sprite.jsb.ts` 从候选壳切换为 NATIVE 生产 override。
> 当前：`sprite.enabled = true`，Sprite override 已启用。
> 已知风险：RenderTexture 五种模式探针已通过；Web golden 和 ≥30% 性能 KPI 尚未闭环。

## 1. 已通过

| 门槛 | 状态 | 证据 |
|---|---|---|
| native UIRenderer | 通过 | color/material/priority/blend、shared materials、getRenderMaterial fallback |
| Sprite SIMPLE | 通过（drawInfo） | 4 顶点 / 6 索引 |
| Sprite SLICED | 通过（drawInfo） | 16 顶点 / 54 索引 |
| Sprite TILED | 通过（drawInfo） | 200×100 / 100×100 frame → 8/12 |
| Sprite FILLED H/V | 通过（drawInfo） | 裁剪 quad 4/6 |
| Sprite FILLED RADIAL | 通过（drawInfo） | 26 顶点 / 72 索引，边界裁剪 |
| SpriteFrame native cache | 通过 | texture/rect/originalSize/offset/rotated/insets |
| 真实 PNG → SpriteFrame | 通过 | `resources.load('M2Sprite/spriteFrame')` 成功 |
| Creator native 挂载 | 通过 | shell onLoad/setNode/setFrame |
| Batcher2d batch | 通过 | `Batcher2d::batches 2` |
| custom pipeline 提交 | 通过 | `draw2D` → `submitUICommands` → pass phase 匹配 → `cmdBuff->draw` |
| 可见渲染 | 通过（人工） | native 窗口可见 64×64 红色 Sprite |
| RenderTexture 像素 | 通过 | Canvas 相机 targetTexture + 256×256 RT + readPixels；五种模式 red>0，`M2_PIXEL_RESULT ok` |
| override 启用运行 | 通过 | `new n2d.Sprite()`、真实 SpriteFrame、无 TypeError、应用响应正常 |
| 回归 | 通过 | `75 checks, 0 failures`；M0 checks passed；Jest 16/16 |

## 2. 未通过 / 未覆盖

1. **自动 Web-native 像素对照**：Windows Graphics Capture 返回
   `E_ACCESSDENIED`；RenderTexture 离屏探针已通过，五种模式 red>0。
   仍需把 Web 端 golden 拉进来做真正的 Web/native diff。
2. **完整性能 KPI**：Release 中位数 native 225.0 ns/sprite、JS 316.6 ns/sprite，
   提升 28.9%（最好样本 41%，未稳定达到 ≥30%）；native prepare 60.1 ns/op。
3. **Web golden**：v4 Web 构建在 headless Chrome 下报
   `texSubImage2D Overload resolution failed`，headful 也仅显示空画布；
   目前只有 native RT 像素探针，没有 Web golden diff。
4. material instance 解析（shared material 已下沉）。
5. SpriteFrame 完整 native 资产化与 insets 边界。
6. Tiled/Filled 的旋转 atlas frame 坐标组合。

## 3. 启用记录

已执行：

1. `m2-components.json`：`sprite.enabled = true`；
2. `cc.config.json` NATIVE override：
   `cocos/2d/components/sprite.ts → cocos/2d/components/sprite.jsb.ts`；
3. 重新生成 native engine bundle，`cc.js` 包含 `new n2d.Sprite()`；
4. 重新编译 native exe，运行 Creator 场景；
5. 真实 64×64 PNG SpriteFrame 显示，应用无崩溃/TypeError；
6. `run-m0-checks.ps1` 全量通过；
7. `run-m2-pixel-probe.ps1` 通过：五种模式 `red>0`，`M2_PIXEL_RESULT ok`。

未执行：

- Web 端 golden 与 native RT 像素 diff；
- 完整性能基准。

## 4. 当前建议

Sprite override 已启用，但按以下方式监控：

- 任何 native 2D 视觉回归优先回滚 `cc.config.json` 的 Sprite override 与
  `m2-components.json` 开关，并重建 engine bundle；
- CI/发布前把 Web golden 接到 RenderTexture 探针，做真正的像素 diff；
- material instance、SpriteFrame 完整资产化、旋转 atlas 组合按 M3 前置项处理。
