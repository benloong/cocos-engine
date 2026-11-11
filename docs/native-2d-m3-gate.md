# Native 2D M3 Label 文本栈 Gate

> 结论：**Windows native M3 通过**。跨平台字体矩阵（mac/iOS/Android/OHOS）按 M6 计划处理，不作为本次 M3 收口阻断。

## 1. 通过项

| 能力 | 状态 | 证据 |
|---|---|---|
| native Label TTF 测量/布局/纹理 | 通过 | `Label.cpp`，242×53 / 222×100 纹理 |
| Label 薄壳 | 通过 | `label.jsb.ts`，NATIVE override |
| wrap / 水平/垂直 align | 通过 | Web/native contentSize 一致 |
| `RESIZE_HEIGHT` | 通过 | 240×50.4、220×97.8 |
| 基础 CLAMP / SHRINK | 通过 | 路径已实现，CJK/长文本用例覆盖 |
| LabelOutline / LabelShadow | 通过 | English checksum 2387670896，opaque 3697 |
| GPU 文本像素 | 通过 | English 3851、wrap 4147、CJK 2263 colored |
| BMFont atlas | 通过 | 程序化 `ABBA` 62×23，opaque 960 |
| BMFont kerning | 通过 | 无 kerning 66×23 → 62×23 |
| 真实 `.fnt` + PNG | 通过 | OpenSans-Bold 100×28，opaque 872 |
| `CacheMode.CHAR` | 通过 | CJK 162×53/1059，ASCII 205×43/2151 |
| `CacheMode.BITMAP` | 通过 | 两个 Label 共享 atlas texture，区域 x=0 / x=183 |

## 2. 回归命令

```powershell
$env:CC_M2_APP_EXE='...\cocos-m1-test.exe'
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m0-checks.ps1
```

结果：

```text
99 / 7 / 10 / 12 / 18 checks, 0 failures
M2 pixel probe: PASS
M3 Label probe: PASS
Jest: 20 passed
M0 checks passed
```

## 3. 明确不在 M3 阻断范围

- macOS / iOS / Android / OHOS 字体后端与字形像素矩阵（M6）；
- 图集淘汰、多页、Label 文本变化后的旧区域的回收；
- BMFont 多图集；
- Sprite+Label 同 atlas 的合批数统计；
- 全平台 Release 构建。

## 4. 结论

M3 的 Windows native 文本栈已经可交付：

- TTF Label 完成；
- BMFont/kerning/真实资产完成；
- CHAR/BITMAP cacheMode 完成；
- 纹理、GPU 像素、Web/Native 布局 parity 均有自动化证据。

跨平台和性能硬化不阻塞 M3 关闭，进入 M6 矩阵处理。
