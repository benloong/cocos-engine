# Native 2D M4 Mask + Graphics Gate

> 结论：**Windows native M4 功能收口通过**。
> 跨平台矩阵、Web 像素对照和 native 三角化性能结论不在本次 Windows 收口范围，按计划留给 M6/M4.3。

## 1. 通过项

| 能力 | 状态 | 证据 |
|---|---|---|
| RECT Mask | 通过 | normal red=6400 |
| RECT inverted | 通过 | inverted red=44800 |
| ELLIPSE Mask | 通过 | ellipse red=5140（π/4≈5026） |
| SPRITE_STENCIL | 通过 | sprite red=3360（右半 alpha） |
| GRAPHICS_STENCIL | 通过 | red=1600（40×40） |
| 嵌套两层 Mask | 通过 | red=3600（60×60） |
| Graphics rect fill | 通过 | 80×80 → opaque=6400 |
| Graphics 路径 API | 基础通过 | moveTo/lineTo/rect/roundRect/circle/ellipse/arc/bezier/quadratic |
| Graphics fill/stroke | 基础通过 | 颜色、lineWidth |
| M2/M3 回归 | 通过 | M0 checks + Jest 20 |

## 2. 回归命令

```powershell
$env:CC_M2_APP_EXE='...\cocos-m1-test.exe'
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m0-checks.ps1

pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-mask-probe.ps1
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-extra-probe.ps1
```

结果：

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
Jest: 20 passed

M4 Mask probe: PASS
  normal red=6400, inverted red=44800
  ellipse red=5140, sprite red=3360
  Graphics opaque=6400

M4 extra probe: PASS
  GRAPHICS_STENCIL red=1600
  nested Mask red=3600
```

## 3. 明确不在本次阻断范围

- macOS / iOS / Android / OHOS 的 Mask/Graphics 像素矩阵（M6）；
- Web 与 native 的逐像素对照；
- native 三角化/GPU buffer：M4 采用 256×256 CPU 兼容栅格化；
- lineJoin/lineCap/miterLimit；
- Graphics 性能 KPI（CPU 光栅化成本）；
- Sprite/Graphics 合批统计。

## 4. 结论

Windows native M4 的 Mask 与 Graphics 功能栈已闭合：

- 四种 Mask 路径均有像素证据；
- 嵌套 stencil 正确；
- Graphics 基础 path/fill/stroke 可用；
- M2/M3 无回归。

上述非阻断项进入 M4.3/M6。M4 Windows 可以关闭。
