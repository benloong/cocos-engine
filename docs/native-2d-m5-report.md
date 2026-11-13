# Native 2D M5 RichText 收口报告

> 范围：`cocos/2d` RichText。  
> 更新：2026-11-13。M5.0 RichText 与 M5.1 RenderRoot2D 的 Windows 场景功能已有收口记录；RichText 解析/布局仍在 JS，未达到终态薄壳，后续见 [M6.2](./native-2d-m6-plan.md)。本次未重跑原生验证。

## 1. 架构

```text
JS RichText
  ├─ HTML 解析、样式、换行、布局
  ├─ 文本段 → Node + native Label
  ├─ 图片段 → Node + native Sprite
  └─ imageAtlas → SpriteAtlas 薄壳 → SpriteFrame
```

M5 阶段没有新增 native RichText 组件；终态需要 native 接管解析/布局与段管理，JS 仅保留薄壳和事件桥接。

## 2. 主要文件

| 文件 | 职责 |
|---|---|
| `cocos/2d/components/rich-text.ts` | 保留 JS 解析/布局 |
| `cocos/2d/components/label.jsb.ts` | `updateRenderData` 兼容 |
| `cocos/2d/assets/sprite-atlas.jsb.ts` | imageAtlas 薄壳 |
| `native/cocos/2d/assets/SpriteAtlas.h/.cpp` | native Asset（已启用；JSB 直接修改 prototype） |
| `native/tests/2d-poc/run-m5-richtext-probe.ps1` | 文本段探针 |

## 3. 验证

文本：

```text
segments=7, labels=7, sprites=0
width=300, height=104.32, colored=4095
```

图片：

```text
M5_ATLAS {"found":true}
children=9, labels=8, sprites=1, colored=4633
```

回归：

```text
M2 / M3 / M0 / Jest 20 全部通过
```

## 4. 当前覆盖与遗留

- SpriteAtlas 已启用；旧字段冲突通过隔离包装字段解决，当前又改为直接导出 jsb.SpriteAtlas、修改 prototype，不再持有 _nativeAtlas。
- color/b/i/u、size/br/outline、img/imageAtlas、contentSize 和 hit/miss 已有 Windows 功能记录，见 [M5 Gate](./native-2d-m5-gate.md)。
- 已做 Web/native 场景级对照；italic 宽度为已知差异，colored 只作 ±20% sanity，不作逐像素 golden。
- shadow、复杂嵌套/对齐、实际点击回调分发等完整矩阵仍需补证据；hit/miss 不等于完整事件链已验收。
- HTML 解析、样式、换行、布局与段对象编排仍在 JS，是 M6.2 的终态阻断项。
- prototype 资产的依赖解析后 native 表同步、生命周期与原生回归归入 M6.1；既有 M5 数据不替代本次改造验证。

## 5. 明确不下沉

- UIMeshRenderer/UIMesh/UISkew：不下沉，保持 JS；
- Canvas/Camera/Widget/View：不下沉，保持 JS。

## 6. 下一步

RenderRoot2D 已完成 Windows 节点注册/启停转发，Canvas/Camera/Widget/View 保持 JS，不再作为迁移决策项。后续按 [M6 计划](./native-2d-m6-plan.md) 完成 RichText 终态、资产一致性、多 root/Camera 与硬化验收。
