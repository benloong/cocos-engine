# M6 Native Label 实体颜色兼容入口修复

2026-11-24，基于 `afcb2917d5`。Native Label 继承的旧 `setEntityColor()` 写入 JS 侧 RenderEntity，未更新实际提交的原生 Label 实体。新增 Native 转发后，该显式调用生效，且保留原接口的字体分支与组件状态。

## 行为

JSB Label 将传入颜色转发给 `setEntityColorRGBA()`，不修改组件 `color`，不调用普通组件颜色 setter。Native 根据所分配的字体资产选择实体颜色：BitmapFont、LabelAtlas 使用 RGBA；系统字体和 TTFFont 使用白色 RGB 与传入 Alpha，因为文字纹理已包含正文 RGB。后续文字重建继续使用原组件颜色。

该方法在组件加载前或销毁后安全返回。不恢复 Web 文本数据或 JS 布局算法，也不重新导出 Label 的实体读回接口。

## 验证

新增 Jest 回归在旧实现上失败，原生转发调用为零。修复后，新增回归和相邻 Native 字体启用、默认序列化及实例化用例共四项通过；同文件其余八项未运行。Native TypeScript 编译通过。

Windows Debug、Release 分别重新生成绑定、编译并运行完整 Native 测试及实际 Sprite/Label JSB 薄壳探针。两种配置均输出：

```text
label legacy entity color: PASS (4 font paths, 3 alpha values)
jsb shell integration: OK
jsb scene record: OK
native 2D PoC: PASS
```

原生回归直接检查实际提交实体，覆盖系统字体、TTFFont、BitmapFont、LabelAtlas，以及 Alpha 为 0、78、255。每次调用后刷新原生脏队列并核对实体 RGBA；随后改变文字，核对重建仍采用原组件颜色。真实 JSB 探针额外执行新增方法并核对组件颜色未改变，确认生成绑定可以调用。

两种配置的完整图形应用目标也重新编译通过；本轮未运行最终候选的完整应用/GPU 捕获矩阵。薄壳检查为 `43 checks, 0 failures`，审计基线校验通过。基线只更新 Label 声明和对应源码哈希，Label 的声明差异从 8 项减少到 7 项，不能据此宣布其余 API parity 已完成。

[结构化证据、源码、生成绑定、二进制及日志哈希](./native-2d-m6-label-entity-color.json)。原始构建、修复前后 Jest、Native TS 和运行日志位于 `native/tests/2d-poc/build/m6-label-entity-color/`。新增原生回归已纳入默认 Native PoC，JSB 调用纳入现有 `build-sprite-api-probe.cjs`。

## 剩余范围

本节点关闭 Label 实体颜色兼容转发缺口。剩余 Label、Mask、Graphics 声明差异仍需逐项审定，资产场景组合与同一最终候选完整签收继续待办。未修改 Web、SpriteRenderer 或 ModelRenderer；本轮没有新增 GPU 像素或完整应用签收结论。
