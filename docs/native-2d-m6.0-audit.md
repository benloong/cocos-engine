# M6.0 API、壳与间接依赖基线

更新于 2026-11-23。当前源码快照基于 `e46bc9940b`，初版基于 `43ec752990`。完整文件指纹、字段默认值、API 声明、枚举、继承、装饰器、静态字段、生命周期入口及依赖记录在 [机器可读基线](./native-2d-m6.0-baseline.json)。本文记录剩余任务和逐项证据。

## 复现与证据边界

本机：Windows x64、Node v24.18.1、TypeScript 4.9.5。执行：

```powershell
node native/tests/2d-poc/audit-m6.cjs --write
node native/tests/2d-poc/audit-m6.cjs --check
node --test tests/scripts/native-2d-audit.test.cjs
```

--write 更新源代码快照；--check 只验证快照是否过时，不把已知缺口豁免为通过。修复 API/字段/native 实现后需同步快照及本矩阵，不能只更新快照而不处理欠项。AST 测试覆盖字段与访问器区分、type-only import 排除、语法热点提取及运行时模块选择。迁移任务的检查在本机单独执行。

审计包含 17 类、79 个 2D 源文件及 98 个 native/绑定/配置与反序列化边界文件指纹。已增加 core Component/Node/Root 的头文件与实现，覆盖注册和销毁通知边界。除逐类闭包外，entrypointImports 单列 2d/index.ts 总入口闭包，防止只检查组件而漏掉 assembler 的导入。导入图按 NATIVE override 解析相对 import/reexport；到非 2D 文件处记录边界并停止。边界的重新进入、动态导入及实际 tree-shaking/模块执行仍需构建产物审计。新增原生 2D 源文件及 DirectWrite 支持文件禁止 shared_ptr/weak_ptr 的回归检查；不把它等同于完整所有权/泄漏证明。方法未在壳直接声明不等于不存在：可能来自基类；这些名字逐项留给 API 行为验收。

原生资产声明把 Web 类型作为 TS 接口，无法用该类型证明原生方法真的绑定。六个资产的记录明确标记为 native prototype/binding review required，不能把“缺失 0”当成完整 API 验收。对象可变语义与资产依赖沿字段/类型和相关 M6.1 报告核对，必须由实际运行测试证明。

## 2026-11-23 本机记录

按 `e46bc9940b` 重新生成机器可读基线后，`audit-m6.cjs --check` 通过，`tests/scripts/native-2d-audit.test.cjs` 的 9 项检查全部通过。

`e46bc9940b` 已删除 BitmapFont 的 `EVENT_CONFIG_RELOAD` 常量和派发，以及 Jest、原生探针中的事件计数与断言。运行时无此 JSB 事件的监听方，Native Label 通过 `FontAsset::FontChanged` 接收配置变化。配置重载、缓存视图失效和释放后的迟到写入检查继续保留，验收采用现行序列化格式。

删除后，原生字体探针通过，两项位图字体配置与释放的专项 Jest 检查通过。完整字体回归为 74 项通过、8 项失败。相同的 8 项失败已在删除事件前的 `142a456799` 对照版本复现，涉及 TTF/nullable 默认值反序列化及字体加载器，相关回归仍待处理。

`142a456799` 对比迁移前 `7e83734299` 的本机 Windows Release 六对交错采样中，混合变更帧 CPU 为 4.1822 → 2.017425 ms/帧，JSB 为 876 → 197 次/帧，JS 堆峰值为 29,941,206 → 17,488,428 字节，强制 GC 为 7.162 → 4.248 ms。四项性能门槛通过，Web 完成 12 项负载。混合稳态 CPU 上升 13.9%，Sprite 稳态和变更态分别上升 21.8% 与 12.3%。采样包含 `root.jsb.ts` 中的 Native 脏队列刷新耗时，测量脚本调整尚未提交。本机报告位于 `native/tests/2d-poc/build/m6-perf-gate-142a456799-comparison.json`。M6.4 平台矩阵和 M6.5 最终候选签收继续按 [M6 Gate](./native-2d-m6-gate.md) 跟踪。

## 逐类矩阵

“字段缺口”只比较字段声明上的序列化/类型装饰器，不把 accessor 的编辑器类型装饰器自动当作序列化字段。“API 待核”是 Web 公开成员未直接出现在壳的名字数；不是自动判定丢失。完整名称和初值差异见 JSON。

