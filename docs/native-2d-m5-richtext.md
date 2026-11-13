# Native 2D M5.0 RichText 垂直切片

> 更新：2026-11-13。文本段、图片段、样式矩阵及 hit/miss 已有 Windows 功能记录，最终阶段口径见 [M5 Gate](./native-2d-m5-gate.md)。RichText 解析/布局仍在 JS，完整事件语义与终态下沉见 [M6.2](./native-2d-m6-plan.md)。以下像素数据为历史记录，本次未重跑。

## 1. 架构

```text
JS RichText（保留 HTML 解析/布局）
  ├─ <color>/<b>/<i> 样式 → native Label 段
  ├─ 每个段一个 Node + Label
  └─ 图片段 → native Sprite + SpriteFrame
```

M5 阶段没有新增 native RichText 组件。HTML 解析、样式继承、布局仍由 JS 完成；native 只负责 Label/Sprite 渲染。M6.2 将解析、布局与段管理迁入 native，JS 保留事件/API 桥接。

## 2. 修复

RichText 会调用：

```ts
label.updateRenderData(true);
```

native Label 薄壳之前没有这个方法，导致：

```text
TypeError: label.updateRenderData is not a function
```

最初在 label.jsb.ts 增加兼容入口；后续已扩展为强制 native rebuild 并回写测量尺寸，不能继续视为空实现。高度差修复见 [Web/native 对照](./native-2d-m5-web-parity.md)。

## 3. 验证

探针：

```text
M5_RICHTEXT {
  segments: 7,
  labels: 7,
  sprites: 0,
  width: 300,
  height: 104.32,
  colored: 4095
}
```

内容：

```html
<color=#ff0000>Hello </color><b>Native</b>
<i>Rich</i> <color=#00ff00>Text</color> 123
```

结果：

- 7 个 Label 段；
- 内容尺寸 300×104.32；
- GPU 彩色像素 4095；
- 没有脚本异常。

命令：

```powershell
pwsh -NoProfile -File v4/native/tests/2d-poc/run-m5-richtext-probe.ps1
```

## 4. imageAtlas 薄壳与图片段

新增 `sprite-atlas.jsb.ts` 薄壳：

- JS 保留序列化 `name → SpriteFrame` map；
- `getSpriteFrame/getSpriteFrames/getTexture/add/remove/clear`；
- native SpriteAtlas Asset 已启用；此前字段冲突先通过 _nativeAtlas 隔离解决，当前直接导出 jsb.SpriteAtlas 并修改 prototype，已移除包装对象。原生表与 JS map 的一致性和 prototype 改造后的真实资产回归列入 M6.1。

M5-only 运行结果：

```text
M5_RICHTEXT_BEGIN
M5_ATLAS {"found":true}
M5_RICHTEXT {
  children:9,
  labels:8,
  sprites:1,
  width:300,
  height:104.32,
  colored:4633
}
```

说明：

- `imageAtlas.getSpriteFrame('icon')` 非空；
- `<img src='icon'/>` 生成了 1 个 native Sprite 段；
- 图片段像素参与 GPU 输出，colored 从纯文本的 4095 提升到 4633。

## 5. 样式矩阵

标签覆盖：

- `<size>`：fontSize 20/40；
- `<color>`；
- `<br>`：换行；
- `<outline color width>`：outline=true/width=2；
- `<b>`：native font 变 bold；
- `<i>`：native font 变 italic；
- `<u>`：native 下划线；
- `<img>`：imageAtlas。

早期矩阵探针（高度修复前；后续 Web/native 对照为 300×104.32）：

```text
children=10, labels=9, sprites=1, 300x136.32, colored=7513
```

## 6. 事件/hit test

矩阵探针额外验证：

```text
hit=true, miss=false
```

使用 `UITransform.getBoundingBoxToWorld()` + RichText `_containsTouchLocation`；说明段级命中区域可用。事件分发仍由 JS RichText 负责。

## 7. 当前边界

已有 Windows 功能证据：多段文本、color/b/i/u、size/br/outline、自动换行、native Label、imageAtlas/img、段结构/contentSize 与 hit/miss。Web/native italic 宽度为已接受差异，colored ±20% 仅作 sanity，见 [场景级对照](./native-2d-m5-web-parity.md)。

仍待完成：shadow、复杂嵌套/对齐/最大宽度、实际点击回调分发与解绑的完整矩阵；HTML 解析/布局/段管理 native 化；SpriteAtlas 依赖解析后 native 表同步与资产生命周期；平台硬化。hit/miss 不代表完整事件链已验收。

## 8. 下一步

M5 Windows 场景功能已收口。后续按 [M6 计划](./native-2d-m6-plan.md) 执行终态任务，不再重复安排已通过的图片段/基础样式探针，也不将阶段通过视为薄壳终态完成。
