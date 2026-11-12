# Native 2D M5.0 RichText 垂直切片

> 结论：**文本段切片通过**。RichText 保留 JS 解析，段落实例下沉到 native Label；图片段、事件和完整 RichText 语义仍未闭环。

## 1. 架构

```text
JS RichText（保留 HTML 解析/布局）
  ├─ <color>/<b>/<i> 样式 → native Label 段
  ├─ 每个段一个 Node + Label
  └─ 图片段预留 Sprite + SpriteFrame
```

不新增 native RichText 组件。RichText 的 HTML 解析、样式继承、布局仍由 JS 完成；native 只负责 Label/Sprite 的渲染。

## 2. 修复

RichText 会调用：

```ts
label.updateRenderData(true);
```

native Label 薄壳之前没有这个方法，导致：

```text
TypeError: label.updateRenderData is not a function
```

已在 `label.jsb.ts` 增加兼容空实现。native Label 的 `string/lineHeight` setter 已经会触发重建；RichText 的显式调用只是保持 API 兼容。

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
- native `SpriteAtlas` Asset 已实现，但当前 SWIG 构造在 Windows 原生下会直接退出，薄壳暂时禁用 native 注册，只用 JS map 提供 RichText 查找。

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

## 5. 当前边界

已覆盖：

- 多段文本；
- color/b/i 样式；
- 自动换行；
- native Label 渲染；
- `imageAtlas` + `<img>` 图片段。

未覆盖：

- native SpriteAtlas SWIG 构造（当前禁用，需单独修 binding）；
- `<br>`、`<size>`、`<outline>`、`<shadow>`；
- 点击事件/hit test；
- 复杂对齐/最大宽度；
- 与 Web RichText 的逐像素对照。

## 6. 下一步

1. 修 native `SpriteAtlas` SWIG 构造并重新启用薄壳 native 注册；
2. 样式标签完整矩阵；
3. 事件/hit test；
4. Web/native 场景级对照。
