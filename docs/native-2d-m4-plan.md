# Native 2D M4 Mask + Graphics 收口计划

> 状态：**M4.0 RECT Mask 已完成**。native Mask/JS 薄壳/黑白 stencil 像素回归通过；ELLIPSE/SPRITE/GRAPHICS 与 Graphics 仍未开始。
> 结论：现在不能把 M4 标记为收口；本文给出可执行的收口路径和门禁。

## 1. 现状核对

v4 native 2D 组件目前只有：

```text
native/cocos/2d/components/Sprite.*
native/cocos/2d/components/Label.*
```

不存在：

- native `Mask`；
- native `Graphics`；
- Mask/Graphics 的 JSB 薄壳；
- M4 专用像素/GUP 回归。

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
- 嵌套两层 Mask 尚未测。

退出：

- 矩形裁剪像素对照；通过；
- inverted 像素对照；通过；
- 嵌套两层 Mask 的 stencil 恢复正确。

### M4.1 椭圆 / Sprite / Graphics Stencil

- `GRAPHICS_ELLIPSE`；
- `GRAPHICS_STENCIL`（依赖 Graphics 基础）；
- `SPRITE_STENCIL`（SpriteFrame alpha）；
- `segments` / `alphaThreshold`。

### M4.2 Graphics 基础

先明确边界：

- 路径 API 保留 JS 批量提交（避免逐 `lineTo` JSB）；
- native 负责 path flatten、三角化、mesh 提交；
- 或者 M4 作为兼容阶段，用 Canvas 路径栅格化为纹理，后续再替换为 native 三角化。

必做路径：

- moveTo/lineTo/bezierCurveTo/quadraticCurveTo/arc/ellipse/rect/roundRect/close；
- fill / stroke；
- lineWidth、lineJoin、lineCap、miterLimit；
- fillColor/strokeColor；
- earcut 三角化或兼容栅格化。

### M4.3 回归

- Mask RECT/ELLIPSE/SPRITE/GRAPHICS 像素；
- inverted + 嵌套；
- Graphics 常用路径与 Web 截图；
- 性能：路径批量提交 vs 原生三角化结论。

## 3. 门槛

M4 收口必须同时满足：

1. native Mask 与 JS Mask 行为一致；
2. native Graphics 至少覆盖常用路径；
3. Web/native 像素或有明确容差的截图；
4. 嵌套 Mask 的 stencil 正确；
5. `run-m0-checks.ps1` 增加 M4 探针，且 M2/M3 不回归。

## 4. 风险

- Mask 依赖 `Batcher2d` 的子树遍历与 stencil 生命周期，不能只做一个 quad；
- Graphics 逐 API JSB 会变慢，路径必须在 JS 批量收集；
- `SPRITE_STENCIL` 需要 alpha 采样/材质变体；
- 当前没有 M4 测试夹具，需要先补 Web 基线。

## 5. 建议下一步

先做 **M4.0 RECT Mask**，不要同时开 Graphics。RECT Mask 跑通 stencil 生命周期后，Graphics 才有可靠的裁剪回归。
