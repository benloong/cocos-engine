# Native 2D M6 剩余任务与终态验收

> 2026-11-25 候选 `f9df28d4c8` 完成 Windows Native/JSB 范围的 M6 签收。15 类、192 个现行公开成员完成行为映射，复杂字体、异步资产及 RichText 包装对象跨场景门槛在 Debug、Release 均通过。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)

> 此前在已提交候选 `05197fa63c` 上重跑 Windows M6 门禁。两种配置的功能、图形、生命周期、连续启动、JSB 追踪及 Release 的四项性能门槛均通过。完整公开接口行为、字体与资产边界以及 RichText 包装对象仍按本清单验收。[本次结果和原始证据](./native-2d-m6-gate.md#2026-11-25-提交后重跑-windows-m6-门禁)

> 2026-11-25 Windows Debug、Release 已关闭 M0 位图宽度、默认 Mask 命中和 Graphics.impl 三项，动态 priority 和 M1 窗口命中复验通过。清理四条迁移期间新增的 Web 用例并恢复原字体用例后，跨端 M0 总门禁和 SpriteFrame 套件均通过。[本轮复验](./native-2d-m6-gate.md#2026-11-25-m0-总门禁与-spriteframe-套件复验) · [双配置签收](./native-2d-m6-gate.md#2026-11-25-m0-位图宽度与-m4-公开接口签收)

> 范围沿用[总计划](./native-2d-module-sinking-plan.zh-CN.md)，仅 `cocos/2d` 及必要的 native/绑定/构建支持。后续复验限本地 Windows Debug/Release，不启动网络服务或下载依赖。ASan 数据保留为历史证据。
> 本文是 M6 剩余任务与终态门禁的统一清单；历史数据保留在各阶段 report/gate 中。
> 所有权约束：M6 原生 2D 代码禁止 shared_ptr/weak_ptr。值成员、unique_ptr、IntrusivePtr 与非 owning 指针分别标明拥有者；借用者必须在拥有者销毁前解绑或收到同步失效通知。
> 构建验收约束：后续改动统一按 [Cocos CLI 构建与验收流程](./native-2d-build-and-acceptance.zh-CN.md) 第 8 节执行本轮范围内的 Windows 工程构建、override 重建、资源同步和应用门禁。该流程中的 Web 步骤保留为历史参考。定向 PoC/GPU/ASAN 仅作补充证据；不得替代文档规定的测试工程验收。

> 本轮验收平台为 Windows Debug/Release，验收对象为 JSB 薄层和 Native 实现。macOS、iOS、Android、OHOS 暂缓验收，保留待验证状态。迁移测试通过本机入口单独运行，验收采用本机记录。迁移前的 GitHub Actions 工作流继续沿用。
> 场景、Prefab 和资产按现行序列化格式验收。旧版本序列化数据的加载、迁移和兼容不列入本轮签收，详见 [M6 Gate](./native-2d-m6-gate.md)。

- [x] 同一候选复验现行格式夹具。核心图形矩阵在 Windows Debug、Release、ASan 各完成 146 张捕获，覆盖 Label 字体与材质更新、未加载组件销毁、Sprite 独立图片与图集生命周期、Mask 模板切换和 Graphics 材质恢复。[Label 与 Sprite](./native-2d-m6-label-renderer-compat.md) [Mask](./native-2d-m6-mask-compat.md) [Graphics](./native-2d-m6-graphics-compat.md)
> 2026-11-23 按用户决定，现有 Web 实现退出 M6 验收。Web TypeScript、全量 Jest、构建、动态图集、字体及 GPU 应用结果保留为观察记录，Windows 对当前 Web 的行为和像素一致性退出强制门槛。JSB／Native 的功能、资源、现行格式序列化和生命周期继续独立验收。混合套件按断言执行路径核对 Native 覆盖，原始全量失败数保留。详见 [M6 Gate](./native-2d-m6-gate.md)。

> 2026-11-23 按用户决定，SpriteRenderer 及 ModelRenderer 的实现、JSB 薄壳和相关验收移出本期 M6。排除生成网格的渲染、方向与深度裁剪、模型／IA 重绑、纹理描述符更新，以及该渲染路径的网格和缓冲释放检查。Sprite、Label、Graphics、Mask、RichText 和它们使用的 SpriteFrame 数据、UV、纹理与资源生命周期继续按各自范围验收。

> 历史候选 `554d747561` 当时判为 **NO-GO**。双配置 M2–M5、千轮图集、RichText 字体应用、20 次连续启动及薄壳／间接路径通过，Debug 字体文件独占检查重新失败。[历史报告](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md)

## 1. 已有基础与验收边界

2026-11-23 丢弃 SpriteFrame 草稿，从 `529cb53636` 独立干净工作树重新构建并完成本机复验。18 个 Native Jest 套件共 120 项、Windows 双配置原生各三轮及各六组 JSB、M2–M5、各千轮静态图集、10 轮双配置调度、9 组 Native 裁剪、部署审计及调用追踪通过。RichText 双配置各 62 张捕获、千轮字体生命周期与句柄检查通过，ASan RichText 通过。原混合图形矩阵包含本轮移出的生成网格渲染用例，其失败保留在历史记录。筛选后的 Graphics、Mask、Sprite、Label 与资源矩阵已通过本轮复验；UIOpacity 启停失败已修复并通过 Windows 双配置定向及核心图形复验，剩余签收项继续保留。Native 六对采样中，混合变更帧的 CPU、JSB、JS 堆峰值、强制 GC 分别下降 61.3%、77.5%、41.8%、28.4%，四项门槛通过。首轮句柄、字体别名和 Debug 提前退出异常在最终复测中未复现，原因仍待查。原 5cdc896f3c 及包含 SpriteFrame／SpriteRenderer 草稿的应用结果继续作为历史记录。M6.4、M6.5 最终签收保持待办，见 [M6 Gate](./native-2d-m6-gate.md#当前候选-529cb53636-的完整本机复验)。

- [x] 本轮独立源码、实际部署包、Native 基础与文档工程验收已归档。
- [x] 按本轮范围筛选并复验图形应用矩阵。排除 29 项生成网格渲染捕获，Windows Debug/Release/ASan 各通过 146 张核心捕获、22 项命中、11 项根节点、1000 轮场景及 4998 项场景断言。三配置图像逐张字节一致。[本轮报告](../native/tests/2d-poc/build/m6-core-accept-2026-11-23T14-54-24-737Z/summary.md)
- [x] 修复 UIOpacity 禁用期间写入 opacity 仍影响节点的问题。Windows Debug/Release 原生回归、JSB 探针及真实组件入口均通过；禁用期间保持节点透明度 1，重新启用应用保存的新值。两配置各 146 张核心图像与原基准逐字节一致。[修复复验](../native/tests/2d-poc/build/m6-uiopacity-fix-20261123T152115Z/summary.md)
- [x] 用户确认关闭历史 Debug 提前退出和字体共享两项签收阻断。历史日志中的具体退出原因和占用进程仍未确定。[签收决定](./native-2d-m6-gate.md#windows-最终签收--2026-11-24) [诊断记录](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md)
- [x] 已记录 `8ee11b673e` 的 Windows 默认 Native 签收。[签收记录](./native-2d-m6-gate.md#windows-最终签收--2026-11-24)

| 阶段 | 已有记录 | 留给 M6 的边界 |
|---|---|---|
| M0/M1 | PoC、UITransform/UIOpacity、Node 槽位、生命周期和场景/prefab 验证 | 扩展稳定性、线程与平台覆盖，复核稳态调用数 |
| M2 | Sprite 五模式、材质实例、Web/native golden、阶段性能 KPI | 全量 API/资产行为、终态薄壳、跨平台和混合负载 |
| M3 | Windows Label TTF/BMFont、缓存、布局、Outline/Shadow | 平台字体矩阵、复杂文本、真实字体资产加载释放与平台句柄生命周期 |
| M4 | Windows Mask 与 Graphics 基础功能 | Graphics 三角化/GPU buffer、完整描边语义、Web 对照、性能 |
| M5 | Windows RichText 场景对照、RenderRoot2D | M6.2 已接入原生 RichText 基础路径；完整场景/字体/视觉及多 root/Camera 继续验收 |

资产绑定已调整为：`SpriteFrame = jsb.SpriteFrame`、`SpriteAtlas = jsb.SpriteAtlas`，直接修改原生 prototype；`_ctor` 调用 Asset 初始化。SpriteAtlas 已移除 `ensureNative/_nativeAtlas` 包装，原生方法在覆盖前保存。2026-11-16 已补 SpriteFrame 数据/算法下沉、Windows native 定向测试与 UV 对照，见 [SpriteFrame 报告](./native-2d-m6.1-sprite-frame.md)；真实资产/场景加载与完整生命周期矩阵仍待验收。TTFFont/BitmapFont/LabelAtlas 基础数据与生命周期已完成本轮 Windows 定向验证，见 [字体资产报告](./native-2d-m6.1-font-assets.md)，平台句柄及真实场景验收仍单列待办。

## 2. 剩余任务

任务按 M6.0 → M6.1/M6.2/M6.3 → M6.4 → M6.5 推进。测试夹具与指标采集可随实现补齐；最终证据必须来自同一候选版本。所有未勾选项均待完成或待提供证据。

### M6.0 范围、API 与证据基线

- [x] 已建立 17 类的声明/默认值/API/枚举/静态字段/生命周期与运行时依赖矩阵，含原生绑定需复核项和逐类欠项，见 [审计报告与原始基线](./native-2d-m6.0-audit.md)。矩阵建立不等于行为 parity 通过。
- [x] 已逐项复核 M0–M5 阶段记录的边界并映射到 M6.1–M6.5，见 [遗留复核](./native-2d-m6.0-audit.md#m0m5-遗留复核)。历史通过不重新认定为当前候选版本通过。
- [x] 源码/override/2D 范围内静态导入审计：已记录字段镜像、帧方法、buffer/RenderData 分配、native 调用点及 AST 体积，见 [报告](./native-2d-m6.0-audit.md)。
- [x] Windows Debug 部署产物依赖审计。运行 `node native/tests/2d-poc/audit-windows-bundle.cjs`，用相同配置生成 Rollup 模块图，与实际部署的引擎 chunk 校验 SHA256。在 `7abbf5c6f882f280164b0e4f874026f9975ea0adefec6f86719d189ad5858c51` 的 cc.js 中，2D 依赖图包含 81 个模块，57 个产生代码，非 2D 到 2D 的静态边为 72 条。Rollup 没有解析出动态 chunk，部署 JS 中另有三个运行时加载入口，分别为 settingsModule、bundle prerequisites 和 script packages，目标由运行配置决定。报告 `native/tests/2d-poc/build/windows-bundle-audit/report.json` 保留模块、边、动态表达式与行号。发现 exports/graphics.ts 直接重入 Web Graphics assembler 和 Earcut，列入下沉修复。
- [x] 修复 graphics 功能导出的 Web 三角化重入。Windows 原生 assembler manager 将显式 fill/stroke 转发给组件，保留 getAssembler、静态注册和 renderData 更新入口。部署包重新审计后有 76 个 2D 图模块、53 个产生代码，Web Graphics assembler 和 Earcut 的产物字节归零。cc.js SHA256 为 `4dedfd6dc092664879ecb219a4f72cc2bfb5620bcb1b8cf5e2b92bf702d69d60`。native TS、2 项 manager 测试、真实 JSB manager 绘制 80×80 矩形、完整串行门禁及 32 项定向 Jest 通过。
- [x] Windows V8 逐组件 JSB 基线已采集。空 Canvas 与 13 组组件/资产消费者各预热 12 帧、记录 60 个原生 frameMove，并以显式 getter 控制计数完整性。迁移类稳态直接调用为零，排除 GC 析构后各方法计数与 Canvas 相同。见[采集方法](./native-2d-m6.0-windows-jsb-trace.md)与[逐方法计数](./native-2d-m6.0-windows-jsb-trace.json)。
- [x] 已观察到的壳残留：移除 Label lateUpdate 高度轮询；原生统一管理布局尺寸并由 UITransform 在变化时推送缓存/事件；Label/Graphics 内置材质由原生解析。Windows Debug/Release 实际 JSB、1000 次静止 prepare 与定向测试通过，见 [报告](./native-2d-m6.0-layout-material.md)。全模块稳态调用门禁继续归 M6.5。
- [x] 新增 2D 元数据维护入口：仓库内脚本从六个 Web 资产声明生成补丁，由 native-binding/decorators 重导出；补齐本机产物检查及生成器、元数据测试。组件壳使用源码装饰器；历史外部生成器归属未推断，见 [维护说明](./native-2d-m6.0-metadata.md)。

交付：组件矩阵、残留清单、基线版本/环境/命令和原始数据。

### M6.1 资产与状态一致性

- [x] Label 现行序列化字段：恢复 Web 的字体/系统字体字段、样式/效果/24 个默认值，以 `cc.Label` 验证 deserialize/Details 字体回填与 instantiate；初始化样式传给 native，普通 TTF 下划线厚度与实际字号通过 Windows Debug/Release 联调，见 [报告](./native-2d-m6.1-label-serialization.md)。
- [x] Sprite 壳声明与基础材质/状态兼容：六个缺口、fillRange 默认值/条形负范围、atlas/trim/grayscale/事件、native 材质变体与真正 MaterialInstance、帧/材质持有、尺寸/Node 变化和零填充清理已补，Windows Debug/Release 实际 JSB 与定向测试通过，见 [报告](./native-2d-m6.1-sprite-api.md)。
- [x] Sprite radial 与可变 fillCenter：归一化中心、角度方向、矩形边界三角形、rotated UV 和 flip 行为已修复；fillCenter 分量读写直接桥接 native，加载/克隆/销毁保持视图契约。3024 组实际 Web assembler 与 native CPU 几何对照、Windows Debug/Release 定向测试通过，见 [报告](./native-2d-m6.1-radial.md)。
- [x] Sprite 径向填充的实际 GPU 像素验收。修复 Web 直接写 `fillCenter.x/y` 后未刷新渲染数据。Windows Debug、Release 与 Web 对照正负范围、分量更新、旋转帧与 UV 翻转、空到全填充，以及图集 Prefab 的普通和旋转帧。两种 Windows 配置各 102 张图与 Web 逐字节一致。[逐图数据](./native-2d-m6-sprite-radial-gpu.json)
- [x] Sprite 九宫格在节点小于边距总和时按轴比例压缩边框，并保留原始纹理 UV。Web 运行中修改边距同时刷新顶点分区。Windows Debug、Release 与 Web 验证现有节点缩小、直接创建同尺寸节点、修改边距及旋转帧。两个 Windows 配置各 108 张图与 Web 逐字节一致，原有 102 张图的哈希保持一致。[九宫格对照](./native-2d-m6-sprite-sliced-gpu.json)
- [x] Sprite 平铺保留图集帧边框，重复并裁切中心区。小尺寸按比例压缩边框，零宽中心使用边界 UV，超出 16 位索引容量时清空几何。Web 运行时修改帧边距可刷新平铺，启停、换帧和切换类型均检查 UV 事件订阅。Windows Debug、Release 各 116 张回读与 Web 逐字节一致，原有 108 张哈希亦一致。[平铺几何和像素对照](./native-2d-m6-sprite-tiled-gpu.json)
- [x] Sprite/Label 材质槽 API 与提交：补数组整体赋值/缩短/清空、加载前引用、forceUpdate、实例 owner 解绑；native 区分显式空槽和恢复内置材质，Label 实际 DrawInfo 跟随槽和实例变化。Windows Debug/Release、实际 JSB 与 Web 定向对照通过，见 [报告](./native-2d-m6.1-material-slots.md)。
- [x] Label 的兼容 getter `_bmFontOriginalSize` 读取当前 BitmapFont 资产的字号，并覆盖未设置字体、字号修改和切换非位图字体的 Web/JSB 薄壳对照。见 [Label 回归](../tests/ui/native-2d-m3-label-shell.test.ts)。
- [x] 位图 Label 的字号与行高支持小于 0.01 的变化。以字号或行高 16 为基准，在 Windows Debug/Release 和 Web 上增减 1/128 并复位，128 字形的自然宽度及 128 行的自然高度均依次为 2049、2048、2047、2048。原生双配置还验证直接调用 setter 后的测量，既有 88 张图像与 Web 及上一节点逐字节相同。[场景与断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)
- [x] Label 容器宽度在自然字宽上下各 1/2048 像素时，Windows Debug、Release 与 Web 的 SHRINK 字号依次为 32、31、32，RESIZE_HEIGHT 在两行与一行之间切换。行高增加 1/2048 时也会回写新的容器高度。原生回归仅经 dirty manager 调度，三端场景经公开 API 进行非强制更新。两个 Windows 配置各 88 张截图与 Web 和改动前逐字节一致。[场景断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)
- [x] 系统字体 Label 的 outlineWidth 和 shadowBlur 按实际浮点变化标脏。Windows Debug、Release 和 Web 在 2 的两侧增减 1/128 并复位，普通布局的描边宽度增量为参数增量的两倍；同一行在 SHRINK 临界宽度下的实际字号依次为 32、31、32、32、32。两个 Windows 配置各 88 张截图与 Web 及改动前逐字节一致。[场景断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)
- [x] 位图 Label 保留小于 0.01 的 spacingX 变化。Windows 原生双字形测量过去返回 10，修复后按 Web 两位小数的布局规则返回 10.01。Windows Debug/Release 和 Web 在 129 个 16 像素字形上依次设置 0、1/128、0、−1/128、0，实测宽度依次为 2064、2065、2064、2063、2064。两个 Windows 配置各 88 张截图与 Web 及上一节点逐字节相同。[场景与断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)
- [x] Label.actualFontSize 保留 JS 手动写入的小数精度。Windows Debug/Release 实际 JSB 验证在干净帧保留 14.123456789，重新排版后恢复为 16。Windows 两种配置和 Web 的真实场景均精确读到位图字体在高度 0.25 下的 SHRINK 最小字号 0.1；每个 Windows 配置的 85 张图与 Web 逐字节一致。[场景及像素结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label.updateRenderData(force) 保留布局约束。相同两行文本在 Windows Debug、Release 和 Web 下分别验证普通与强制刷新。CLAMP/SHRINK 保持 72×80，RESIZE_HEIGHT 保持宽度 72 并换行至高度 65.2，NONE 同步返回自然尺寸。NONE 的自然宽度 Windows 为 79、Web 为 80.9453125，字体度量差异仍在复杂布局中跟踪。[逐配置布局与像素回归](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Windows 已安装字体从 DirectWrite 系统集合解析，Canvas 恢复时还原保存的字体。16 px Arial 两行文本的自然宽度由 79 修正为与 Chrome 相同的 80.9453125，各溢出模式和 SHRINK 字号通过双配置对照。两种 Windows 配置各 88 张图与 Web 逐字节相同，RichText 42 张图均与上轮相同。Release 短文本交错测量中，每次测量、切换缓冲尺寸及绘制的中位数从 43.888 降到 16.338 µs。[双配置布局与 16 轮数据](./native-2d-m6-system-font.json)
- [x] 普通栅格 Label 在 SHRINK 模式下保留配置字号，分别按换行后的高度或未换行文本的宽高求实际字号。Windows Debug、Release 和 Web 在 32 号 Arial 的缩小、放大、再次缩小中得到相同读数：关闭换行 8/32/8，开启换行 8/33/8，单行宽度从 26 增至 200 时为 7/32。33 来自 Web 换行搜索的上界。见 [字号矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的材质数组原地编辑通过 Windows Debug、Release 和 Web 真实场景验证。保留数组引用后覆盖、截短、push、splice、delete，以及写空实例槽，均核对共享槽和实际使用材质。JSB 探针另查原生槽引用，定向测试覆盖加载前修改、销毁后写入。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的实际 shader 重编译回调。场景为每个组件的第 1 号实例槽切换 `USE_TEXTURE`，检查材质 hash 变化和恢复、两次有效切换的 owner 回调参数，以及相同宏重复设置时的通知次数。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的材质生命周期。传回同一共享材质保留实例；强制刷新和替换共享材质立即清空旧实例的 passes。组件持有共享材质期间显式销毁，核对两次 destroy 的返回值、帧内严格与普通有效性、帧末失效及槽位引用身份。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label._canvasPool 显式兼容入口。Web 和 native 使用同一画布池实现，借出两个独立画布、测量文字、归还后获取相同上下文及字体状态在 Web、Windows Debug/Release 均通过，三端 85 张图像逐字节一致。Windows 部署 cc.js 哈希为 `45073de1a593f50274e1a5dd88e8103681b97a42b0afba6821106fcc8864594e`，画布池模块贡献 990 字节，Web Label assembler 未进入部署包。完整串行验收与 23 项定向 Jest 通过。[GPU 快照与配置](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label 启用时恢复字体。无字体资产且关闭系统字体时，按 Web 行为恢复系统字体；系统字体族为空时恢复 Arial。已配置的字体族和有效字体资产保留。修复前定向用例复现 useSystemFont 仍为 false，修复后 6 项 Label 契约测试通过。Web 与 Windows Debug/Release 实际场景验证重新启用及保留 Verdana，85 张图像逐字节一致，标准工程串行门禁通过。[当前快照与像素结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Sprite 和 Label 的 JSB 壳继承 UIRenderer.color。编辑器改色在同步原生颜色后派发一次 COLOR_CHANGED，监听器收到独立副本；运行时改色和重复赋相同值的事件数均为 0。Web 类和 JSB 壳的编辑器/运行时契约由[定向测试](../tests/ui/native-2d-m3-label-shell.test.ts)覆盖，三端运行时赋值由[实际场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)覆盖。
- [x] 现行公开接口按声明方逐项映射到行为用例。Windows 双配置各 192 项，包含静态成员，排除兼容和废弃接口。[逐成员行为映射](./acceptance/native-2d-20261125/m6-public-behavior.json)
  - [x] 2026-11-25 Windows Debug、Release 各核对 15 类的 192 个公开成员。三种组件的动态 priority、默认 Mask 命中和 Graphics.impl 路径绘制均通过实际场景复验。[逐项结果与适用范围](./native-2d-m6-gate.md#2026-11-25-m0-位图宽度与-m4-公开接口签收)
  - 2026-11-25 同一候选的 Windows Debug、Release 均复现三项失败：Sprite、Label、Graphics 加载后修改 `priority` 未更新原生组件，空节点上添加默认 Mask 后 `isHit` 未命中中心点，Graphics 实例缺少公开字段 `impl`。[复现条件与对照](./native-2d-m6-gate.md#2026-11-25-现行公开接口复验) · [双配置结果](./native-2d-m6-public-parity-8ee11b673e.json)
  - [x] 已绑定 BitmapFont 的 Label 改为 18.25 px、重复写入该字号、再更换字体族。旧 Windows Debug 调用六次字体 setter；现版 Debug/Release 均只调用一次 `setFontSize` 和一次 `setFont`，仍持有同一 BitmapFont。切回系统字体后以 23.75 px 实际绘制并回读到非空字形。Web 同序列保留位图字体身份、原始字号和目标字号。[Windows 探针](../native/tests/2d-poc/build-sprite-api-probe.cjs)、[Web 对照](../tests/ui/native-2d-m3-label-shell.test.ts)
  - [x] Windows DirectWrite Label 接收 TTF 小数字号。修复前 24、24.25 和 24.75 px 的自然宽度均为 95.9765625。修复后 24.25 和 24.75 px 的 Windows Debug/Release 宽度分别为 96.9763107 和 98.9758301，与 Web 的最大差小于 0.000054 px。三端在同一场景验证重绘、恢复 24 px 及 47 张既有图的逐图哈希。[复测记录](./native-2d-m6-richtext-configurations.json)
  - [x] Label 的粗体、斜体、下划线及其高度、描边开关与宽度、阴影开关与模糊值均在值改变时更新。对每个属性依次写入初值、新值、相同新值和初值，Windows Debug/Release 均只调用两次原生 setter，Web 同样触发两次渲染数据更新。[真实 JSB 探针](../native/tests/2d-poc/build-sprite-api-probe.cjs)、[Web 对照](../tests/ui/native-2d-m3-label-shell.test.ts)
  - [x] CHAR 缓存的英文整词换行。字号与行高均为 32 时，Windows Debug、Release 和 Chrome 在 86 像素宽的容器中将 `AA AA AA` 排成三行，将超宽的 `AAAAAA` 排成两行。容器增宽至 105 后，三个单词排成两行。旧 Debug 在 86 宽时错误地将三个单词拆为两行。原生双配置的自动整词换行纹理与相同位置的显式换行纹理逐字节一致。[旧场景](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)、[字形位置断言](../native/tests/2d-poc/native/main.cpp)
  - [x] CHAR 缓存的 spacingX 同步影响自然宽度、换行和纹理中的字形位置。Windows Debug、Release 与 Web 在“甲甲甲”上依次设置 0、4.5、−3、0，宽度为 96、105、90、96。容器宽 97 时，前三种字距的行数为 1、2、1。旧 Windows Debug 的宽度始终为 96。Windows 双配置另核对两个负字距字形完全重叠时每个纹素的 alpha，以及含 CRLF 的未换行测量。[旧场景](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)、[原生回归](../native/tests/2d-poc/native/main.cpp)
  - [x] CHAR 缓存的 RESIZE_HEIGHT 按行数和行高计算，并在两位小数取整后加上下描边。Windows Debug、Release 和 Web 的旧场景单行 CJK 高度为 40；行高 19.125 的双行文本在描边前后为 38.25、41.25。原生另核对分数行高下的未换行测量与实际布局高度。[三端回归](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)
  - [x] CHAR 缓存的窄容器换行与行尾空白。在 45 像素宽的旧场景 Label 中，关闭 enableWrapText 的 RESIZE_HEIGHT 仍将“甲乙”分为两行，切换到 NONE 并开启 enableWrapText 后回到一行。35 像素宽下，“甲”后的两个空格和 CRLF 只产生一次换行。Windows Debug、Release 和 Web 的三次高度分别为 38.25、19.13、38.25。旧 Windows Debug 实测为 19.13、19.13、57.38。[旧场景](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)
  - [x] 原生栅格 Label 按 Web 的 overflow 决定是否自动换行。NONE 按显式换行分段，RESIZE_HEIGHT 即使关闭 enableWrapText 也按节点宽度换行。48 像素宽、多行文本在 Web 与 Windows Debug/Release 切换开关后均保持原有高度，85 张图像逐字节相同。[场景与像素对照](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label 运行时字体切换：从位图字体切回系统字体会清空字体资产；再次关闭系统字体、向空槽写入 null 均保留空槽。显式重新指定 BitmapFont 后立即读取到单个 A 字形宽度 16，且混合遮罩场景中的绿色字形正常绘制。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.contentWidth：实际 JSB 验证初值为 0，加载前写入的小数保留精度。Windows Debug、Release 和 Web 的 TTF 在四种 overflow 下发布各自的节点宽度，强制更新覆盖手动赋值；干净帧刷新、BMFont 和 CHAR 更新保留手动值。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.fontAtlas：位图字体场景读取旧接口的初值 null，赋入字体资产的 FontAtlas 后，重复赋同一字体和强制布局均保留该对象。切换到系统字体后引用清空。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.ttfSpriteFrame：启用系统字体 Label 后即可读取带纹理的 SpriteFrame。进入 CHAR 后保留原 TTF 帧，退出 CHAR 后立即发布新的 TTF 帧；组件销毁后新帧和纹理均失效。Windows Debug、Release 和 Web 完成同组场景验证。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.spriteFrame 在系统 TTF、BMFont、CHAR 下分别返回 TTF 帧、字体资产帧和共享字形纹理。两个字号、颜色不同的 Label 读取同一 1024×1024 CHAR 纹理，GPU 回读包含第二个 Label 新增的绿色字形；第一个退出 CHAR 后另一个仍持有有效纹理。Windows Debug、Release 与 Web 运行同一场景。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。

- [x] SpriteFrame 基础数据/算法：quad/sliced UV 迁入 native；rotated、flip、insets、pivot、meshType、packable、clone/reset 与基础静态 API 已补实现，UV 对照与 Windows 定向回归通过，见 [报告](./native-2d-m6.1-sprite-frame.md)。
- [x] SpriteFrame 基础状态：rect/offset/originalSize/pivot 使用 native 可写视图；setter、分量修改、反序列化、克隆和 native 回读不再依赖 JS 权威镜像，Sprite/Mask/BMFont 有原生消费者联动测试。
- [x] SpriteFrame 已序列化 vertices 的读写与克隆。非居中 pivot、非零 Z 的三角形在 Windows Debug/Release JSB 与 Web 实现中得到相同坐标，薄壳回归核对索引、UV、边界及克隆后的独立修改。
- [x] SpriteFrame 的 Sprite 场景历史记录。序列化场景加载静态图集 Prefab，由 Sprite 绘制原帧和旋转裁剪帧。按本轮范围筛选对应捕获后纳入最终候选复验。[历史 GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)
- [x] SpriteAtlas 表同步：可观察 map 的整体赋值/修改、同名替换、null、remove/clear、Details 依赖回填与 getTexture 顺序已同步到 native；迟到回填隔离、原生引用持有/释放和 Windows 实际 JSB 壳联调通过，见 [报告与写入契约](./native-2d-m6.1-sprite-atlas.md)。真实资源/场景加载仍归下方独立验收项。
- [x] Windows Debug 真实 JSB 应用验证 SpriteFrame、SpriteAtlas 的构造身份、Asset 初始化、ccclass 注册、图集序列化属性及实例隔离。两组实例交替查询原生纹理、写入帧表、改变旋转并检查 UV 回调的发送者与次数。与既有依赖回填及原生方法接收者探针一同通过第 8 节门禁。夹具见 [StaticAtlasProbe](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)，日志见 `native/tests/2d-poc/build/m6-prototype-*.log`。
- [x] TTFFont/LabelAtlas/BitmapFont 基础数据与生命周期：原生持有 TTF 字节/family/source、BMFont 配置/glyph/kerning/SpriteFrame；Label 直接持有字体资产并检测 revision，移除逐字形 JSB 传输；切换/清空/销毁、共享引用、实际 JSB 壳及 Windows Debug/Release 定向验证通过。补齐 deserialize/Details 依赖回填，修复 null 默认值 family 在快速反序列化中被当作对象，JIT/非 JIT 回归通过，见 [报告与边界](./native-2d-m6.1-font-assets.md)。
- [x] 字体重载一致性补充：独立配置版本使同内容原生重载失效旧 JS 视图，同时保留依赖回填期间的编辑；released 后忽略迟到 onLoaded。Windows Debug/Release C++ 与实际 JSB 探针、7 个 Jest suite（58 项）通过，见字体资产报告。
- [x] 字体重复生命周期补充：released 后的 JS 配置/TTF 加载赋值直接忽略；三类字体各 1000 次 native 创建、清空、重载、销毁，以及 BitmapFont/LabelAtlas 各 1000 次实际 JSB 循环通过 Windows Debug/Release。当时字体测试入口为 7 个 suite、64 项，后续新增测试见字体资产报告；直接创建资产的循环不替代 asset-manager 加载卸载或泄漏验收。
- [x] Windows 自定义字体选择：GDI 拒绝真实 Thonburi.ttf 后回退，现以私有 DirectWrite collection 加载、shaping 和绘制；明确 COM/缓冲区所有权，Debug/Release 各 1000 次释放计数及 64 项 Jest、ASAN 应用通过。该节点 RichText 当时为 9/12 布局一致、严格图像 0/12，见 [报告与未关闭门禁](./native-2d-m6.1-directwrite-fonts.md)。
- [x] Windows 字体终态通过。真实 TTF、BMFont、LabelAtlas、场景与 Prefab、字体数据和平台句柄回收、复杂文本及 GPU 回读均有双配置证据。其他平台的 alias 和句柄验证暂缓。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)
  - [x] Windows 应用字体文件释放。Debug、Release 各完成 1000 轮本地 TTF 加载、Label 渲染、解绑和释放，另完成 30 轮 HTTP 重新下载和缓存清理。采样点均可独占打开已释放的字体文件，GDI 对象数保持稳定。进程总句柄和 USER 对象数逐阶段记录。三端应用矩阵的 47 组布局一致，严格像素 44 组通过，其余三组按已确认范围暂缓。[检查点与复现](./native-2d-m6.1-font-alias-ownership.md#windows-应用内字体句柄)
  - [x] 独立 Bundle 的真实 TTF 与序列化 Label Prefab 通过预加载、跨场景复用、独立持有、最后持有者释放及冷重载。Windows Debug、Release 和 Web 的 155 张场景图逐字节一致。Web 在最后一次释放时移除 `FontFace` 注册，Windows 归还原生字体字节，三种配置均清除 Prefab 和字体的资产缓存。[生命周期和逐图哈希](./native-2d-m6-ttf-bundle.json)
  - [x] 同名不同源的 HTTP TTF 在 Windows Debug、Release 和 Web 并存、按两种顺序释放并重载。Web 按来源合并下载，渲染别名隔离测宽缓存。两份同名字体测宽为 95.9765625 和 101.9296875 px，四张新增图在三端逐字节一致。[来源与释放证据](./native-2d-m6-font-source-isolation.json)
  - [x] TTF 仅预加载和丢弃原始数据时的浏览器注册检查。实际 Bundle 在 Windows 双配置和 Web 验证丢弃后重载、消费预载数据与最后释放。Web 默认 FontFace 和 Chrome 强制 CSS 轮询在接管前均无注册，两条路径的 155 张图逐字节一致。[预加载所有权证据](./native-2d-m6-font-preload-ownership.json)
- [x] Windows Debug/Release 的已加载 TTFFont 遇到缺失的替换文件时，保留源路径、字节数、别名和修订号。挂接的 Label 仍测得 95.9765625 像素，字形覆盖像素数相同。重试换入 Open Sans 后修订号只增加一次，同一 Label 测得 101.9296875 像素。旧 Debug 在保留原字体的断言处失败。[JSB 回归](../native/tests/2d-poc/build-font-assets-probe.cjs)
- [x] Windows 字体注册表补充：修复单参越界、同 alias 重载不替换和无效绝对路径误注册；脚本引擎 cleanup 释放表。Debug/Release 实际 JSB、1000 次同名重载和临时字体文件释放回归通过。本节点仅覆盖 runtime 清理，逐资产机制见下一项，跨平台仍归字体终态项，见 [报告](./native-2d-m6.1-font-registry.md)。
- [x] 已创建的 Windows Canvas 在字体注册、同名替换、释放和恢复后重新选择字形。相同 Canvas 上，Thonburi 与 Open Sans 的测宽在 Windows Debug、Release 和 Chrome 分别为 95.9765625 和 101.9296875；释放最后一个资产后恢复各自的回退宽度。Windows 另验证首个填充、描边与新建上下文逐字节一致。[回归数据与可执行文件哈希](./native-2d-m6-canvas-font-alias.json)
- [x] Win32 GDI 字体回退支持超出 LOGFONT 名称长度的 CSS 别名。Windows 双配置与 Web 使用 45 字符名称完成注册、替换与释放；Windows 各执行 32 次无效文件回退并核对 GDI 对象数。用系统位图字体 8514fix.fon 实测进程私有注册和 Canvas 析构后的释放。[逐配置结果](./native-2d-m6-canvas-font-alias.json)
- [x] Windows TTFFont 逐资产 alias：native 记录明确持有者与来源代次，独立渲染身份隔离同名换源；共享释放、最后持有者清理、两种换源销毁顺序及迟到释放通过。Debug/Release 各 1000 轮 native/实际 JSB、49 项 Jest、10 项静态检查与同快照真实加载/释放、ASAN 应用通过；严格图像仍 9/12，完整异步/跨平台仍待验收，见 [实现与边界](./native-2d-m6.1-font-alias-ownership.md)。
- [x] 字体工厂失败回滚：native 空字节/赋值异常销毁半成品并回调错误，Factory 同步异常清理等待队列、支持同 ID 重试并隔离旧回调；16 个 suite、120 项和 Debug/Release 实际 JSB 故障探针通过。创建前无主 alias、完整异步下载与跨平台仍待验收，见 [报告](./native-2d-m6.1-font-factory-failure.md)。
- [x] Windows 本地 TTFFont 真实资源循环：Debug 普通/ASAN 应用各 1000 次 loadRemote/releaseAsset 与缓存身份检查，逐轮字节/alias/缓存恢复、失败回滚与同 URL 重试、缺失源拒绝和最终延迟销毁通过；当前源码完整引擎 JS 重建，图像仍 9/12。长期 heap、HTTP/bundle、BMFont/LabelAtlas 与跨平台仍待验收，见 [证据](./native-2d-m6.1-font-remote-lifecycle.md)。
- [x] HTTP 字体缓存来源修复：保留资产 URL，onLoaded 从已下载缓存/临时文件读取 native 字节；缓存换源与 released 回调测试通过。按统一文档构建测试工程并执行基础门禁，旧 M4/M5 探针迁移到真实 GPU/原生段观测；历史 HTTP/ASAN 补充证据及 HTTPS、取消、半文件、无主 alias 等剩余边界见 [报告](./native-2d-m6.1-font-http.md)。
- [x] Label 的内部布局缓存读取 getContentWidth/getContentHeight 已从 JSB 移除。Windows 双配置实测绑定缺席、UITransform 尺寸同步及 TTF 字体重载。RichText 验收通过已有 TTF contentWidth 接口取斜体宽度，Windows Release 为 89.5023 px，Web 为 90.7484 px。三端继续检查内部段命中和事件传播。
- [x] 删除原生 Label 仅供测试使用的 getTextureWidth、getTextureHeight、getLineCount 及三个缓存字段。Windows Debug/Release 的 JSB 探针检查三个方法均不存在。Windows 应用从提交纹理读取尺寸，离屏像素测得英文、中文单行和换行文本的可见高度分别为 32、29、83 px，同时核对 UITransform 的实际尺寸。
- [x] 生产导出清理：原 M0 的两个 PoC 组件及模块入口已删除。Windows 绑定已移除字体别名统计函数和测试编译开关。C++ 测试检查私有计数，Mask 和 RichText 应用夹具检查 JSB 上没有该导出。见 [验收配置](./native-2d-m6.1-font-remote-lifecycle.md)。
- [x] Sprite、Label 和 RichText 清理 9 个引擎未调用的 JSB 读回接口。Sprite 夹具通过公开属性、材质和原生 setter 验证原有行为，C++ 夹具继续检查填充范围和 Label 缓存模式。Windows Debug、Release 各通过 6 组 JSB 探针和 1000 轮场景切换。各 108 张图与 Web 及清理前逐字节一致。[导出清单和运行结果](./native-2d-m6-binding-cleanup.json)
  复核 `cocos/2d/poc`、`native/cocos/2d/poc` 及 `exports/native-2d-poc.ts` 已退出生产源码。继续移除 Sprite 类型读取、Label 字体和样式读取以及独立测量入口，并将 Label 字体更新方法收回到类内。Windows 双配置各通过六组 JSB 探针并检查七个入口缺席。RichText 图片改用原生提交的 16 个顶点、54 个索引验证九宫格。Windows 双配置各 116 张 GPU 图与 Web 逐字节一致。
  [功能裁剪测试](../native/tests/2d-poc/check-m6-feature-matrix.cjs) 同时检查可用模块列表和生成的 `cc.js`。模块列表不得包含 `native-2d-poc`，Windows 与 Web 各九种组合均须排除 `NativeUITransformPoc` 和 `NativeSpritePoc`。
  RichText 的 getSegmentLabel 和 getSegmentSprite 已从 C++ 与 JSB 删除。独立测试通过 Native Node 的组件注册验证 Label/Sprite、池化包装与释放。旧工程按节点布局、GPU 回读与点击事件验收。Windows 与 Web 各九种 Release bundle 检查旧 PoC 路径、模块和组件导出。[绑定与快照记录](./native-2d-m6-binding-cleanup.json)
  BitmapFont 的测试计数方法已从 C++ 和 JSB 删除。Windows Debug/Release 的字体探针直接检查生产路径读取的字形数据，并验证 JSB 实例上没有 `getGlyphCount`。[字体绑定回归](../native/tests/2d-poc/build-font-assets-probe.cjs)
  SpriteAtlas 的测试计数方法已从 C++ 和 JSB 删除。Windows 双配置的[绑定探针](../native/tests/2d-poc/build-sprite-atlas-probe.cjs)检查导出缺席，并用有序帧名、帧查找和纹理验证空槽及释放。Windows Debug、Release 与 Web 的[真实图集场景](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)各完成 1000 轮、5000 项资产检查和 22 次像素回读。
  TTFFont 的原始字节 getter/setter 已从 C++ 和 JSB 移除。原生生命周期测试通过文件加载、释放、重载和销毁后拒绝读入同一有效文件来检查所有权。Windows Debug/Release 的[绑定回归](../native/tests/2d-poc/build-font-assets-probe.cjs)检查两个方法均未导出，两种配置各完成 1000 轮真实远程字体加载释放。37 项布局与图像结果均与清理前一致。
  RichText 的测试专用方法 `getSegmentNode` 和 `getSegmentCount` 已从 C++ 与 JSB 移除。验收通过父节点查询段节点，用实际子节点数逐段核对 Label 或 Sprite，并检查末段之后的索引越界。[Windows JSB 回归](../native/tests/2d-poc/build-richtext-runtime-probe.cjs)
  Sprite、Graphics 的 `getRenderEntity` 与 Label 的 `getString` 已退出生产 JSB。独立测试继续核对 Sprite 顶点透明度、Graphics 提交几何和 RichText 组件的实际文本。Windows 双配置的六组 JSB 探针与 Web 旧工程的 92 张位图字体图像验收通过。[绑定记录](./native-2d-m6-binding-cleanup.json)
  Label 的 `getRenderEntity` 已退出生产 JSB。Windows 双配置应用检查测试绑定缺席，并回读 70000 字形文本的末尾和清空结果。两种配置的 92 张位图字体图像与 Web 及清理前逐字节一致。独立 C++ 检查五个分块、提交资源释放和 CHAR 纹理复用。字体矩阵的 47 组布局与清理前和 Web 一致，严格像素仍有三组差异。[验收结果](./native-2d-m6-binding-cleanup.json)
- [x] 清理 UIRenderer 未用的 JSB 读回和内部变换通知，Sprite 节点查询继承 `Component.getNode`。Web 解析器测试改用模块导入，3871 个解析对照保留 65 个历史输入。Windows 双配置验证实际应用和六组 JSB 探针，各 92 张位图与 Web 一致。Windows 和 Web 各 9 个功能组合通过旧 PoC 导出检查。[绑定与构建记录](./native-2d-m6-binding-cleanup.json)
- [x] Sprite 的原生几何准备收为 C++ 入口。Windows 双配置的 JSB 验收确认 Sprite 对象没有 prepare 方法，帧纹理迟到和 assembler 标脏后经 UIRendererManager.updateAllDirtyRenderers 刷新。独立 C++ 几何测试仍可直接测量准备耗时。该候选 Windows Debug/Release 各 88 张图像均与 Web 逐字节相等。
- [x] Web 引擎断流时返回回退字体资产，释放后同 URL 可恢复真实字形。Chrome 实测重试宽度从 108 恢复到 95.9765625 px，服务端记录一次完整 GET。[HTTP 验收记录](./native-2d-m6.1-font-http.md)
- [x] HTTP 字体主动取消与半文件回收。Windows Debug/Release 验证排队取消零请求、保留旧文件、从 4096 字节处续传及失败文件清理。Web 验证 fetch 取消及续传后的字体摘要。[验收记录](./native-2d-m6.1-font-http.md)
- [x] HTTP 字体部分响应后断线：Windows Debug/Release 各一次 loadRemote 拒绝，缓存与别名计数恢复；同 URL 取得 223404 字节并实际绘字，测量宽度 95.9765625。Web 首次 fetch 读取失败，随后同 URL 经 loadRemote 完成 12 张截图。每个平台记录一次断流、一次完整传输。布局 12/12，严格像素仍为 9/12。见 [HTTP 验收记录](./native-2d-m6.1-font-http.md)。
- [x] 字体数据边界补充：BitmapFont/LabelAtlas 拒绝溢出 float、非法 glyph/kerning 与重复字形，失败保留 native 数据、版本和 JS 编辑视图；TTFFont 销毁后 initDefault 不再改写状态。Windows Debug/Release native 与实际 JSB 定向回归通过，见 [字体资产报告](./native-2d-m6.1-font-assets.md)。
- [x] 字体字号入口复核：BitmapFont/LabelAtlas 忽略非有限字号及 JSB float 溢出，保留默认/零/小数语义；重复赋值、销毁后迟到赋值保持版本稳定。Windows Debug/Release native 与实际 JSB、7 个 Jest suite（68 项）通过，见字体资产报告。
- [x] SpriteFrame 动态合图状态：native 持有原图/图集与恢复坐标，打包/恢复、独立 clone、覆盖与析构所有权通过 1000 次循环和实际 JSB；补内存图片 buffer 上传及 Web Mask 默认阈值同步。文档工程各门禁最后执行通过，12/12 Web/native RGBA 字节相同；M5 标记可见性已由后续日志节点修复；自动打包、完整资源/生命周期与平台范围仍待验收，见 [报告](./native-2d-m6.1-dynamic-atlas.md)和[日志观测](./native-2d-m6.4-log-observability.md)。
- [x] BitmapFont/LabelAtlas GPU 图集消费者：原生字形 quad 直接采样活动图集，移除整段 CPU 纹理合成；帧 revision、纹理尺寸/同尺寸 GPU 重建、sampler 变化与清空引用回归通过。真实 Windows Debug 工程覆盖两类字体、普通/旋转帧的原图/打包/恢复，并验证 70000 字形分块；证据与布局边界见[报告](./native-2d-m6.1-bitmap-gpu.md)。
- [x] BitmapFont/LabelAtlas 基础原生布局：修复默认 CENTER/CENTER，统一字号/源字号缩放、spacing、词/CJK 换行、九种对齐与四种 overflow/裁剪、无换行测量和尺寸更新；2307 组实际 Web 数值对照在 g++/MSVC 通过，含 kerning 的 76 组布局 GPU 与 12 组默认居中合图图像全部字节一致，文档完整串行门禁通过，见[布局报告](./native-2d-m6.1-bitmap-layout.md)。
- [x] BMFont/LabelAtlas 配置源字号：与公共 fontSize 元数据分离，配置重载按 revision 自动更新 Label，原子校验/清空、缺字段兼容回退及非正源字号空测量/空提交回归通过；76 组布局使用公共字号 64、源字号 16/32/8，100 组 GPU 图像均字节一致，完整文档门禁通过，见[源字号报告](./native-2d-m6.1-bitmap-source-size.md)。
  - [x] XML BMFont 在已绑定 Label 时重载配置。Windows Debug、Release 和 Web 校验替换字距和字形宽度、原地删除字形后重载及停用期间恢复配置。布局宽度依次为 40、42、37、40 像素，恢复图与初始图相同。[实时重载证据](./native-2d-m6-bitmap-config-reload.json)
- [x] BMFont/LabelAtlas 帧转换：2307 组 Web 帧矩形、顶点位置和 UV 对照通过，真实 GPU 覆盖非零帧原点、trim/offset 和旋转组合。原生 UI 批次持有 IA 和使用的缓冲区直至清理，确定性回归和完整工程门禁通过，见[帧转换报告](./native-2d-m6.1-bitmap-frame.md)。
- [x] Windows DirectWrite 水平 RTL 字形按排版后的 advance/offset 从右端定位。Thonburi 的 RTL 控制符、对应视觉顺序及泰文叠加标记在 Debug/Release 的四种字号、常规和斜体均与 Chrome 原始画布一致。三张新增 RichText GPU 图也逐字节相同。Arial 纯希伯来文及阿拉伯文各通过 7/8 组常规/斜体；12px 常规、含空格的混排和合成粗体差异另计。[双配置逐项对照](./native-2d-m6-bidi.json)
- [x] 水平 TTF 混排的 U+0020 字距和小字号覆盖率。Windows 使用中性语言单独排普通空格，保留词内 kerning；字形齐全且无字距表的可打印 ASCII 沿用无分段布局。正体按 DirectWrite 字体推荐选择自然平滑。Debug/Release 在相同 Arial、Thonburi 文件和 Chrome 上验证 9 种文本、4 个字号，常规/斜体 72/72 均在 1 级通道容差内。40 张应用图与上轮各端哈希一致。四轮交错微基准中，24px 带空格短句的测量中位数，Thonburi 为 2.57→2.55 µs，Arial 为 198.56→219.03 µs；Arial 绘制为 317.11→345.30 µs。合成粗体原始画布仍为 0/36。[逐样本和 CPU 实测](./native-2d-m6-text-spacing.json)
- [x] Windows 复杂文本与字体资产边界通过。双配置验证泰文叠加、阿拉伯文连接、希伯来文混排，以及两种位图字体的配置变更和 16 组图集帧状态。既有[补充平面字形与 GPU 捕获](./native-2d-m6-bitmap-unicode.json)继续纳入验收。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)
  - [x] 普通 TTF Label 与原生 RichText 共用整词分段。74 px 宽的 `Atlas 123` 在 CLAMP、SHRINK 和 RESIZE_HEIGHT 下，自动换行图与显式拆成 `Atlas `、`123` 两行的图逐字节相同。Windows Debug、Release 和 Web 的三组布局及 RGBA 均一致。旧 Windows Debug 在 CLAMP 图像断言处失败。[验收结果](./native-2d-m6-label-word-wrap.json)
  - [x] 普通 TTF Label 在多段落换行中验证嵌套书写方向、泰文叠加标记、拉丁组合音标及控制空白。Windows Canvas 的测量、填充、描边和阴影将单行 TAB、LF、FF、CR 逐个作为空格处理。旧 Debug 的混合空白段落有 1124 个超差像素，修复后四组新增图在 Windows Debug、Release 和 Web 逐字节一致。独立原生测试另验证 DirectWrite 和 GDI 回退。[验收结果](./native-2d-m6-label-paragraphs.json)
- [x] 动态图集入口回退：拒绝不可上传的来源，满页失败保留剩余空间，同源帧复用已有页。定向 Jest 和真实 Windows Debug/Web 回退探针通过，100 份 RGBA 逐字节一致，见[回退报告](./native-2d-m6.1-atlas-fallback.md)。
- [x] 动态图集帧所有权：删除单帧保留共享源，打包克隆随页跟踪，删除源纹理与重置先恢复帧后释放页。真实 Windows Debug/Web 探针和 100 份 RGBA 对照通过，见[所有权报告](./native-2d-m6.1-atlas-lifecycle.md)。
- [x] 原生组件事件触发自动合图曾在 Windows Debug 与 Web 通过。该实现是禁用前的历史基线，见[触发报告](./native-2d-m6.1-atlas-automatic.md)。
- [x] JSB + Native 暂停运行时动态图集。Windows Debug 验证显式启用、插入、打包和重置均保持原图，Web 自动打包与恢复通过。完整门禁、37 项定向 Jest 和 100 组像素对照通过，见[验收记录](./native-2d-m6.1-atlas-automatic.md#jsb--native-暂停运行时合图)。
- [x] 2026-11-18 确认运行时动态合图终态。JSB + Native 保持禁用，组件和 manager 的显式启用、插入、打包、重置均维持原图；Web 保持启用能力。Windows Debug 完整工程与 Web 重建实测通过，覆盖 Web 回退、自动打包、共享帧恢复及 Sprite/Mask、BitmapFont/LabelAtlas 共 100 组原始像素对照。旧的 Native 自动打包记录留作历史基线。
  - [x] 系统字体 Label 的 CacheMode.BITMAP 遵循同一平台开关。96c37f626f 的 Windows 双 Label 用例在 manager 关闭时仍读到共享纹理。移除独立原生图集后，Windows Debug/Release 实际提交各自的完整源纹理，显式开启 manager 和重绘均保留源纹理。Web 关闭时使用两张源纹理，开启后两帧进入同一图集并保留各自原图。三端重绘前后的红绿字形最大通道差均在 1 以内，两种 Windows 配置各有 92 组位图字体图像与 Web 逐字节相同。[跨平台场景](../native/tests/2d-poc/fixtures/acceptance/BitmapGpuProbe.ts)、[提交纹理检查](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)。
- [x] 静态图集和 Prefab：Windows Debug/Web 实际加载 TexturePacker plist、PNG 和序列化 Prefab，通过三个加载释放循环、两个独立实例、红绿 GPU 换帧、缓存清理和独立图集持有检查。见[验收报告](./native-2d-m6.1-sprite-atlas.md#5-真实资源和-prefab)。
- [x] SpriteAtlas 帧末释放原生帧表：分别覆盖 C++ 和 JSB 销毁队列，拒绝迟到写入，Debug/Release 1000 轮引用计数复归。真实 Prefab 保留 wrapper 的释放断言和连续文档门禁通过。见[所有权验收](./native-2d-m6.1-sprite-atlas.md#6-原生帧引用随延迟销毁释放)。
- [x] SpriteFrame 帧末归还当前纹理和原图。C++ 与 JSB 的销毁队列共用清理入口，迟到依赖不能重新绑定。Debug/Release 各 1000 轮和 Windows Debug 真实资产释放、完整串行门禁及像素对照通过。见[验收报告](./native-2d-m6.1-sprite-frame.md#帧末归还纹理引用)。
- [x] Windows 现行格式资源与场景通过。新增本地取消、逆序依赖、过期回填、三次跨场景 Prefab 重载和 clone 的纹理所有权检查，双配置千轮图集通过。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)
  - [x] XML BMFont 跨场景加载、释放与冷重载。回归 Prefab 通过保留的 UUID 使用旧工程 Open Sans FNT、PNG 和元数据。修复 Web BitmapFont 销毁时归还自有 FontAtlas 的纹理引用。三端验证预加载后缓存未发布资产、跨场景共享、持有原图后重载、五个缓存键清理及冷重载。Windows 使用原图，Web 使用动态合图页。六张新增图逐字节一致。[应用结果](./native-2d-m6-legacy-bmfont.json)
  - [x] 旧 BMFont 图集依赖延迟、取消与重试。预加载后在实际资产管线暂停图集图像依赖，每次等待两个帧末。Windows Debug、Release 与 Web 在等待和首次取消后均查不到五个资产缓存键。同一 Prefab UUID 重试成功，跨场景、释放和冷重载断言通过，144 张图与上轮逐字节一致。[场景与缓存记录](./native-2d-m6-legacy-bmfont.json)
  - [x] 旧式 `.labelatlas` 资源通过 Creator 导入并绑定序列化 Prefab。Windows Debug、Release 与 Web 验证 8 个 16×25 字格，`1076` 的四个中心像素与源图一致。三端通过图集依赖取消和重试、跨场景共享、显式保留原图、最终清理五个缓存键及冷重载。Windows 使用原图，Web 使用动态合图页。[序列化资源及像素记录](./native-2d-m6-legacy-label-atlas.json)
  - [x] 静态图集 Prefab 的旋转帧克隆在原 Prefab、图集和原帧释放后继续渲染。运行时显式持有导入纹理，重新加载同一 Prefab 后，新节点解析到新图集并复用该纹理。Windows Debug、Release 和 Web 的中心像素依次为绿、绿、红、绿。销毁克隆并释放最后一个纹理引用后，纹理失效且缓存中已无该 UUID。[真实加载、回读与释放用例](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)
  - [x] Prefab 异步图集依赖。resources.preload 返回包含 Prefab 和图集文件的请求记录，两者尚未发布到资产缓存。在真实加载管线中暂停图集依赖两个帧末，第一次以取消错误结束，第二次对同一 Prefab UUID 放行。Windows Debug、Release 和 Web 均验证等待中及取消后无半成品进入缓存，重试解析到同一图集内的帧，切帧后中心像素由红变绿，释放后两个缓存键消失。此用例注入依赖阶段取消，传输层中止另行验收。[回归夹具](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)
  - [x] Prefab 在两个真实 Scene 中先后实例化。保留 Prefab 引用时，旧 Sprite 和节点随第一场景销毁，下一场景复用同一图集、原帧、旋转帧与纹理。切到空场景并释放最后一个引用后，五项资产均失效且移出缓存，UI 根计数归零。Windows Debug、Release 与 Web 的整幅图像分别显示红帧、绿帧和空场景，88 组图像逐字节一致。[跨场景断言与图像哈希](./native-2d-m6-windows-web-gpu-results.json)

交付：资产 parity 报告和真实资源回归日志。prototype 改造本身不等于资产下沉验收完成。

### M6.2 RichText 达到终态薄壳

- [x] RichText 内部段查询契约已确认并验证。Windows Debug/Release 的 9 个 Label、1 个 Sprite 通过原生段 API 查询，JS 查询结果均为空；Web 的逐子节点和递归 JS 查询均返回对应组件。[验收入口与结果](./native-2d-build-and-acceptance.zh-CN.md#75-m5-richtext)

- [x] 原生解析准备：新增 RichTextParser/span/style，3871 组输入在 g++、Windows MSVC Debug/Release 产物上与实际 Web parser 对照通过，见 [报告](./native-2d-m6.2-richtext-parser.md)。现已接入下述原生运行时，完整视觉/场景验收仍待完成。
- [x] 原生布局规则准备：RichTextLayout 直接消费 native span，1440 组相同测量值的用例在 g++、MSVC Debug/Release 与实际 Web RichText 布局对照通过，见 [报告](./native-2d-m6.2-richtext-layout.md)。现已连接原生测量和段管理，不能据此认定场景/视觉 parity。
- [x] 基础运行时接入：native RichText + JSB override 使用原生解析、测量与布局，原生创建/复用/布局/销毁 Label/Sprite 段；JS 保留 Component、元数据/序列化、生命周期和 API/点击分发。字体/图集 revision、父 Renderer 共存、基础启停/命中/销毁在 Windows Debug/Release 与实际 JSB 定向验证通过，见 [报告](./native-2d-m6.2-richtext-runtime.md)。
- [x] 完整 native TS 构建：修正 assembler 总入口与 UITransform 类型重入、Mask/SpriteFrame 导入边界，30 项诊断已消除；含 rich-text 的 OPEN_HARMONY preserveType 生成及完整 TypeScript 检查通过。保留 legacy assembler 名称并纯转发 native，定向源码闭包审计与 Windows Debug/Release 实际 JSB 回归通过，见 [构建边界报告](./native-2d-m6-native-ts-boundary.md)。该构建不等于 OHOS native 平台运行通过。
- [x] RichText 点击回调重入：事件命中信息在回调前桥接，避免重排复用旧索引；销毁/禁用/关闭触摸立即停止分发。Windows Debug/Release 实际 JSB 重叠图片段与同步文本替换、3 个 Jest suite（11 项）和完整 native TS 通过，见运行时报告；真实输入/Camera/Mask 与 GPU 仍待验收。
- [x] 建立 RichText 同源字体实际应用夹具：asset-manager 加载/释放真实 TTF、12 例布局/图像记录，并修复 Label 字体失效后准备入口被禁用的黑屏。当时视觉 0/12 通过，记录了 Windows GDI 字体回退与字形/布局差异，后续修复见下方节点，见 [未通过报告](./native-2d-m6.2-richtext-gpu.md)；此勾选仅表示夹具和失败基线建立。
- [x] RichText 样式尺寸补充：native 计入斜体/描边范围，保留布局中间精度，修复自动宽度累计与不收缩；Windows Debug/Release 实际 JSB、11 项 Jest、ASAN 通过。该节点同快照 12/12 布局一致，严格图像当时为 0/12，见 [样式报告](./native-2d-m6.2-richtext-style-extents.md)。
- [x] TTF 纹理映射基础修复：去掉额外边框、对齐 alphabetic 基线/下划线、背景预填与 clamp sampler；Windows 小数矩形覆盖和 source-over、1000 次 Canvas GDI 释放回归通过。12/12 布局及画布尺寸一致，严格像素仍 0/12，见 [映射报告](./native-2d-m6.2-label-raster.md)。
- [x] 建立原始 TTF 画布诊断：4 字号 × 3 样式的生产 DirectWriteFont / Chrome Canvas 原始 RGBA 对照，Windows Debug/Release native 字节一致，严格像素 0/12；单独开启 grid fitting 无法解决差异，未改变生产参数，见 [诊断报告](./native-2d-m6.2-ttf-raw.md)。
- [x] Windows TTF mask 与预混合修复：LCD mask 整数平均、sRGB 亮度表、LTR glyph 定位与预乘字节处理；12 个 Web 普通字校验值、Debug/Release 原生/实际 JSB、49 项 Jest、ASAN 应用通过。完整应用同快照布局 12/12，严格图像提升为 8/12；原始扩展矩阵 28/96，合成样式、灰色 RGB 取整及其他边界仍待验收，见 [报告](./native-2d-m6.2-ttf-preblend.md)。
- [x] Windows 自定义字体合成斜体：regular shaping + glyph 原点 -0.25 剪切，保留 advances/offsets；24 个 Web 普通/斜体校验值、Debug/Release 原生/实际 JSB、49 项 Jest、ASAN 应用通过。完整应用同快照严格图像提升至 9/12，布局 12/12；原始矩阵 56/96，粗体/描边/嵌套及灰色 RGB 取整仍待处理，见 [报告](./native-2d-m6.2-ttf-italic.md)。
- [x] 建立合成粗体轮廓诊断：DWrite regular outline + D2D Widen/union，与横向四倍采样/FIR 两种独立候选均可复现；36 组 Debug/Release 输出一致，普通字/斜体不变，粗体仍 0/4，未接入生产或关闭视觉门禁，见 [失败记录与下一步](./native-2d-m6.2-ttf-outline-probe.md)。
- [x] Windows 合成粗体轮廓下沉：regular shaping + 扩张/union、边缘量化/FIR，移除 bold face 替换；新增局部 mask 裁剪、STA lease 和 1000 次实际绘制释放回归，Debug/Release、实际 JSB、49 项 Jest、ASAN 应用通过。完整应用仍 9/12，bold 差值降至 20、nested 降至 47；剩余边缘及描边继续验收，见 [实现与边界](./native-2d-m6.2-ttf-bold.md)。
- [x] Windows 自定义字体真实描边：Canvas strokeText + round/miter/bevel 接入，Label 按后端能力使用轮廓描边；空心内部、裁剪、线宽/默认值、STA 与重复释放测试通过。GPU outline 差值 122→30，但严格图像仍 9/12，原始描边 0/72；视觉门禁保持未通过，见 [实现、证据与边界](./native-2d-m6.2-ttf-stroke.md)。
- [x] 斜体描边顺序修复：先斜切字形再 Widen，保留笔宽/圆角；72 例 Debug/Release 字节一致，24 个斜体用例最大差值全部下降，其他 48 例字节不变。native/实际 JSB 与静态回归通过；原始严格对照仍 0/72，未重跑完整 GPU/ASAN，见 [证据](./native-2d-m6.2-ttf-italic-stroke.md)。
- [x] 单字形亚像素起点对照。Windows Debug、Release 和 Chrome 在 64 组中对起点的分组全部一致。48 个超差组合在整数起点仍能复现，关闭轮廓点量化后严格通过数仍为 1024/4096。[方法与逐组记录](./native-2d-m6.2-ttf-stroke.md#单字形起点与轮廓覆盖)
- [x] 将圆角扩张与栅格化分开对照。Windows Debug/Release 对同一组生产线段得到相同结果，96 个掩码与 CanvasKit 的覆盖均超差。CanvasKit 扩张后交 Direct2D 填充的 12 张图全部超差，完整 CanvasKit 描边和覆盖回放有 7 张达标。当前应用的视觉门禁继续保留原容差。[分阶段结果](./native-2d-m6-ttf-canvaskit.json)
- [x] 分离字形局部展开精度、亚像素起点和掩码裁剪。Windows Debug、Release 的相同 96 个掩码按字形局部精度展开后，12 张描边图对 Chrome 的 alpha 超差像素由 40 降为 7，四个斜体字号均通过 RGBA。透明背景确认 48 px 正体的单处 RGB 误差可由一级覆盖差解释。两种配置的逐图哈希一致，应用像素 Gate 仍待签收。[对照数据](./native-2d-m6-ttf-scaler-stroke.json)
- [x] Windows RichText 的公开接口、布局、视觉、用户事件及包装对象生命周期通过。文本和图片段的常驻、销毁、池中 GC 及重建均在真实切场景中验证。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)
  - [x] RichText 发布节点尺寸后，`SIZE_CHANGED` 监听器设置的新文本同步生成新的段。旧 Windows Debug 在回调后仍保留先前文本。Windows Debug、Release 的真实 JSB 探针以及三端应用夹具覆盖回调替换、段数与布局。[JSB 探针](../native/tests/2d-poc/build-richtext-runtime-probe.cjs)、[应用夹具](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] RichText 生成子节点时，`CHILD_ADDED` 监听器的文本更新在尺寸发布前应用。旧 Windows Debug 虽然收到事件，仍保留原先的段。Windows Debug、Release 和 Chrome 均生成且只保留一个新文本段。两种 Windows 配置各完成 1000 轮字体生命周期，42 张图与上轮逐字节相同，严格对 Web 仍为 39/42。场景快照为 `93b5c6389fa50e2a3f85ce17180f0ee18d405468adfdb5ca63fe8db348ff05f8`。[应用夹具](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] `CHILD_ADDED` 回调内解绑 RichText 或把它移到另一个宿主时，原布局停止提交。Windows Debug、Release 的真实 JSB 探针验证旧宿主的段全部移除、旧 Label 包装失效、重新挂接和换宿主后只在当前宿主生成段。三端应用验证在同一回调调用 `destroy()` 后只留下用户创建的子节点。两种 Windows 配置各完成 1000 轮字体生命周期，42 张图与上轮逐字节相同。场景快照为 `5ac028e993b85ea55d44c720b341282ed34b9b524426bac4c8378b3245df0f59`。[JSB 探针](../native/tests/2d-poc/build-richtext-runtime-probe.cjs)、[应用夹具](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] 真实应用中的 128 段 RichText 生命周期。修复 JSB `Node.layer` 绕过原生通知后段层未更新的问题。Windows 双配置和 Web 各通过 32 轮重建、4224 对增删事件、层和启停同步、内部组件查询契约及图集缓存释放。四张新增图逐字节一致。[生命周期和像素证据](./native-2d-m6-richtext-node-lifecycle.json)
  - [x] RichText 重新启用时，段节点的激活监听器可以同步清空文本。Windows Debug 的旧候选在回调后退出，修复后 Windows 双配置和 Web 都移除三个旧段，生成一个新的可见段。整组移动到停用的父节点后隐藏，重挂接后复用新段并恢复原像素，销毁宿主后无残留。[重入与场景证据](./native-2d-m6-richtext-reactivation.json)
  - [x] RichText 在 `CHILD_ADDED` 回调中修改宿主锚点时，原生布局会在发布尺寸前应用新锚点。直接读取首段坐标的原生回归从旧值 0 恢复到预期的 −22.226563。应用夹具同时核对实际 Node 包装对象的身份、父节点、激活状态和再次改变锚点后的坐标。[回归说明](./native-2d-m6.2-richtext-runtime.md#段节点挂接时修改宿主锚点)
- [x] 固定 Web/native 回归覆盖 color/b/i/u、size/br/outline、img/imageAtlas、contentSize、hit/miss，以及 shadow、嵌套样式、对齐和最大宽度、动态编辑、输入派发和销毁解绑。Windows Debug、Release 和 Web 布局 62/62，严格像素 59/62，按当前范围暂缓三项字形像素差。[输入及完整回归](./native-2d-m6-richtext-projected-input.json)
  - [x] Windows 双配置与 Web 的同一 RichText 场景验证未知 shadow 标签、斜体与下划线、居中转右对齐、两行点击、关闭触摸和销毁解绑。场景自身验证 GPU 重绘，47 张固定图与上一节点逐字节一致。[组合场景证据](./native-2d-m6.2-richtext-gpu.md#样式重排与触摸组合)
  - [x] Windows Debug、Release 与 Web 通过输入派发器验证 RichText 点击。在平移相机与旋转、缩放的祖先 Mask 下，使用宿主命中投影出的世界坐标选段。覆盖从遮罩外按下、按下后移出取消、Mask 反转和错误窗口 ID。两条可见链接按 `first`、`second` 顺序各触发一次。[触摸与渲染回归](./native-2d-m6-richtext-projected-input.json)
  - [x] RichText 动态换行后改成含未知 <shadow> 标签的双色文本。Windows Debug、Release 和 Web 都移除了旧行，保留内部红绿样式、段位置与尺寸。三端分别与无标签对照逐像素一致，跨端最大通道差为 0。实际 Label 阴影另行验收。[回归场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] Windows 单行 Label 的零模糊阴影按 UI 坐标绘制一次。固定大小 96×96、24px Thonburi 字体的字母 I，分别偏移 (16,14) 和 (−16,−14)。GPU 回读按半覆盖阈值比较原阴影与平移后的字形。旧 Debug 正向有 98 个差异像素，修复后 Debug、Release 和 Web 两个方向各覆盖 30 个像素，差异均为 0。模糊、裁边及自动尺寸另行验收。[回归场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] Windows 单行 Label 的非零模糊阴影采用 UI 偏移方向。对 24px Thonburi、模糊值 2、偏移 (16,14) 与 (−16,−14)，比较绿色阴影和移动后白色字形的 GPU 质心。旧 Windows 正向纵差 −28.078px，修复后两方向均为 −0.078px，Web 为 −0.119px。此项验证位置，模糊核形状和裁边仍待验收。[像素夹具](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] Label 的零效果阴影采用 TS 的启用条件。模糊为零且偏移为 (0,0) 或 (1e−6,−1e−6) 时，整张 GPU 回读与关闭阴影逐字节一致。修复前 Windows 在 (0,0) 时改变了 64 个像素。[场景用例](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] Windows 多行 Label 按 Web 的顺序绘制阴影效果和正文。两行相同的文本使用正负一个行高的硬阴影偏移，改动前各有 1003 个像素超差。双配置复测与 Web 逐字节相同。[GPU 用例](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts)
  - [x] TTF Label 阴影的画布尺寸、文字对齐和节点尺寸。四种溢出模式分别验证左上、居中、右下对齐及正负偏移。修复前 Windows Debug 的 24 张图每张有 981 至 1420 个差异像素。修复后 Windows Debug/Release 的节点尺寸、纹理尺寸及 24 张 RGBA 均与 Web 一致。覆盖单行和零模糊。[逐图数据](./native-2d-m6-label-shadow-layout.json)
  - [x] Windows 自定义 TTF 的非零阴影先过滤原始字形掩码，再按阴影颜色混合。模糊值 2、4、8 和左右裁边五张图，Debug、Release 与 Web 逐字节一致。改动前最大通道差为 249。独立原生回归验证常规与粗体字形主体在画布外时，裁剪图与完整图的同一区域逐字节一致。[逐图数据](./native-2d-m6-label-blur.json)
- [x] Windows GDI 合成斜体布局例外仅用于 M5 系统 Arial 40px 的单段 Italic。Web 基准 90.748px（舍入校验 ±0.01px），Windows 接受历史差值 9.748px 加 0.001px 舍入余量。实测 Windows Debug/Release 均为 89.50227px，Web 为 90.74836px。自定义 TTF、字形图像、事件与其他布局保持各自门限。[历史对照](./native-2d-m5-web-parity.md)

交付：native 解析/布局测试、场景对照、壳审计。M5 的文本/图片渲染闭环继续有效，不能用它替代本项。

### M6.3 Graphics/Mask 完整性（承接 M4.3）

- [x] 移除 Graphics 的三个测试专用 JSB 方法 `getVertexCount()`、`getIndexCount()`、`getRevision()` 和原生修订计数。用例从提交给渲染器的 `RenderDrawInfo` 检查矩形和笔画的顶点、索引及 Mask stencil。Windows Debug/Release 从空目录构建，786 组几何与 Web assembler 一致；两个配置各 85 张图与本轮 Web 逐像素一致。[图像和构建指纹](./native-2d-m6-windows-web-gpu-results.json)
- [x] 原生几何核心准备：多子路径/增量 fill-stroke、曲线细分、单环 Earcut（含 Z-order、局部交点修复与拆分）、lineJoin/lineCap/miterLimit 网格生成；786 组实际 Web helper/assembler 对照在 g++ 与 Windows MSVC Debug/Release 通过，含 5000 点复杂填充，另验证 80000 顶点的 32-bit 索引。见 [报告](./native-2d-m6.3-graphics-geometry.md)。现已接入下述运行时基础路径，不能替代 GPU 像素/性能验收。
- [x] 原生 Graphics 网格提交基础接入：移除 CPU pixels/Texture/Sprite 兼容路径，使用独立 mesh chunks、graphics 距离顶点布局与 local UBO；80000 顶点分块并实际上传 GPU buffer。Mask rect/ellipse/custom 改用几何，Sprite stencil 保留资产纹理；JS 移除 getFrame/lateUpdate 轮询。显式拥有者/借用通知、CHAR 缓存注册表租用、Windows Debug/Release 实际 JSB 和定向回归通过，见 [运行时报告](./native-2d-m6.3-graphics-runtime.md)。
- [x] Windows Debug 应用 GPU 定向对照：独立相同场景/脚本经真实 Batcher、shader/local UBO、Camera、stencil 和 readPixels 捕获 40 例，Web/native 全通道差值 0；含大尺寸/缩放/3D 旋转、曲线/多路径、9 类描边、80000 顶点 Graphics/Mask、嵌套/inverted/空 Mask 与 alphaThreshold。修复 deprecated graphics→subComp、VERTEX alpha 和两端空嵌套 stencil 配对，见 [报告、结果与待办](./native-2d-m6.3-graphics-gpu.md)。该历史快照含当时未提交的 SpriteFrame native getter，未作为 M6 最终候选；getter 后续已移除，当前继续采用无 native property 方案。
- [x] Windows Debug/Release 与 Web 的 78 张 GPU 图像逐通道相同。缩放、旋转、大尺寸、多子路径、Camera 切换和混合绘制均经实际 RenderTexture 读回。混合场景逐点检查 Sprite 红、Label 绿、Graphics 蓝及 stencil 后继 Graphics 黄。[逐图哈希与结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Mask radius 与动态几何状态：半径归原生所有，圆角限幅/更新、尺寸/anchor 更新、rect→ellipse 已通过真实 GPU 对照；扩展夹具 48/48 图像全通道差值 0，见 [状态与命中报告](./native-2d-m6.4-mask-state-hit.md)。动态资产、完整混合场景和跨平台仍待验收。
- [x] Windows Debug、Release 与 Web 实际 GPU 验收通过。覆盖 9 种 lineCap/lineJoin 组合（miterLimit=2）、roundRect、ellipse、arc、曲线、填充、描边和 clear 后重绘。夹具逐项检查必需的非空图像，三端全部 74 组捕获无通道差异。[候选指纹与逐图结果](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Windows Debug/Release 同轮对比逐 API JSB、新建和复用命令缓冲。单个 rect 选择直接调用，密集路径选择复用缓冲。256 个闭合路径的 Release 提交时间中位数为 581.7 → 349.1 µs，调用数为 1282 → 3，所有方式均单次 draw。六种输入与 Web 图像逐字节一致。[分配、逐轮数据及接口结论](./native-2d-m6.3-graphics-commands.md)
- [x] Windows Debug/Release、Web 验证四类 Mask、反转、嵌套和 stencil 恢复、阈值、尺寸与资产切换。椭圆从 4 段改为 64 段，着色面积从 8000 增至 12560；混合场景从不透明帧换为左右透明度不同的帧，着色面积从 12400 降至 6400，后继 Graphics 保持黄色。[逐图结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Graphics 在原生端选择内置绘制材质。Mask 在挂接 Sprite stencil 时选择内置 alpha-test 材质，各实例持有独立阈值。两个 Mask 共享一张纹理并交换阈值，Windows Debug/Release 与 Web 逐像素一致，销毁其中一个 Mask 后材质引用数恢复。[GPU 对照](./native-2d-m6-windows-web-gpu-results.json)
- [x] Sprite stencil 的 `Mask.subComp` 在 Windows 返回宿主节点上的 Sprite，复用已有组件。Windows Debug、Release 和 Web 验证组件身份、帧双向同步、禁用与恢复、共享纹理阈值隔离。两种 Windows 配置的 88 张图均与 Web 逐字节一致。[验证结果](./native-2d-m6-mask-sprite-stencil.json)
- [x] 移除 Mask 内嵌的重复 Sprite，图像 stencil 统一使用宿主组件。清理 `n2d.Mask.getRenderEntity`、`n2d.Mask.setSpriteFrame`、`n2d.UITransform.hitTestWorldXY` 绑定。Windows Debug/Release 的 V8 探针检查导出，C++ 检查 stencil 几何，三端复测 88 张图。[清理验证](./native-2d-m6-mask-sprite-stencil.json)
- [x] Windows Debug、Release 和 Web 完成 Graphics/Mask 创建、静止和变更测量。32 个矩形在单组件与 32 个组件中分别产生 1、32 个批次，单层与双层 Mask 分别产生 3、5 个批次。三端以 4096 字节纹理上传校准计数，覆盖全部 189 个采样窗口。[成本与复现](./native-2d-m6.3-graphics-cost.md)

交付：M4.3 补充报告、像素对照与性能结论。兼容光栅化基础通过不等于本项完成。

### M6.4 事件、生命周期与硬化

- [x] 移除 `Batcher2d` 生产头文件中的测试专用友元。Windows Debug、Release 使用正常注册和遍历入口验证重复注册、重复移除、未挂载到 Scene 的节点和 1000 次节点销毁。嵌套根节点的最终透明度可区分去重和重复遍历。Web 与薄壳的组件注册及生命周期测试共 10 项通过。[原生回归](../native/tests/2d-poc/native/main.cpp)

- [x] 原生命中基础链路：Mask.isHit 仅传世界坐标；原生计算圆角/椭圆/反向边界，UITransform 筛选 Camera windowId/layer/离屏并查询当前祖先 Mask。Windows Debug/Release 绑定及生命周期回归、真实场景 19/19 命中检查通过，含 disable/reparent/destroy；见状态与命中报告。完整事件/多 root/Camera/平台矩阵仍由下一项验收。
- [x] hit test：Windows Debug、Release 与 Web 的 22 项命中检查一致。覆盖屏幕 Camera、窗口和层过滤、旋转与非均匀缩放、跨 root 重挂、嵌套 Mask、启停及销毁。[逐项结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] RenderRoot2D 在 Windows Debug、Release 和 Web 通过多 root/Canvas/Camera 回归。11 个注册状态断言覆盖重复启用、禁用、重排、销毁；场景切换 1000 次、4998 项循环断言通过。不同注册/优先级、目标切换和跨场景常驻 root 的 GPU 中心颜色按预期变化。比较器检查命名捕获均存在，再比对 256×256 RGBA。[状态序列与图像指纹](./native-2d-m6-windows-web-gpu-results.json)。
- [x] RenderRoot2D 注册基础硬化：Node 销毁通知、Batcher 独占观察 link、遍历范围强引用快照、重复注册/排序/回调期间变更、跨 root batch/stencil 清理；Windows Debug/Release 与 1000 次 plain Node 注册/释放通过。单 Camera 下两个 root/Canvas 的启停/重排/销毁 GPU 对照通过，扩展夹具 58 图像差值 0、11 注册和 19 命中检查通过；见 [报告与剩余矩阵](./native-2d-m6.4-render-root-lifecycle.md)。不关闭上一项的真实场景/多 Camera/平台门禁。
- [x] Windows Scene/多 Camera 定向矩阵：修复 Graphics 在 onLoad 前丢命令和从未激活实例的 backend 清理；普通 Debug/ASAN 与 Web 同快照 74 图像差值 0，1000 次实际 director 切换、动态纹理创建销毁与 4998 项循环断言通过。见 [报告与边界](./native-2d-m6.4-scene-matrix.md)；不是完整 asset-manager、泄漏、Release GPU 或平台验收。
- [x] CHAR 图集由使用它的 Label 通过 IntrusivePtr 持有。最后一个引用释放时同步清理原生查找指针，JSB 与 Web 共享独立的 LetterRenderTexture 类型。Debug/Release 验证双 Label 共享、释放一个后继续绘制和切换缓存 1000 次，两个配置各 85 张图像与 Web 完全一致。运行时依赖与所有权审计、测试工程 M0/M2/M3/M4/M5 和 SpriteFrame 回归通过。[当前 GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)
- [x] 已按 17 类清单核对 attach/detach、Node 借用槽位、RenderEntity/DrawInfo、纹理、字体缓存及回调所有权。Windows Debug、Release、ASan Debug 在同一源码快照完成千轮场景切换，各 88 张图与 Web 逐字节一致。[逐类核对](./native-2d-m6.4-ownership.md)、[配置和产物指纹](./native-2d-m6.4-ownership-results.json)
  - [x] 宿主析构时按挂载顺序从当前组件列表逐个解绑。回调迁移的组件在新节点保留有效的双向关联。原先的快照会重复通知已迁出的组件，导致透明度设置失效。[原生回归](../native/tests/2d-poc/native/main.cpp)
  - [x] UITransform 的尺寸回调随宿主销毁释放。迁移到另一个存活节点仍能收到尺寸通知；原节点先析构时，独立存活的布局对象再次改尺寸不会通知旧宿主。Windows Debug/Release 检查闭包对象存活数、回调次数和 JSB 布局推送。[所有权回归](../native/tests/2d-poc/native/main.cpp)、[JSB 探针](../native/tests/2d-poc/build-layout-probe.cjs)
  - [x] UITransform 销毁时移除节点缓存中的自身引用。Windows Debug 修复前复现旧组件残留，修复后 Debug/Release 均检查清理、替换及尺寸回调解绑。Web 检查移除后查询为空以及重新挂接可查询。[Windows 探针](../native/tests/2d-poc/build-layout-probe.cjs)、[Web 回归](../tests/ui/ui-component-registration.test.ts)
  - [x] UITransform 同级节点按 priority 排序。修复前 Windows Debug 提高红色节点的 priority 后仍显示蓝色。Windows Debug、Release 和 Web 使用同一排序规则，并检查分数优先级、同值顺序和重挂接。两种 Windows 配置各 92 张图与 Web 逐字节一致。[本轮数据](./native-2d-m6-ui-transform-priority.json)
  - [x] CHAR Label 在宿主先销毁时归还共享字形图集引用。双配置核对持有、析构宿主、重新挂载、显式解绑，以及在分离状态主动取纹理后再次解绑的引用计数。[原生回归](../native/tests/2d-poc/native/main.cpp)
  - [x] Sprite、Label 薄壳在 `onLoad` 时通过 `setNode` 绑定布局，已移除 JS 查询 UITransform 和回传指针的调用。Windows Debug/Release 的[真实 JSB 探针](../native/tests/2d-poc/build-renderer-manager-probe.cjs)检查两个类均无 `setUITransform` 导出。Sprite 的 `getUITransform` 也已从 JSB 移除。RichText 图像段布局的借用包装对象由 C++ 回归检查入池有效、解绑后失效。
  - [x] Mask 自身从宿主节点取得布局，图像遮罩使用宿主 Sprite 的节点绑定。已移除 JSB 的 `Mask.setUITransform`。Windows Debug/Release 检查布局晚挂载、替换、销毁、换宿主后修改旧布局，以及两端分别对 Web 的 88 张 GPU 图像。[原生生命周期回归](../native/tests/2d-poc/native/main.cpp)、[像素对照入口](../native/tests/2d-poc/compare-graphics-gpu.cjs)
  - [x] UIOpacity 换宿主、显式解绑及组件析构时恢复旧节点的 localOpacity。修复前，真实 JSB 将取值 102 的组件换宿主后两个节点都为 0.4，解绑后新节点仍为 0.4。Windows 双配置覆盖宿主和组件两种销毁顺序，并复测 Prefab、启停和继承透明度。[原生回归](../native/tests/2d-poc/native/main.cpp)、[Prefab 探针](../native/tests/2d-poc/opacity-rollback-probe.js)
  - [x] Node 的 RenderEntity 槽位。Graphics 接管同一节点后，移走旧 Sprite 曾清空 Graphics 正在使用的槽。解绑现在校验槽内对象身份。Windows 双配置验证旧组件换宿主、当前组件解绑及析构；88 张渲染图与 Web 逐字节相同。[原生回归](../native/tests/2d-poc/native/main.cpp)、[三个所有权节点的快照与图像哈希](./native-2d-m6.4-renderer-ownership.json)
  - [x] Sprite 与 Label 对 UITransform 的借用。Windows Debug 在修复前复现五项失败。修复后 Debug/Release 均通过节点切换、布局晚于 Sprite 挂载、布局移除、尺寸回调添加组件及宿主先于布局销毁的[原生回归](../native/tests/2d-poc/native/main.cpp)。两种配置的 12 张位图采样和 80 张布局图分别与 Web 逐通道相同。
  - [x] UIRendererManager 借用组件指针。禁用、解绑与析构同步从注册表和 dirty 队列移除组件；重新启用调度暂存的变更。Windows Debug/Release 验证实际更新次数、回调期间修改队列的顺序、父节点移动后的顶点，以及共享纹理更换后两个 Sprite 的绘制数据。JSB 仅暴露实例的 `updateAllDirtyRenderers()`。[原生回归](../native/tests/2d-poc/native/main.cpp)、[JSB 探针](../native/tests/2d-poc/build-renderer-manager-probe.cjs)
  - [x] RichText 内部段的 JSB 借用引用。修复前 Windows Debug 在销毁 RichText 后仍将保留的内部组件包装判为有效。Windows Debug/Release 的[真实绑定测试](../native/tests/2d-poc/build-richtext-runtime-probe.cjs)分别创建 24 个图像段和 24 个文本段，池内的 10 个 Sprite 和 20 个 Label 继续有效，超出容量的包装在重新布局时失效。销毁 RichText 后，所有借用包装（含 Sprite 的 UITransform）均失效，独立创建的 Label 仍有效。双配置各完成 1000 轮真实字体生命周期；与 Web 的 12 组布局一致，每张图在各自平台都与[上轮捕获](./native-2d-m6-canvas-fill-performance.json)哈希一致，严格像素仍为 9/12。本轮场景快照为 `60e7be125431e519b45e4e1714c2330a7a13fb24394095229f50923787883faf`。旧场景包超时当次的分配顺序未经验证。
- [x] Windows Debug/Release 已确认 GLES3 设备线程实际分离，核对主线程 walk、上传快照、队列消费与分帧回收。场景切换、异步资源完成、禁用后销毁及 Web 对照见[线程边界与验收](./native-2d-m6-threads.md)。
- [x] Windows M5 日志观测缺陷：真实 Kernel/Script 日志在 stdout 全缓冲子进程中可确定复现“调用已返回、退出前不可见”；Win32 显式刷新后 red/green 通过。唯一运行日志/二进制指纹/双时钟/CPU/退出码诊断已接入，完整文档串行验收一次通过，同一 app 连续 3 次 M5 在原 45 秒预算内无重试通过，见 [报告](./native-2d-m6.4-log-observability.md)。
- [x] Windows 图集与 RichText 连续场景的帧内资源生命周期。离屏窗口销毁前清除依赖附件的管线帧缓冲，切换窗口刷新活动纹理。UI 批次持有采样视图和源纹理直至清理，帧末停止访问已上传的 DrawInfo。三次原始 ASan 报告分别定位到 framebuffer 析构、批次 reset 和 GLES3 纹理绑定。修复后原生引用计数回归、Windows Debug 串行门禁及 32 项定向 Jest 通过，100 组图像对既有 Web 基准差值为零。ASan M5 共四次通过（含连续三次），每次 9 个 Label、1 个 Sprite、8725 个着色像素。Debug 应用 SHA256 为 `5a3e867cf950618f42342b7f72dbcebe107ae733c649723be6e82204f462fb6d`，ASan 应用 SHA256 为 `decc3ca0c8af6d23c1c7df266706a07149c4e15a821b754879a68c3df84ecff7`。日志位于 `native/tests/2d-poc/build/m6-window-*.log` 和 `build/static-atlas-heap-gate/asan-m5-reports`。完整线程与平台矩阵继续验收。
- [x] Windows 调度回归通过。Debug、Release 交替各启动 10 次，无重试，全部在原 45 秒预算内产生唯一终态标记，清理前进程均存活。每次保留应用哈希、stdout/stderr、单调时间和 CPU 采样。[20 次运行记录](./native-2d-m6-scheduling-results.json)。同场景 Web、Windows Debug/Release 及 ASan 的千次场景切换和 78 张 GPU 图像均通过。旧两次缺失仍无完整日志，原因未定。
- [x] 同场景静态图集与 Prefab 真实资源千轮压力：Windows Debug 与 Web 各通过 5000 个资产引用和缓存检查、22 个 GPU 像素断言。Windows 私有字节采样和 V8 映射稳定，Chrome GC 后堆从第 100 到 1000 轮增加约 0.93 MiB。完整串行门禁通过，见[采样与范围](./native-2d-m6.1-sprite-atlas.md#7-真实资源千轮压力)。
- [x] 完成同场景 Web 千轮堆增长归因。默认与关闭 V8 优化编译各运行 1000 轮，比较第 100 和 1000 轮堆快照。默认快照增长的 90.5% 落在 V8 `code` 类，对照的总自身字节基本持平，两组关键资产实例计数均下降。见[堆快照对照](./native-2d-m6.1-sprite-atlas.md#8-web-堆快照归因)。
- [x] Windows Debug/Release、完整工程 ASan、CRT/V8 诊断主机与 Web 均通过真实 Prefab 连续加载卸载 1000 次，每份报告含 5000 项资产和 22 项 GPU 检查。每 100 轮显式 GC、核查 500 个弱引用；Windows 双堆和 Web 快照中 Prefab、图集、精灵帧、纹理、图片实例均减少。Web 新增绘图对象全部追到当前活动场景，Windows ASan stderr 为空。[配置、覆盖限制与复现](./native-2d-m6-asset-lifetime.md)及[逐轮数据](./native-2d-m6-asset-lifetime.json)。
- [x] Windows MSVC Release 应用项目构建与基础渲染矩阵。使用同一套 Debug 验收脚本资源，Release 原生二进制完成 M2 五模式、M3 Label、M4 Mask/Graphics 和 M5 RichText，M5 计入 9 个 Label、1 个 Sprite，着色像素为 8725。Release 输出的 12 份图集与 88 份字体 RGBA 和 Debug 同名捕获逐字节一致。Release 应用 SHA256 为 `ed9de14382436006389b64a9b23928b4dba834766993aec429666ee4e816b6b4`；日志见 `native/tests/2d-poc/build/m6-release-*.log` 和 `m6-windows-release-build.log`。此处 Release 指 C++ 配置，发布脚本与完整事件矩阵继续验收。
- [x] M6.4 Windows Native/JSB 的 Debug、Release 在同一实现候选完成签收。macOS、iOS、Android 和 OHOS 暂缓。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)
  - 历史记录 `68af105c8d` 在 Windows Debug、Release 分别完成 163 张通用图的 Web 逐字节对照，RichText 布局 62/62，严格像素 59/62。[历史应用、回退与调用追踪](./native-2d-m6-candidate-recheck.json)
  - [x] 候选 `244decdeb0` 的 Windows Debug、Release 与 Web 重建后通过同一快照的 RichText 字体应用矩阵。Windows 双配置各通过 47 项布局、44 项严格像素和 1000 次加载释放，三项像素差异按当前范围暂缓。[本机矩阵记录](./native-2d-m6-richtext-configurations.json)
- [x] 模块裁剪通过。Windows 和 Web 的 Release 引擎分别构建 9 种组合：无 2D，以及 2D 加 rich-text、mask、graphics 三个独立特性的全部 8 种组合。检查每个实际 cc.js 的公开导出，逐类核对启用及移除结果。[18 个 bundle 的 SHA256 和导出清单](./native-2d-m6-feature-matrix.json)。复现命令为 node native/tests/2d-poc/check-m6-feature-matrix.cjs。

交付：平台矩阵、生命周期/泄漏/线程报告和可定位的失败项。

### M6.5 性能与最终 Gate

- [x] 已固定 7e83734299 迁移前版本、7045a76a35 候选、硬件和构建模式；Windows Release 与 Web 完成五种负载三轮对照。每个场景预热 30 帧，稳态及 10% 变更态各采样 120 帧。[方法、环境和数据](./native-2d-m6-performance.md)。
- [x] Windows 文本行宽复用。Label 布局与绘制共享行宽，GDI 复用同一次测量，DirectWrite 左对齐省去定位测量。六轮混合变更帧从 4.2690 降至 3.6188 ms，系统字体和自定义字体在 Windows 的优化前后像素一致。[测量和回归](./native-2d-m6-text-width-reuse.json)
- [x] Windows Release 候选 `3b6a4f3c9b` 的固定混合变更帧达到性能 KPI。六对交错采样使用相同的 Windows 场景资源和 V8 DLL。包含原生 `Batcher2d` 的 CPU 时间下降 67.2%，每帧 JSB 调用下降 77.5%，堆峰值下降 41.9%，强制 GC 中位数下降 56.0%（六对中四对改善）。Web 完成 12 项同源负载。最终 Gate 在统一候选上重跑。[实测数据](./native-2d-m6-performance-3b6a4f3c9b.json)
  - 历史候选 `68af105c8d` 记录了 Windows Release 六对和 Web 12 项负载。混合变更帧 CPU、JSB、JS 堆峰值与强制 GC 中位数分别下降 59.3%、77.5%、41.7% 和 1.8%。两端 29 份场景与启动资源逐字节一致。[实测数据](./native-2d-m6-performance-68af105c8d.json)
  - [x] `76b9679ae9` 对迁移前 `7e83734299` 与 Web 完成三轮交错复测。混合变更帧 CPU 下降 56.8%，JSB 下降 77.5%，JS 堆峰值下降 43.0%。每轮每场景每阶段执行一次强制 GC，该负载的中位数由 6.465 升至 10.744 ms。纯 Sprite 静止和改色的 CPU 仍高于迁移前。[逐轮结果](./native-2d-m6-performance-76b9679ae9.json)
  - [x] Windows Release 的六轮 V8 诊断记录了 144 次强制主回收。混合变更帧的调用耗时中位数为 7.996 → 8.152 ms，V8 主回收中位数为 7.989 → 8.142 ms。候选在三轮上升、三轮下降，普通 Windows 与 Web 的 12 项负载均通过。GC 性能 Gate 继续待签收。[诊断数据](./native-2d-m6-gc-trace.json)
  - [x] 同一对无诊断 Windows Release 二进制追加六轮交错。混合变更的 CPU、JSB、JS 堆峰值分别下降 50.8%、77.5%、42.9%，强制 GC 中位数为 10.255 → 10.169 ms。计入此前三轮后，GC 中位数为 9.755 → 10.536 ms，九对样本仅三对改善，性能 Gate 保持待签收。[无诊断复测](./native-2d-m6-gc-repeat.json)
  - [x] Win32 Canvas 在透明目标或不透明源完全覆盖时直接写入 RGBA。三轮混合变更帧中位数从 4.8806 降至 4.1284 ms，两个 Windows 配置通过像素与句柄回归。[测量结果](./native-2d-m6-canvas-fill-performance.json)
  - [x] Windows Label 用测量上下文直接绘字。Debug/Release 通过重复重绘、GDI 句柄与图像回归。Release 混合变更帧从改动前的 4.5218 降至 3.8502 ms，同轮迁移前为 4.5154 ms。[测量方法及各负载结果](./native-2d-m6-performance.md)
  - [x] 从完整候选 `211c790b7d` 重建 Windows Release，与迁移前和绘字隔离版本三轮交错对跑。Web 同版本完成 12 组负载。混合变更帧为 4.0039 ms，较迁移前下降 8.1%，CPU 门禁仍开放。[分段与逐轮证据](./native-2d-m6-performance.md)
  - [x] 六轮交错比较迁移前、移除 Label 覆盖扫描前后。混合变更帧从迁移前的 4.7116 降至 3.4639 ms，下降 26.5%。50% 门槛为 2.3558 ms，尚差 1.1081 ms/帧。[六轮逐项数据](./native-2d-m6-label-coverage-performance.json)
  - [x] 在 2df0c7bfd9 复测迁移前和当前 Windows Release，加入当前版本的分段计时构建。六种启动顺序下，混合变更帧均有 24 次字体栅格化。绘字占栅格化耗时的 53%–57%，布局占 27%–30%；普通计时 CPU 降幅为 26.5%，50% Gate 仍未通过。[数据与计时边界](./native-2d-m6-performance.md#当前候选的字体准备耗时)
  - [x] Windows GDI 在相同字体和文本下复用上一次测量，切换字体或恢复 DC 时清空。六轮交错实测，混合变更帧中位数为迁移前 5.1198、改动前 4.2558、候选 3.9670 ms/帧，候选在三轮逐对更快。CPU Gate 仍待签收。[逐轮证据与微基准](./native-2d-m6-gdi-measure-performance.json)
  - [x] 同帧单行 Label 复用。固定混合变更帧六轮中位数的 CPU 下降 61.8%，JSB 次数下降 77.5%，JS 堆峰值下降 43.2%，强制 GC 从 6.5685 降至 4.6475 ms。每帧 24 次请求命中 22 次，独立文本负载每帧零命中。[性能和逐像素验证](./native-2d-m6-performance.md#windows-同帧复用单行-label-的栅格像素)
- [x] 本机 M0 薄壳检查覆盖 Native override、TS 帧方法、渲染数据分配和热路径依赖。UIRenderer、LabelOutline、LabelShadow 沿用共享实现，其 2D 依赖也纳入审计。
- [x] Windows Debug/Release 各完成 14 组场景的创建、稳态、显式 API、同步变更、下一帧、禁用、启用和延迟销毁统计。224 个窗口逐个校验 V8 原生总数；两种配置的迁移类直接调用数逐格一致，稳态为 0，共享 manager 每帧 1 次。[逐组计数与覆盖边界](./native-2d-m6.0-windows-jsb-trace.md)
- [x] 六种独立资产的创建、同步属性变更、destroy 与三帧延迟清理，在 Windows Debug/Release 共 48 个窗口通过 V8 总数校验；记录 TTF 数据释放、位图字体帧解绑和共享资源存活。[逐资产调用与边界](./native-2d-m6.0-windows-jsb-trace.md)
- [x] 迁移组件稳态每帧 JSB 调用 0；属性变更、生命周期和用户显式 API 调用单独统计。
  - Label 的序列化访问器及字体、材质、CHAR 引用桥接在 TS；排版、几何、字形栅格化与上传由原生 Label 完成。RichText 在 TS 保存序列化数据和触摸监听，命中后先保存原生返回的回调名与参数，再遍历命中段与组件派发事件；解析、排版和命中测试由原生执行。两壳的逐帧渲染方法和渲染缓冲分配已纳入静态检查，33 项通过。Web RichText 和两个原生壳的 3 组 Jest 共 15 项通过。调用与配置证据见[组件](./native-2d-m6-jsb-lifecycle.json)、[资产](./native-2d-m6-jsb-assets.json)。本项覆盖薄壳约束，独立的组件行为与字体视觉门禁继续验收。
- [x] 17 个迁移或保留类的 2D 运行时导入闭包由本机薄壳检查覆盖。Windows Debug 部署包逐块匹配 SHA256，78 个 2D 模块中 55 个产生代码，Web Sprite、Label assembler 和 Graphics WebGL 实现均为 0 字节。公共 utils 入口仍导出 html-text-parser（13308 字节）和 text-utils（13330 字节），17 类的 2D 内部依赖链均未导入它们。部署 cc.js 为 `4702081743c4e25996b2815a2ba2266a510c68133e2e2ef260ca03e921b226d5`。源码检查 13 项与审计测试 6 项通过。闭包边界外的回流与实际每帧调用仍待验证。
- [x] 完成当前 Native 2D 功能包的薄壳和间接路径验收。17 类静态基线、43 项薄壳、Native TS、18 套件／119 项 Native 断言、完整工程双配置、84 个 2D 部署模块及 35 条边界导入核对通过；双配置共 272 个调用窗口通过 V8 总数校验，迁移类稳态直接调用为 0。本项限定当前功能包和列明场景，不替代其余 API 与生命周期门禁。[本轮证据](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md)
  - [x] 本机 Release 功能组合检查所有 Rollup 输出 chunk 的 Web assembler 保留字节数。Windows 9 个组合均为 0；Web 的 8 个 2D 组合保留 159767 或 195159 字节。把真实 Web 全量报告交给 Windows 检查器会报错，测试还覆盖仅在异步 chunk 中保留的 assembler。本机 native TS、Web TS、198 组 Web Jest 和 Windows 双配置各六组 JSB 探针通过。[18 个构建结果](./native-2d-m6-feature-matrix.json)
  - [x] 已对 14 个迁移类逐一检查 native override、TS 帧方法和渲染数据分配。本机薄壳检查 57 项通过。在内存中的 SpriteAtlas 源码加入 `lateUpdate` 和 `new Float32Array` 后，两种违规均被检出。
  - [x] 薄壳帧方法检查覆盖 JSB 原型赋值、类字段和字符串字面量方法名。[回归用例](../tests/scripts/native-2d-audit.test.cjs)在旧检查器上漏报四个钩子，修改后按源码顺序检出全部四个，读取、比较和调用已有方法均通过检查。
  - [x] 本机 Windows Debug/Release 运行 Chrome 同字体对照。正体和斜体 72 项在本机均通过，修复前程序触发其中 27 项失败。报告同时记录 36 项合成粗体结果。
  - [x] 本机独立检查 Thonburi 合成粗体 I。四个字号各 64 个分数起点，本机 Debug 和 Release 各有 256 张字形与 Chrome 逐字节一致。关闭边缘量化和矩形覆盖处理的负例有 256 张不同，检查以失败退出。每种配置归档按字号的哈希、通过数及最大 alpha 差。[检查入口](../native/tests/2d-poc/compare-ttf-origins.cjs)
  - [x] SIMPLE Sprite 的[四边形对照](../native/tests/2d-poc/run-sprite-quad-parity.ps1)读取 Web assembler 实际写入的 UV 和索引区间，并按各端提交的索引栅格化。Windows Debug/Release 对 Web 各 13 项通过，100×100 图像逐像素一致。将 Web 索引全部置零会产生 10000 个差异像素；单独颠倒绕序或改变 UV，即使纯色图像相同也会判为失败。
  - 本机单独运行位图字体布局和径向 Sprite 的 C++/Web assembler 对照，2327 个布局和 3024 个几何用例通过；Windows 完整应用矩阵另行验收。
  - [x] 本机分别构建 Windows Debug/Release 引擎、生成 SWIG 绑定并运行[六组 JSB 用例](../native/tests/2d-poc/run-windows-jsb-probes.ps1)，覆盖 renderer manager、Sprite API、SpriteAtlas、字体资产、布局和 RichText。每次运行同时检查场景记录的节点挂接。两种配置均在本机从空目录编译通过，六组用例与 SIMPLE Sprite 对 Web 的 13 项检查全部通过。Web 全量检查通过 TypeScript 编译和 197 组 Jest（1467 项通过、8 项跳过、16 项待实现），native TS 编译通过。完整应用场景仍待签收。
  - 历史候选 `68af105c8d` 的 Windows Debug、Release 完整原生测试各通过 3 次，每次完成 1000 轮字体别名生命周期。字体资产、布局、RichText、Sprite API、SpriteAtlas 和 Graphics 几何的脚本均从构建子目录启动通过。Web 和 native TypeScript、全量 1480 项 Jest 和 57 项薄壳检查通过。[本机复测数据](./native-2d-m6-label-ttf-canvas-size.json)
- 历史记录 `68af105c8d` 包含当时的组件级 TS 回退与恢复。最终候选验收使用默认 Native 实现，现有 Web 结果仅作可选参考。[历史快照与部署包指纹](./native-2d-m6-candidate-recheck.json)
- [x] Windows M6 汇总已链接候选、实际门槛、修复前失败、双配置日志和像素产物。[本轮签收](./native-2d-m6-gate.md#windows-m6-behavior)

交付：性能报告、默认 Native 验收记录、M6 Gate。原计划 4–5 周是早期估算，未包含当前列出的全部 M4/M5 终态欠项；完成 M6.0 后重新排期。

## 3. 终态验收标准

| 门禁 | 必须满足 | 不足以判定通过的证据 |
|---|---|---|
| 范围与 API | 用户脚本调用各组件现行公开接口的行为符合预期（排除兼容接口和已弃用接口），并验证现行格式的场景、Prefab 和资产 | 仅 smoke 或方法存在 |
| 薄壳 | 元数据/序列化、生命周期、API/事件桥接；无 UV/几何、文本/HTML、材质选择算法或第二份权威状态 | 仅检查 prototype 形态 |
| 原生热路径 | native 准备、几何/文本/材质与提交闭环，稳态每帧 JSB 0 次 | JS 调用 native，但仍在 JS 逐段布局 |
| 视觉与事件 | JSB／Native 按已确认的夹具期望和基准图像检查布局、字形、渲染可见性及事件序列，Sprite/Graphics 图像比较沿用通道容差 1 | colored 非零、面积或 ±20% sanity 单项 |
| 图形完整性 | Graphics 三角化/GPU 提交和描边语义，Mask 混合/嵌套/恢复正确 | 256×256 兼容光栅化探针 |
| 性能 | 上述 ≥50% CPU、≥70% JSB、≥30% JS 堆目标及 GC 数据 | M2 ≥30% 阶段 KPI 或单一空闲场景 |
| 稳定性与平台 | 1000 次加载卸载、无新增泄漏/崩溃、线程边界、Windows Debug/Release 矩阵，另列暂缓平台 | 仅单个配置的功能通过 |
| 工具链 | 绑定/元数据可复现、本机裁剪组合通过、默认 Native 入口验证 | 手工补元数据后本机可运行 |

全部阻断项通过后才能将 M6 和整个 Native 2D 下沉标为终态完成。任何新增容差或范围豁免必须明确记录用例、影响和决策；尚未确认的差异继续列为待处理。

## 4. 当前范围

- SpriteRenderer 及 ModelRenderer 的实现、JSB 薄壳和相关验收均移出本期，相关原始结果归档于历史报告。
- JS Component 身份、生命周期调度、注册和序列化保留；完整 Component 下沉不进入 M6，参见[评估结论](./native-2d-m6-component-eval.md)。
- `cocos/ui` 不迁移；Canvas/Camera/Widget/View、UIMeshRenderer/UIMesh/UISkew 保持 JS；弃用的 UIStaticBatch 不实现。
- 现有 Web 实现退出本次迁移验收。Native 差异通过现有 JSB override 和 Native 实现承接，后续门禁聚焦 JSB／Native。
