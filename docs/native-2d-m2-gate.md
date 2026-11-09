# Native 2D M2 Sprite 启用门槛

> 适用：`sprite.jsb.ts` 从候选壳切换为 NATIVE 生产 override。
> 当前：`sprite.enabled = true`，Sprite override 已启用。
> 已知风险：自动 GPU 截图被系统拒绝，Web/native 自动像素 diff 和完整性能 KPI 尚未闭环。

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
| override 启用运行 | 通过 | `new n2d.Sprite()`、真实 SpriteFrame、无 TypeError、应用响应正常 |
| 回归 | 通过 | `75 checks, 0 failures`；M0 checks passed；Jest 16/16 |

## 2. 未通过 / 未覆盖

1. **自动 Web-native 像素对照**：PrintWindow/BitBlt/DWM thumbnail 为黑屏；
   Windows Graphics Capture 返回 `E_ACCESSDENIED`。RenderTexture 探针
   （独立 UI 相机 + 256×256 RT）调用 `readPixels` 时五种模式都返回同一份
   均匀缓冲且 red=0，说明当前 custom pipeline 下 UI 相机没有写入 RT，
   需要修 RenderTexture/custom pipeline 的 target 选择，不能直接接入 CI。
2. **完整性能 KPI**：本次实测 JS `updateRenderer` 235.3 ns/sprite、1000
   Sprite 场景 341.8 ns/sprite；native Debug prepare 516.7 ns/op，M0 Release
   为 231 ns/sprite。当前微基准没有达到 ≥30% 的 M2 KPI，整帧 CPU/JS 堆/JSB
   调用仍需场景级测量。
3. material instance 解析（shared material 已下沉）。
4. SpriteFrame 完整 native 资产化与 insets 边界。
5. Tiled/Filled 的旋转 atlas frame 坐标组合。

## 3. 启用记录

已执行：

1. `m2-components.json`：`sprite.enabled = true`；
2. `cc.config.json` NATIVE override：
   `cocos/2d/components/sprite.ts → cocos/2d/components/sprite.jsb.ts`；
3. 重新生成 native engine bundle，`cc.js` 包含 `new n2d.Sprite()`；
4. 重新编译 native exe，运行 Creator 场景；
5. 真实 64×64 PNG SpriteFrame 显示，应用无崩溃/TypeError；
6. `run-m0-checks.ps1` 全量通过。

未执行：

- Web/native 自动像素 diff；
- 完整性能基准。

## 4. 当前建议

Sprite override 已启用，但按以下方式监控：

- 任何 native 2D 视觉回归优先回滚 `cc.config.json` 的 Sprite override 与
  `m2-components.json` 开关，并重建 engine bundle；
- 在 CI/发布前补齐自动截图（需要允许 Graphics Capture 的会话/权限）和性能基线；
- material instance、SpriteFrame 完整资产化、旋转 atlas 组合按 M3 前置项处理。
