# M6.0 API、壳与间接依赖基线

更新：2026-11-16。初版基于代码节点 43ec752990，已随 Label 序列化和 Sprite API/材质修复同步当前快照；完整文件指纹、字段默认值、API 声明、枚举、继承、装饰器、静态字段、生命周期入口及依赖记录在 [机器可读基线](./native-2d-m6.0-baseline.json)。本文建立剩余任务基线，不宣告任何类达到最终 parity。

## 复现与证据边界

本机：Windows x64、Node v24.18.1、TypeScript 4.9.5。执行：

```powershell
node native/tests/2d-poc/audit-m6.cjs --write
node native/tests/2d-poc/audit-m6.cjs --check
node --test tests/scripts/native-2d-audit.test.cjs
```

--write 更新源代码快照；--check 只验证快照是否过时，不把已知缺口豁免为通过。修复 API/字段/native 实现后需同步快照及本矩阵，不能只更新快照而不处理欠项。AST 测试覆盖字段与访问器区分、type-only import 排除、语法热点提取及运行时模块选择。native-ts-build CI 执行检查。

审计包含 17 类、61 个可达 2D 源文件及 52 个 native/绑定/配置文件指纹。导入图按 NATIVE override 解析相对 import/reexport；到非 2D 文件处记录边界并停止。边界的重新进入、动态导入及实际 tree-shaking/模块执行仍需构建产物审计。方法未在壳直接声明不等于不存在：可能来自基类；这些名字逐项留给 API 行为验收。

原生资产声明把 Web 类型作为 TS 接口，无法用该类型证明原生方法真的绑定。六个资产的记录明确标记为 native prototype/binding review required，不能把“缺失 0”当成完整 API 验收。对象可变语义与资产依赖沿字段/类型和相关 M6.1 报告核对，必须由实际运行测试证明。

## 逐类矩阵

“字段缺口”只比较字段声明上的序列化/类型装饰器，不把 accessor 的编辑器类型装饰器自动当作序列化字段。“API 待核”是 Web 公开成员未直接出现在壳的名字数；不是自动判定丢失。完整名称和初值差异见 JSON。

| 类 | NATIVE 运行时 | 壳 AST 代码行¹ | 字段缺口 | API 待核 | 所属节点 |
|---|---|---:|---:|---:|---|
| UITransform | override | 216 | 0 | 2 | M1 / M6.4 |
| UIRenderer | 保留 Web 实现 | 414 | 0 | 0 | M6.0 / M6.5 |
| RenderRoot2D | override | 31 | 0 | 0 | M5.1 / M6.4 |
| Sprite | override | 261 | 0 | 0 | M6.1 |
| Label | override | 346 | 0 | 14 | M6.1 |
| Mask | override | 137 | 0 | 22 | M6.3 / M6.4 |
| Graphics | override | 105 | 3 | 13 | M6.3 |
| RichText | 保留 Web 实现 | 1035 | 0 | 0 | M6.2 |
| UIOpacity | override | 48 | 0 | 0 | M6.4 |
| LabelOutline | 保留 Web 实现 | 45 | 0 | 0 | Label API 桥接 |
| LabelShadow | 保留 Web 实现 | 55 | 0 | 0 | Label API 桥接 |
| Font | override | 10 | 绑定复核 | 绑定复核 | M6.1 |
| TTFFont | override | 26 | 绑定复核 | 绑定复核 | M6.1 |
| BitmapFont | override | 102 | 绑定复核 | 绑定复核 | M6.1 |
| LabelAtlas | override | 9 | 绑定复核 | 绑定复核 | M6.1 |
| SpriteFrame | override | 210 | 绑定复核 | 绑定复核 | M6.1 |
| SpriteAtlas | override | 148 | 绑定复核 | 绑定复核 | M6.1 |

¹ AST 打印行数排除注释但没有实现最终“纯类型/deprecated 转发”扣除，仅作体积线索。M6.5 须独立执行正式行数/算法门禁，不能靠压缩排版解决超限。

