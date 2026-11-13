# Native 2D M4 Mask + Graphics 收口计划

> 状态：**M4.0 RECT + M4.1 ELLIPSE/SPRITE_STENCIL + M4.2 Graphics 基础 + GRAPHICS_STENCIL + 嵌套 Mask 已通过**。native 三角化按兼容栅格化方案暂缓。
> 更新：2026-11-13。M4 Windows 功能阶段已收口，见 [M4 Gate](./native-2d-m4-gate.md)。终态尚未完成：三角化/GPU buffer、完整描边语义、Web 对照和性能并入 [M6.3](./native-2d-m6-plan.md)，平台硬化并入 M6.4。下文保留阶段设计，未新增运行通过结论。

## 1. 现状核对

当前已存在 native Mask/Graphics、对应 JSB override，以及 M4 Mask/extra 探针。Graphics 当前是 256×256 CPU RGBA 光栅化、path flatten 与内部 Sprite 提交；JS 路径 API 逐调用转发，还没有批量提交性能结论。

已有可复用基础：

- `Batcher2d` 的 Mask/stencil 分支；
- `StencilManager`（CLEAR/ENTER_LEVEL/EXIT_LEVEL/INVERTED 等 stage）；
- `RenderEntity` 的 `MaskMode`；
- `UIMeshBuffer` / `RenderDrawInfo` / `UIModelProxy`；
- `CanvasRenderingContext2D` 路径绘制（可作为 Graphics 的兼容后备）。

## 2. Mask 收口拆分

### M4.0 RECT Mask（已通过）

目标：`Mask.Type.GRAPHICS_RECT` + `inverted` + 尺寸/圆角。

必做：

- native `Mask` 组件挂到 UIRenderer 槽位；
- 生成 mask quad；
- 设置 `RenderEntity::setMaskMode(MASK / MASK_INVERTED)`；
- 交给 `Batcher2d` 的 stencil 分支；
- JS 薄壳 `mask.jsb.ts`，保留序列化；
- 子树渲染被裁剪。

结果：

- `M4_MASK_PIXEL` normal red=6400（80×80）；
- inverted red=44800；
- 嵌套两层 Mask 已通过历史探针：red=3600。

退出：

- 矩形裁剪像素对照；通过；
- inverted 像素对照；通过；
- 嵌套两层 Mask 的 stencil 恢复正确；通过：red=3600。

### M4.1 椭圆 / Sprite / Graphics Stencil（ELLIPSE/SPRITE 已通过）

- `GRAPHICS_ELLIPSE`；通过：ellipse red=5140（π/4 面积约 5026）；
- `GRAPHICS_STENCIL`（依赖 Graphics 基础）；通过：red=1600；
- `SPRITE_STENCIL`（SpriteFrame alpha）；通过：sprite red=3360（右半 alpha）；
- `segments` / `alphaThreshold`。

### M4.2 Graphics 基础（兼容栅格化已通过）

先明确边界：

- 当前路径 API 在 JS 逐调用转发；批量命令提交是待测方案，不是已落地事实；
- 当前 native 做 path flatten、CPU RGBA 光栅化与内部 Sprite 提交，没有 Canvas path 依赖；
- M6.3 用 native 三角化/GPU buffer 替换兼容实现，并以 benchmark 决定提交粒度。

已落地：

- `graphics.jsb.ts` 薄壳；
- 256×256 CPU 光栅化；
- rect/circle/moveTo/lineTo/bezier/quadratic；
- fill/stroke/lineWidth/颜色；
- M4 Graphics 探针 opaque=6400。

仍待实现或独立验收：

- `roundRect` 圆角、ellipse、arc 角度；
- lineJoin/lineCap/miterLimit；
- native 三角化与 GPU buffer；

必做路径：

- moveTo/lineTo/bezierCurveTo/quadraticCurveTo/arc/ellipse/rect/roundRect/close；
- fill / stroke；
- lineWidth、lineJoin、lineCap、miterLimit；
- fillColor/strokeColor；
- M4 使用兼容栅格化；终态必须完成 native 三角化/GPU buffer。

### M4.3 回归

- Mask RECT/ELLIPSE/SPRITE/GRAPHICS 像素；
- inverted + 嵌套；
- Graphics 常用路径与 Web 截图；
- 性能：路径批量提交 vs 原生三角化结论。

## 3. 门槛

原始设计目标如下；Windows 阶段按 M4 Gate 收口，未满足的 Web 对照/完整语义/性能在 M6 继续阻断终态：

1. native Mask 与 JS Mask 行为一致；
2. native Graphics 至少覆盖常用路径；
3. Web/native 像素或有明确容差的截图；
4. 嵌套 Mask 的 stencil 正确；
5. `run-m0-checks.ps1` 增加 M4 探针，且 M2/M3 不回归。

## 4. 风险

- Mask 依赖 `Batcher2d` 的子树遍历与 stencil 生命周期，不能只做一个 quad；
- Graphics 逐 API JSB 存在边界成本风险；以 benchmark 决定批量收集/提交粒度；
- `SPRITE_STENCIL` 需要 alpha 采样/材质变体；
- 已有 native M4 探针；仍需补固定 Web 基线和自动对照。

## 5. 当前下一步

不重做已通过的 RECT/ELLIPSE/SPRITE/GRAPHICS 与嵌套基础探针。按 [M6.3](./native-2d-m6-plan.md) 完成 Graphics 三角化/GPU 提交、描边语义、曲线独立像素用例、提交粒度性能与 Mask 混合回归；按 M6.4 完成跨平台和生命周期验证。
