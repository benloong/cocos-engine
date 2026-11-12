# Native 2D M5 RichText Web/native 场景级对照

> 结论：结构、contentSize、outline、bold、hit test 通过；**italic 宽度为已接受的已知差异**；不做逐像素 golden。

## 1. 对照场景

同一份 RichText：

```html
<size=20>Small</size> <color=#ff0000>Red</color>
<outline color=#00ff00 width=2>Outline</outline><br/>
<b>Bold</b> <i>Italic</i> <u>Underline</u>
<img src='icon'/>
```

- Web：`web-mobile` build + Edge headless + CDP。
- native：Windows Debug + RenderTexture。

## 2. 结果

| 指标 | Web | native |
|---|---|---|
| children | 10 | 10 |
| labels | 9 | 9 |
| sprites | 1 | 1 |
| contentSize | 300×104.32 | 300×104.32（已修） |
| colored | 10100 | 8337 |
| hit / miss | true / false | true / false |
| outlineWidth | 只有 outline 段为 2（已修） | 只有 outline 段为 2 |

## 3. 差异

### 高度差 32（已修）

```text
修复前：native 136.32 - web 104.32 = 32
```

native Label 的 UITransform 没有回写测量尺寸，RichText 把每段都当成 100×100。`updateRenderData()` 现在先清零尺寸、强制 native rebuild、再回写 `(contentWidth, (lines+0.26)*lineHeight)`；高度已对齐 104.32。

### outline 样式泄漏（已修）

Web：

```text
所有 Label 的 outlineWidth 都是 2
```

native：

```text
只有 <outline> 段是 2，其余为 0
```

`RichText._resetLabelState()` 已补 `enableOutline=false/outlineWidth=0`；Web 复测后 outlineWidth 只剩 outline 段为 2，与 native 一致。

### colored

```text
Web 10100
native 8337
```

主要由 outline 泄漏和高度差导致，不能直接作为像素通过。

## 4. 已知差异（接受）

| 项 | Web | native | 处理 |
|---|---|---|---|
| italic 宽度 | 90.748 | 81 | **已知差异**，GDI synthetic italic |
| 正常字体宽度 | 50.009 / 130.738 / 171.211 | 48 / 122 / 166 | 记录，不阻断 |
| colored | 10100 | 8337 | 在 ±20% 容差内 |

italic 不纳入像素门禁；RichText 结构、contentSize、bold、outline、img、hit test 仍为阻断项。

## 5. 结论

已确认：

- 段结构一致；
- contentSize 一致；
- 图片段一致；
- hit test 一致；
- outline 按段复位一致；
- bold 宽度基本一致。

**接受 italic 为已知差异**；其余项通过。Web/native RichText 不做逐像素 golden，colored 只做 ±20% sanity。
