# Native 2D M5 RichText Gate

> 结论：**M5.0 RichText（Windows）收口通过**。
> `Canvas`、`Camera`、`Widget`、`View`、`UIMeshRenderer`、`UIMesh`、`UISkew` 明确不下沉；M5 阶段功能关闭。
> 2026-11-13 口径同步：下列为历史 Windows 功能证据，未重跑。RichText 解析/布局仍在 JS，终态未通过；迁入 [M6.2](./native-2d-m6-plan.md)，不能以本 Gate 替代终态验收。

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

- `UIMeshRenderer`、`UIMesh`、`UISkew`：**不下沉**；
- RenderRoot2D：已下沉；
- Canvas/Camera/Widget/View：**不下沉，保持 JS**；
- 弃用的 `UIStaticBatch` 不实现。

## 6. 结论

M5.0 RichText 场景功能与 M5.1 RenderRoot2D 的 Windows 阶段完成；M6 继续完成 RichText 解析/布局 native 化、资产一致性、多 root/Camera 及平台硬化。
