# Native 2D M4 Mask + Graphics 收口报告

> 范围：`cocos/2d` Mask、Graphics。  
> 结论：Windows native M4 功能收口通过；跨平台与 native 三角化后置。

> 2026-11-13 同步：以下为既有 Windows 验证记录，未重跑。M4 功能通过不等于终态通过；Graphics 三角化/描边/性能与 Web 对照承接到 [M6.3](./native-2d-m6-plan.md)，平台与稳定性归 M6.4。

## 1. 架构

```text
JS Mask (mask.jsb.ts)
  ├─ RECT / ELLIPSE / SPRITE_STENCIL / GRAPHICS_STENCIL
  ├─ Graphics 子节点提供 alpha shape
  └─ native Mask
       ├─ RenderEntity maskMode（MASK / MASK_INVERTED）
       ├─ Batcher2d + StencilManager
       ├─ 2×2 白纹理（RECT）
       ├─ 64×64 椭圆 alpha 纹理（ELLIPSE）
       └─ SpriteFrame / Graphics frame（SPRITE / GRAPHICS）

JS Graphics (graphics.jsb.ts)
  └─ native Graphics
       ├─ 256×256 CPU RGBA 光栅化
       ├─ path flatten
       └─ 内部 Sprite 提交
```

## 2. 主要文件

| 文件 | 职责 |
|---|---|
| `native/cocos/2d/components/Mask.h/.cpp` | stencil 形状、类型、inverted、alphaThreshold |
| `native/cocos/2d/components/Graphics.h/.cpp` | 路径光栅化、fill/stroke |
| `cocos/2d/components/mask.jsb.ts` | Mask 薄壳、Graphics 子节点 |
| `cocos/2d/components/graphics.jsb.ts` | Graphics 薄壳 |
| `native/tests/2d-poc/run-m4-mask-probe.ps1` | Mask/Graphics 像素 |
| `native/tests/2d-poc/run-m4-extra-probe.ps1` | GRAPHICS_STENCIL/嵌套 |

## 3. 验证数据

### Mask

| case | red pixels | 期望 |
|---|---|---|
| RECT 80×80 | 6400 | 6400 |
| RECT inverted | 44800 | 256×200 - 6400 |
| ELLIPSE 80×80 | 5140 | ≈5026 |
| SPRITE_STENCIL 右半 | 3360 | 3200 左右 |
| GRAPHICS_STENCIL 40×40 | 1600 | 1600 |
| 嵌套 60×60 | 3600 | 3600 |

### Graphics

```text
80×80 fill: opaque=6400
API: moveTo/lineTo/close/rect/roundRect/circle/ellipse/arc/
     bezierCurveTo/quadraticCurveTo/fill/stroke
```

## 4. 回归

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
Jest: 20 passed
M4 Mask probe: PASS
M4 extra probe: PASS
```

## 5. 已知限制

- 兼容栅格化，不是 native 三角化；
- `roundRect` 圆角/ellipse/arc 已接入，但没有独立像素门禁；
- lineJoin/lineCap/miterLimit 未实现；
- Mask 白色 stencil 几何依赖子节点覆盖，非透明专用 material；
- 只有 Windows 验证；
- 没有 Web 逐像素对照和性能 KPI；
- 没有 Sprite/Graphics 合批统计。

## 6. 下一步

M4 Windows 关闭。后续：

1. M4.3：native 三角化/GPU buffer、路径性能；
2. M6：跨平台 Mask/Graphics 像素矩阵；
3. 合批统计与 stencil material 优化。
