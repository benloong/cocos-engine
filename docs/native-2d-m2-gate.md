# Native 2D M2 Sprite 启用门槛

> 适用：`sprite.jsb.ts` 从候选壳切换为 NATIVE 生产 override。
> 当前：`sprite.enabled = true`，Sprite override 已启用。
> 已知风险：RenderTexture 五种模式在 native/Web 均通过且 red=7936、center=[128,0,0,255]、maxR=128；性能 KPI 通过。

## 1. 已通过

| 门槛 | 状态 | 证据 |
|---|---|---|
| native UIRenderer | 通过 | color/material/priority/blend、shared materials、getRenderMaterial fallback |
| Sprite SIMPLE | 通过（drawInfo） | 4 顶点 / 6 索引 |
| Sprite SLICED | 通过（drawInfo） | 16 顶点 / 54 索引 |
| Sprite TILED | 通过（drawInfo） | 200×100 / 100×100 frame → 8/12 |
| Sprite FILLED H/V | 通过（drawInfo） | 裁剪 quad 4/6 |
| Sprite FILLED RADIAL | 通过（drawInfo） | 26 顶点 / 72 索引，边界裁剪 |
| SpriteFrame native asset | 通过 | Asset + IntrusivePtr texture、uuid/name、rect/offset/original/insets |
| SpriteFrame 薄壳 | 通过 | `sprite-frame.jsb.ts` 持有 native frame，Sprite 使用 `spriteFrame.native` |
| 旋转 atlas | 通过 | SIMPLE/SLICED/TILED/FILLED/RADIAL 纯 C++ 用例 |
| 真实 PNG → SpriteFrame | 通过 | `resources.load('M2Sprite/spriteFrame')` 成功 |
| Creator native 挂载 | 通过 | shell onLoad/setNode/setFrame |
| Batcher2d batch | 通过 | `Batcher2d::batches 2` |
| custom pipeline 提交 | 通过 | `draw2D` → `submitUICommands` → pass phase 匹配 → `cmdBuff->draw` |
| 可见渲染 | 通过（人工） | native 窗口可见 64×64 红色 Sprite |
| RenderTexture 像素 | 通过 | native/Web 均为 red=7936、maxR=128、center=[128,0,0,255] |
| Material instance | 通过 | `M2_MATERIAL_INSTANCE hasInstance=true distinct=true`，真实 ui-sprite effect |
| override 启用运行 | 通过 | `new n2d.Sprite()`、真实 SpriteFrame、无 TypeError、应用响应正常 |
| 回归 | 通过 | `75 checks, 0 failures`；M0 checks passed；Jest 16/16 |
| 性能 | 通过 | Release native 143~220 ns/sprite vs JS 288~389，约 45~50% 提升 |

## 2. 未通过 / 未覆盖

无阻塞项。TS `UIRenderer` 继承链与默认启用策略留到 M3 前评审。
## 3. 启用记录

已执行：

1. `m2-components.json`：`sprite.enabled = true`；
2. `cc.config.json` NATIVE override：
   `cocos/2d/components/sprite.ts → cocos/2d/components/sprite.jsb.ts`；
3. 重新生成 native engine bundle，`cc.js` 包含 `new n2d.Sprite()`；
4. 重新编译 native exe，运行 Creator 场景；
5. 真实 64×64 PNG SpriteFrame 显示，应用无崩溃/TypeError；
6. `run-m0-checks.ps1` 全量通过；
7. `run-m2-pixel-probe.ps1` 通过：五种模式 `red>0`，`M2_PIXEL_RESULT ok`；
8. `run-m2-perf.ps1` 通过：Release native 约 143~220 ns/sprite，
   相对 JS 288~389 ns/sprite 提升约 45~59%。

未执行：

- Web 端 golden 与 native RT 像素 diff。

## 4. 当前建议

Sprite override 已启用，但按以下方式监控：

- 任何 native 2D 视觉回归优先回滚 `cc.config.json` 的 Sprite override 与
  `m2-components.json` 开关，并重建 engine bundle；
- CI/发布前把 Web golden 接到 RenderTexture 探针，做真正的像素 diff；
- M3 直接进入 Label/文本栈；M2 的 SpriteFrame/旋转 atlas 已闭环。
