# Native 2D M5 RichText Gate

> 结论：**M5.0 RichText 垂直切片（Windows）通过**。
> M5 还包含 `UIMeshRenderer`、`UIMesh`、Canvas/RenderRoot2D 桥、`UISkew`；这些尚未实现，因此 **M5 整体不能关闭**。

## 1. 通过项

| 能力 | 状态 | 证据 |
|---|---|---|
| 多段文本 + color/b/i | 通过 | 7 个 native Label 段 |
| 自动换行/内容尺寸 | 通过 | 300×104.32 |
| 文本段 GPU 像素 | 通过 | colored=4095 |
| `imageAtlas` 查找 | 通过 | `getSpriteFrame('icon')` 非空 |
| `<img>` 图片段 | 通过 | `sprites=1`，colored=4633 |
| 回归 | 通过 | M2/M3/M0/Jest |

## 2. 验证数据

纯文本：

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

带图片：

```text
M5_ATLAS {"found":true}
M5_RICHTEXT {
  children: 9,
  labels: 8,
  sprites: 1,
  width: 300,
  height: 104.32,
  colored: 4633
}
```

## 3. 回归

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
Jest: 20 passed
```

## 4. 不在 M5.0 范围

- native `SpriteAtlas` SWIG 构造：当前禁用，JS map 工作；
- `<br>/<size>/<outline>/<shadow>`；
- RichText 点击事件；
- 复杂对齐/最大宽度；
- Web/native 逐像素对照。

## 5. M5 未完成项

- `UIMeshRenderer`；
- `UIMesh`；
- Canvas/RenderRoot2D/SpriteRenderer 桥；
- `UISkew`；
- 弃用的 `UIStaticBatch` 不实现。

## 6. 结论

M5.0 RichText 可以关闭；M5 整体仍未收口。
