# Native 2D M5 RichText Gate

> 结论：**M5.0 RichText（Windows）收口通过**。
> M5 还包含 `UIMeshRenderer`、`UIMesh`、Canvas/RenderRoot2D 桥、`UISkew`；因此 **M5 整体仍未关闭**。

## 1. 通过项

| 能力 | 状态 | 证据 |
|---|---|---|
| 多段文本 + color/b/i/u | 通过 | 9 个 native Label 段 |
| `<size>` / `<br>` / `<outline>` | 通过 | 20/40px、换行、outline width 2 |
| 自动换行/内容尺寸 | 通过 | 300×104.32 |
| 文本段 GPU 像素 | 通过 | colored=7513 |
| `imageAtlas` | 通过 | native SpriteAtlas + JS map |
| `<img>` 图片段 | 通过 | sprites=1，colored=4633 |
| hit test | 通过 | hit=true / miss=false |
| Web/native 布局 | 通过 | contentSize 300×104.32 一致 |
| Web/native italic | 已知差异 | Web 90.748 / native 81（GDI） |
| 回归 | 通过 | M2/M3/M0/Jest |

## 2. 验证数据

```text
children=10, labels=9, sprites=1
width=300, height=104.32
colored=7513
hit=true, miss=false
```

Web/native：

```text
contentSize: 300×104.32 / 300×104.32
outline:     仅 outline 段=2
bold:        88.867 / 88
italic:      90.748 / 81   （已知差异）
colored:     10100 / 8337   （±20% 容差）
```

## 3. 回归

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
Jest: 20 passed
```

## 4. 已知差异（接受）

- italic 宽度：GDI synthetic italic，标记为已知差异，不纳入像素门禁；
- 正常字体宽度：GDI 比 DirectWrite 窄约 3–7%；
- colored 只做 ±20% sanity；
- 不做 Web/native 逐像素 golden。

## 5. 不在 M5.0 范围

- `UIMeshRenderer`；
- `UIMesh`；
- Canvas/RenderRoot2D/SpriteRenderer 桥；
- `UISkew`；
- 弃用的 `UIStaticBatch` 不实现。

## 6. 结论

M5.0 RichText 关闭；M5 整体仍未收口。