Sprite/Label 共用的 `native-ui-materials.ts` 为 134 行 AST，已纳入文件/导入审计；它安装显式材质 API 桥接，须与叶子壳一起复核，不能只用叶子行数认定最终薄壳门禁通过。

## 当前残留与修复顺序

1. 初版发现 Label 缺少 14 个序列化字段声明与默认文字/对齐差异，现已修复并补 deserialize/Details/instantiate、native 样式与下划线/实际字号回归，见 [报告](./native-2d-m6.1-label-serialization.md)。完整 API、资源/场景和效果矩阵仍归 M6.1。
2. Sprite 的 _fillRange 初值、六个壳接口、native 材质与状态更新已修复，见 [报告](./native-2d-m6.1-sprite-api.md)。剩余三个数字/命名枚举初值文本差异已由真实默认值测试确认等价；radial CPU 几何与可变 fillCenter 已补 [对照与生命周期验证](./native-2d-m6.1-radial.md)，Sprite/Label 材质槽整体 API 和实际提交已有 [定向验证](./native-2d-m6.1-material-slots.md)。数组原地修改、回调、资源与完整视觉行为仍待验收。
3. Graphics 缺少 _lineJoin、_lineCap、_miterLimit；固定 CPU 栅格路径和描边语义仍按 M6.3 替换。Mask 的 lateUpdate 在 JS 获取 Graphics frame；材质选择仍由壳进行，归 M6.3/M6.5。
4. UIRenderer 没有独立 override，组件壳仍继承 Web 基类。基类可达 RenderData、材质和 assembler 管理；Batcher 的 JSB 分支是否消除了执行成本必须通过实际调用计数确认，不能只看叶子壳。
5. RichText 没有独立 override，HTML/布局仍走 JS，归 M6.2。LabelOutline/LabelShadow 为已弃用的 Label 公共属性转发，不另行下沉算法；它们依赖的 Label API 仍须回归。
6. UITransform 的 onEnable/onDisable 与命中/Mask 相关语义、RenderRoot2D 与 UIOpacity 的启停/销毁归 M6.4。JSON 的生命周期列表是源码入口，不是 attach/detach 验收结论。

各壳保留的序列化/API 字段、循环位置、TypedArray/RenderData 分配、直接 native 调用点和可达帧方法均记录在 files 条目。直接调用点数不等于每帧调用数；可达也不等于已执行。现阶段不生成虚假的稳态 0 次或 CPU/堆改善结论。

## 测试入口与覆盖欠项

JSON 的 testEntrypoints 按类列出当前可复现的 Jest/PowerShell 入口，并检查文件确实存在。这些入口覆盖各自定向场景，不代表整个类的所有 API 都已有测试。

| 类 | 当前入口 | 缺口 |
|---|---|---|
| UITransform / UIOpacity | native-2d-m1-shell、run-m6-layout-tests | 完整相机/Mask/启停矩阵 |
| UIRenderer | 无独立 native parity 套件 | 基类 API/材质/继承热路径 |
| RenderRoot2D | 历史 M5.1 报告，当前无独立固定入口 | 固定多 root/Camera 回归 |
| Sprite | native-2d-m2-sprite-shell、run-sprite-quad-parity、run-m6-radial-parity | 继承 API、完整资源与 GPU 像素 |
| Label | native-2d-m3-label-shell、run-m6-layout-tests、run-m3-label-probe | 序列化样式/字体和全 API |
| Graphics / Mask | m4-mask-shell、m6-layout-shell、run-m4-mask/extra-probe | 几何/GPU、描边、动态联动 |
| RichText | run-m5-richtext-probe | 原生解析/布局及精确对照 |
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
| [M5 gate](./native-2d-m5-gate.md) | RichText 场景闭环、GDI 已知差异及 RenderRoot2D | JS 解析/布局归 M6.2；多 root/Camera、交互及销毁归 M6.4；sanity 不替代精确布局/字形门禁 |

本轮只复核阶段记录的边界，没有重跑历史 Creator 工程来重新认定当前版本通过。剩余项已映射到统一 [M6 计划](./native-2d-m6-plan.md)，任何平台、运行时或性能项仍须当前候选版本的证据。