| 类 | NATIVE 运行时 | 壳 AST 代码行¹ | 字段缺口 | API 待核 | 所属节点 |
|---|---|---:|---:|---:|---|
| UITransform | override | 241 | 0 | 0 | M1 / M6.4 |
| UIRenderer | 保留 Web 实现 | 414 | 0 | 0 | M6.0 / M6.5 |
| RenderRoot2D | override | 33 | 0 | 0 | M5.1 / M6.4 |
| Sprite | override | 273 | 0 | 0 | M6.1 |
| Label | override | 439 | 0 | 8 | M6.1 |
| Mask | override | 224 | 0 | 19 | M6.3 / M6.4 |
| Graphics | override | 193 | 0 | 3 | M6.3 |
| RichText | override | 193 | 0 | 0 | M6.2 |
| UIOpacity | override | 49 | 0 | 0 | M6.4 |
| LabelOutline | 保留 Web 实现 | 45 | 0 | 0 | Label API 桥接 |
| LabelShadow | 保留 Web 实现 | 55 | 0 | 0 | Label API 桥接 |
| Font | override | 10 | 绑定复核 | 绑定复核 | M6.1 |
| TTFFont | override | 44 | 绑定复核 | 绑定复核 | M6.1 |
| BitmapFont | override | 107 | 绑定复核 | 绑定复核 | M6.1 |
| LabelAtlas | override | 9 | 绑定复核 | 绑定复核 | M6.1 |
| SpriteFrame | override | 319 | 绑定复核 | 绑定复核 | M6.1 |
| SpriteAtlas | override | 162 | 绑定复核 | 绑定复核 | M6.1 |

¹ AST 打印行数用于描述源码体积。JSB 文件已取消代码行数门禁，M6.5 检查薄壳职责和运行时依赖。

当前 SpriteFrame 壳为 319 行 AST。此前 211/215 行及 native getter 的差异属于历史快照，当前数量见上表和 JSON。整体 M6 终态 Gate 保持 NO-GO。

Sprite/Label 共用的 `native-ui-materials.ts` 为 248 行 AST，已纳入文件与导入审计。它安装显式材质 API 桥接，须与叶子壳一起核对运行时职责。

## 当前残留与修复顺序

1. 初版发现 Label 缺少 14 个序列化字段声明与默认文字/对齐差异，现已修复并补 deserialize/Details/instantiate、native 样式与下划线/实际字号回归，见 [报告](./native-2d-m6.1-label-serialization.md)。完整 API、资源/场景和效果矩阵仍归 M6.1。
2. Sprite 的 _fillRange 初值、六个壳接口、native 材质与状态更新已修复，见 [报告](./native-2d-m6.1-sprite-api.md)。剩余三个数字/命名枚举初值文本差异已由真实默认值测试确认等价；radial CPU 几何与可变 fillCenter 已补 [对照与生命周期验证](./native-2d-m6.1-radial.md)，Sprite/Label 材质槽整体 API 和实际提交已有 [定向验证](./native-2d-m6.1-material-slots.md)。数组原地修改、回调、资源与完整视觉行为仍待验收。
3. Graphics 已补 _lineJoin/_lineCap/_miterLimit 并用原生几何、GPU mesh/local UBO 替换固定 CPU 栅格；Mask 已移除 lateUpdate/getFrame 轮询。几何、圆角/动态状态和 74 例 Windows Debug 普通/ASAN 与 Web GPU 对照已补，含 1000 次真实 Scene/动态纹理循环，见 M6.3/M6.4 报告。完整 API、Sprite subComp、材质动态联动、性能和平台矩阵仍待验收。
4. UIRenderer 没有独立 override，组件壳仍继承 Web 基类。基类可达 RenderData、材质和 assembler 管理。Native 脏队列由 `root.jsb.ts` 的 `frameMove` 在 TS 脏队列刷新后更新，其执行成本需结合实际调用计数和性能采样核对。
5. RichText 已接入 native parser/layout/测量与原生段管理，JSB 壳 193 行 AST、无帧方法，见 [运行时报告](./native-2d-m6.2-richtext-runtime.md)。native TS 的历史 30 项类型/导入诊断已修复，该节点的完整 native TS 和常规 tsc 通过，见 [构建边界报告](./native-2d-m6-native-ts-boundary.md)。这些证据不替代真实场景/字体/视觉门禁；LabelOutline/LabelShadow 及 Label 其余 API 继续回归。
6. UITransform 已接入原生祖先 Mask 命中与 window/layer/离屏 Camera 筛选，19 项真实场景检查通过；RenderRoot2D 已补 Node 销毁通知、注册观察 link、遍历快照、去重/排序和多 root/Canvas 基础回归，见 [报告](./native-2d-m6.4-render-root-lifecycle.md)。完整多 Camera/事件/线程/平台矩阵仍归 M6.4。JSON 的生命周期列表本身不是验收结论。

