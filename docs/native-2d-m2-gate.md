# Native 2D M2 Sprite 启用门槛

> 适用：`sprite.jsb.ts` 从候选壳切换为 NATIVE 生产 override。
> 当前：`sprite.enabled = false`；五种模式的 native 几何/prepare 已实现，
> 但尚无可靠的可见像素/像素对照。

## 1. 已通过

| 门槛 | 状态 | 证据 |
|---|---|---|
| native UIRenderer | 通过 | color/material/priority/blend、shared materials、getRenderMaterial fallback |
| Sprite SIMPLE | 通过（drawInfo） | 4 顶点 / 6 索引 |
| Sprite SLICED | 通过（drawInfo） | 16 顶点 / 54 索引 |
| Sprite TILED | 通过（drawInfo） | 200×100 / 100×100 frame → 8/12 |
| Sprite FILLED H/V | 通过（drawInfo） | 裁剪 quad 4/6 |
| Sprite FILLED RADIAL | 通过（drawInfo） | 26 顶点 / 72 索引 |
| SpriteFrame native cache | 通过 | texture/rect/originalSize/offset/rotated/insets |
| 真实 PNG → SpriteFrame | 通过 | `resources.load('M2Sprite/spriteFrame')` 成功 |
| Creator native 挂载 | 通过 | shell onLoad/setNode/setFrame |
| Batcher2d batch | 通过 | `Batcher2d::batches 2` |
| custom pipeline 提交 | 通过 | `draw2D` → `submitUICommands` → pass phase 匹配 → `cmdBuff->draw` |
| 回归 | 通过 | `73 checks, 0 failures`；M0 checks passed |

## 2. 未通过 / 未覆盖

1. **可见像素/Web-native 像素对照**：窗口截图/PrintWindow 不可靠，无法确认实际画面。
2. material instance 解析（shared material 已下沉）。
3. SpriteFrame 完整 native 资产化与 insets 边界。
4. Tiled/Filled 的旋转 atlas frame 坐标组合。
5. Sprite override 默认启用的性能/KPI 对比。

## 3. 启用步骤（满足第 2 节后）

1. 在 `m2-components.json` 将 `sprite.enabled` 置 true；
2. `cc.config.json` NATIVE override 增加：
   `cocos/2d/components/sprite.ts → sprite.jsb.ts`；
3. 重新生成 native engine bundle，确认包含 `new n2d.Sprite()`；
4. 跑 Creator native 场景、真实 SpriteFrame、五种模式；
5. 跑 Web/native 像素对照；
6. 运行 `run-m0-checks.ps1` 与 native Debug/Release；
7. 出问题回滚两处开关并重建。

## 4. 当前建议

保持 `sprite.enabled = false`。native 几何、drawInfo、batch 和 custom pipeline
提交链已通，但缺少可见像素对照，默认启用会把未经验证的 Sprite 渲染带进
所有 native 项目。
