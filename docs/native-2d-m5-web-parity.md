# Native 2D M5 RichText Web/native 场景级对照

> 结论：结构一致，但布局和样式继承仍有差异，**不能标记逐像素通过**。

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
| contentSize | 300×104.32 | 300×136.32 |
| colored | 10100 | 7513 |
| hit / miss | true / false | true / false |
| outlineWidth | 只有 outline 段为 2（已修） | 只有 outline 段为 2 |

## 3. 差异

### 高度差 32

```text
native 136.32 - web 104.32 = 32
```

正好一个 `lineHeight`。说明 `<br/>` 在 native 端多算了一行，或 Web RichText 忽略了该换行段。

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
native 7513
```

主要由 outline 泄漏和高度差导致，不能直接作为像素通过。

## 4. 结论

已确认：

- 段结构一致；
- 图片段一致；
- hit test 一致；
- 布局和样式继承仍有差异。

因此 **Web/native RichText 对照未通过**，需要修：

1. `<br/>` 的空行高度；
2. outline 样式按段复位；
3. 再重跑 colored 对照。