各壳保留的序列化/API 字段、循环位置、TypedArray/RenderData 分配、直接 native 调用点和可达帧方法均记录在 files 条目。直接调用点数不等于每帧调用数；可达也不等于已执行。现阶段不生成虚假的稳态 0 次或 CPU/堆改善结论。

## 测试入口与覆盖欠项

JSON 的 testEntrypoints 按类列出当前可复现的 Jest/PowerShell 入口，并检查文件确实存在。这些入口覆盖各自定向场景，不代表整个类的所有 API 都已有测试。

| 类 | 当前入口 | 缺口 |
|---|---|---|
| UITransform / UIOpacity | native-2d-m1-shell、run-m6-layout-tests | 完整相机/Mask/启停矩阵 |
| UIRenderer | 无独立 native parity 套件 | 基类 API/材质/继承热路径 |
| RenderRoot2D | native-render-root-lifecycle、compare-graphics-gpu（58 图像/11 注册/19 命中） | 真实场景切换、多 Camera 与平台矩阵 |
| Sprite | native-2d-m2-sprite-shell、run-sprite-quad-parity、run-m6-radial-parity | 继承 API、完整资源与 GPU 像素 |
| Label | native-2d-m3-label-shell、run-m6-layout-tests、run-m3-label-probe | 序列化样式/字体和全 API |
| Graphics / Mask | m4-mask-shell、m6-layout-shell、graphics-geometry-parity、mask-stencil-lifecycle、compare-graphics-gpu | 完整 API/资产/材质联动、混合与平台/性能矩阵；旧 M4 getFrame 探针已过时 |
| RichText | run-m6-richtext-parser/layout-parity、run-m6-richtext-runtime-tests | 真实场景/字体、完整事件与 GPU 对照 |
| LabelOutline / LabelShadow | 暂无独立 native 固定用例 | 依赖 Label 的启停/属性转发回归 |
| 六个资产 | native-font-assets / native-sprite-atlas / m2-sprite-frame-shell 与各 run-m6-* 脚本 | 各 M6.1 报告列明的真实加载和扩展 API |

## M0–M5 遗留复核

| 阶段记录 | 已有证据如何使用 | 继续验收 |
|---|---|---|
| [M0 report](./native-2d-m0-report.md) | PoC 身份/绑定与最小性能实验 | 不替代全类 API、平台和终态 KPI |
| [M1 gate](./native-2d-m1-gate.md) | 当时的 UITransform/UIOpacity、场景/Prefab 阶段记录 | 当前可变状态、命中、启停/槽位及跨平台矩阵归 M6.1/M6.4 |
| [M2 gate](./native-2d-m2-gate.md) | Sprite 五模式、像素与阶段性能记录 | 完整 API/资产、动态合图、终态 ≥50%/70%/30% 指标归 M6.1/M6.5 |
| [M3 gate](./native-2d-m3-gate.md) | Windows TTF/BMFont 与效果路径 | 字体资产基础已由 M6.1 补齐；真实加载释放、平台字体和复杂文本仍待验收 |
| [M4 gate](./native-2d-m4-gate.md) | Mask 四形状、嵌套和 Graphics 基础路径 | 文档明确留下三角化/GPU、join/cap/miter、Web 对照、合批/性能，全部归 M6.3 |
| [M5 gate](./native-2d-m5-gate.md) | RichText 场景闭环、GDI 已知差异及 RenderRoot2D | M6.2 已补原生基础路径；完整 RichText 场景/视觉仍待验收；多 root/Camera、交互及销毁归 M6.4；sanity 不替代精确布局/字形门禁 |

本轮只复核阶段记录的边界，没有重跑历史 Creator 工程来重新认定当前版本通过。剩余项已映射到统一 [M6 计划](./native-2d-m6-plan.md)，任何平台、运行时或性能项仍须当前候选版本的证据。
