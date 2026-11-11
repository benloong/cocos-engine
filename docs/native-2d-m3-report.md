# Native 2D M3 Label/文本栈收口报告

> 范围：`cocos/2d` Label 文本栈。  
> 结论：Windows native M3 通过；跨平台字体矩阵留到 M6。

## 1. 架构

```text
JS Label (label.jsb.ts)
  ├─ 序列化 / 公开 API / 生命周期
  └─ native Label
       ├─ TTF: Canvas delegate measure/layout/texture
       ├─ BMFont: SpriteFrame atlas + glyph definitions + kerning
       ├─ CHAR: LetterAtlas 1024×1024 + 字符复用
       └─ BITMAP: DynamicAtlas 1024×1024 + 区域 SpriteFrame
```

JS 不再承担文本排版、glyph 栅格化或图集合成。native 只通过 `n2d.Label` 暴露必要 API。

## 2. 主要文件

| 文件 | 职责 |
|---|---|
| `native/cocos/2d/components/Label.h/.cpp` | TTF/BMFont/CHAR/BITMAP、outline/shadow、纹理生成 |
| `native/cocos/2d/renderer/LetterAtlas.h/.cpp` | CHAR 字符图集 |
| `native/cocos/2d/renderer/DynamicAtlas.h/.cpp` | BITMAP 共享图集 |
| `native/cocos/2d/renderer/TextMetrics.h/.cpp` | 独立文本测量入口 |
| `cocos/2d/components/label.jsb.ts` | Label 薄壳 |
| `native/tests/2d-poc/run-m3-label-probe.ps1` | 纹理/GPU 回归 |

## 3. 验证数据

### TTF

| case | native texture | contentSize |
|---|---|---|
| Hello Label, 32 | 242×53 | 240×50.4 |
| 你好，世界, 32 | 242×53 | 240×50.4 |
| 长文本 24 + wrap | 222×100 | 220×97.8 |

Web 对照 contentSize 完全一致。

### Outline/Shadow

```text
English checksum 2387670896, opaque 3697, GPU colored 3851
Wrap GPU colored 4147
CJK GPU colored 2263
```

### BMFont

```text
程序化 ABBA: 62×23, opaque 960  （A→B -4 kerning）
真实 OpenSans-Bold: 100×28, opaque 872
```

### CHAR

```text
CJK: 162×53, opaque 1059
ASCII: 205×43, opaque 2151, GPU colored 2917
```

### BITMAP

```text
两个 Label 共享一张 atlas texture
region A.x=0, B.x=183
```

## 4. 回归

```text
99 / 7 / 10 / 12 / 18 checks, 0 failures
M2 pixel probe: PASS
M3 Label probe: PASS
Jest: 20 passed
M0 checks passed
```

## 5. 已知限制

- Windows 字体后端已测；mac/iOS/Android/OHOS 未测；
- BITMAP 图集没有淘汰、多页；新增区域会整页上传；
- CHAR 图集是 CPU 图集，没有 GPU 常驻和淘汰；
- BMFont 单图集，未覆盖多页；
- Sprite + Label 同 atlas 的合批数尚未统计。

## 6. 下一步

M3 关闭。后续在 M4 Mask/Graphics 或 M6 平台/资产硬化中处理：

1. 图集淘汰/多页；
2. 跨平台字体矩阵；
3. 合批统计；
4. BMFont 多页。
