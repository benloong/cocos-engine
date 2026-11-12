# Native 2D M5 RichText 收口报告

> 范围：`cocos/2d` RichText。  
> 结论：M5.0 RichText 垂直切片通过；M5 其余组件未完成。

## 1. 架构

```text
JS RichText
  ├─ HTML 解析、样式、换行、布局
  ├─ 文本段 → Node + native Label
  ├─ 图片段 → Node + native Sprite
  └─ imageAtlas → SpriteAtlas 薄壳 → SpriteFrame
```

不新增 native RichText 组件。

## 2. 主要文件

| 文件 | 职责 |
|---|---|
| `cocos/2d/components/rich-text.ts` | 保留 JS 解析/布局 |
| `cocos/2d/components/label.jsb.ts` | `updateRenderData` 兼容 |
| `cocos/2d/assets/sprite-atlas.jsb.ts` | imageAtlas 薄壳 |
| `native/cocos/2d/assets/SpriteAtlas.h/.cpp` | native Asset（暂时禁用） |
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

## 4. 已知限制

- native SpriteAtlas SWIG 构造会崩溃，当前 JS-only；
- 只覆盖 color/b/i + img；
- 未覆盖 br/size/outline/shadow；
- 未覆盖事件、复杂对齐；
- 未做 Web 像素对照。

## 5. M5 剩余

- UIMeshRenderer；
- UIMesh；
- Canvas/RenderRoot2D 桥；
- UISkew。

## 6. 下一步

1. 修 native SpriteAtlas binding；
2. 补 RichText 标签/事件；
3. 再进 UIMeshRenderer/UIMesh/Canvas/UISkew。
