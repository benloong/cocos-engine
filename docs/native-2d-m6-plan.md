# Native 2D M6 剩余任务与终态验收

> 更新：2026-11-18。范围沿用[总计划](./native-2d-module-sinking-plan.zh-CN.md)，仅 `cocos/2d` 及必要的 native/绑定/构建支持。
> 状态：**未收口**。M2、M3、M4、M5 的阶段通过记录不代表整个模块满足终态薄壳契约。SpriteFrame 数据/UV、SpriteAtlas map/native 表已有 Windows 定向证据，不代表全平台、完整资源场景或性能 KPI 通过。
> 本文是 M6 剩余任务与终态门禁的统一清单；历史数据保留在各阶段 report/gate 中。
> 所有权约束：M6 原生 2D 代码禁止 shared_ptr/weak_ptr。值成员、unique_ptr、IntrusivePtr 与非 owning 指针分别标明拥有者；借用者必须在拥有者销毁前解绑或收到同步失效通知。
> 构建验收约束：后续改动统一按 [Cocos CLI 构建与验收流程](./native-2d-build-and-acceptance.zh-CN.md) 第 8 节构建 cocos-m1-test、重建 override、同步资源、编译 Debug app 并执行全部门禁，通过后再提交。定向 PoC/GPU/ASAN 仅作补充证据；不得替代文档规定的测试工程验收。

> 本轮验收平台为 Windows Debug/Release，使用 Web 作行为与像素对照。macOS、iOS、Android、OHOS 暂缓验收，保留待验证状态。

## 1. 已有基础与验收边界

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
- [x] 新增 2D 元数据维护入口：仓库内脚本从六个 Web 资产声明生成补丁，由 native-binding/decorators 重导出；补齐产物检查、生成器/元数据测试与 native-ts-build CI。组件壳使用源码装饰器；历史外部生成器归属未推断，见 [维护说明](./native-2d-m6.0-metadata.md)。

交付：组件矩阵、残留清单、基线版本/环境/命令和原始数据。

### M6.1 资产与状态一致性

- [x] Label 序列化基础兼容：恢复 Web 的字体/系统字体字段、样式/效果/24 个默认值，补旧格式 deserialize/Details 回填与 instantiate 回归；初始化样式传给 native，普通 TTF 下划线厚度与实际字号通过 Windows Debug/Release 联调，见 [报告](./native-2d-m6.1-label-serialization.md)。
- [x] Sprite 壳声明与基础材质/状态兼容：六个缺口、fillRange 默认值/条形负范围、atlas/trim/grayscale/事件、native 材质变体与真正 MaterialInstance、帧/材质持有、尺寸/Node 变化和零填充清理已补，Windows Debug/Release 实际 JSB 与定向测试通过，见 [报告](./native-2d-m6.1-sprite-api.md)。
- [x] Sprite radial 与可变 fillCenter：归一化中心、角度方向、矩形边界三角形、rotated UV 和 flip 行为已修复；fillCenter 分量读写直接桥接 native，加载/克隆/销毁保持视图契约。3024 组实际 Web assembler 与 native CPU 几何对照、Windows Debug/Release 定向测试通过，见 [报告](./native-2d-m6.1-radial.md)。
- [x] Sprite/Label 材质槽 API 与提交：补数组整体赋值/缩短/清空、加载前引用、forceUpdate、实例 owner 解绑；native 区分显式空槽和恢复内置材质，Label 实际 DrawInfo 跟随槽和实例变化。Windows Debug/Release、实际 JSB 与 Web 定向对照通过，见 [报告](./native-2d-m6.1-material-slots.md)。
- [x] Label 的兼容 getter `_bmFontOriginalSize` 读取当前 BitmapFont 资产的字号，并覆盖未设置字体、字号修改和切换非位图字体的 Web/JSB 薄壳对照。见 [Label 回归](../tests/ui/native-2d-m3-label-shell.test.ts)。
- [x] Label.actualFontSize 保留 JS 手动写入的小数精度。Windows Debug/Release 实际 JSB 验证在干净帧保留 14.123456789，重新排版后恢复为 16。Windows 两种配置和 Web 的真实场景均精确读到位图字体在高度 0.25 下的 SHRINK 最小字号 0.1；每个 Windows 配置的 85 张图与 Web 逐字节一致。[场景及像素结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label.updateRenderData(force) 保留布局约束。相同两行文本在 Windows Debug、Release 和 Web 下分别验证普通与强制刷新。CLAMP/SHRINK 保持 72×80，RESIZE_HEIGHT 保持宽度 72 并换行至高度 65.2，NONE 同步返回自然尺寸。NONE 的自然宽度 Windows 为 79、Web 为 80.9453125，字体度量差异仍在复杂布局中跟踪。[逐配置布局与像素回归](./native-2d-m6-windows-web-gpu-results.json)。
- [x] 普通栅格 Label 在 SHRINK 模式下保留配置字号，分别按换行后的高度或未换行文本的宽高求实际字号。Windows Debug、Release 和 Web 在 32 号 Arial 的缩小、放大、再次缩小中得到相同读数：关闭换行 8/32/8，开启换行 8/33/8，单行宽度从 26 增至 200 时为 7/32。33 来自 Web 换行搜索的上界。见 [字号矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的材质数组原地编辑通过 Windows Debug、Release 和 Web 真实场景验证。保留数组引用后覆盖、截短、push、splice、delete，以及写空实例槽，均核对共享槽和实际使用材质。JSB 探针另查原生槽引用，定向测试覆盖加载前修改、销毁后写入。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的实际 shader 重编译回调。场景为每个组件的第 1 号实例槽切换 `USE_TEXTURE`，检查材质 hash 变化和恢复、两次有效切换的 owner 回调参数，以及相同宏重复设置时的通知次数。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Sprite、Label 和 Graphics 的材质生命周期。传回同一共享材质保留实例；强制刷新和替换共享材质立即清空旧实例的 passes。组件持有共享材质期间显式销毁，核对两次 destroy 的返回值、帧内严格与普通有效性、帧末失效及槽位引用身份。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label._canvasPool 显式兼容入口。Web 和 native 使用同一画布池实现，借出两个独立画布、测量文字、归还后获取相同上下文及字体状态在 Web、Windows Debug/Release 均通过，三端 85 张图像逐字节一致。Windows 部署 cc.js 哈希为 `45073de1a593f50274e1a5dd88e8103681b97a42b0afba6821106fcc8864594e`，画布池模块贡献 990 字节，Web Label assembler 未进入部署包。完整串行验收与 23 项定向 Jest 通过。[GPU 快照与配置](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label 启用时恢复字体。无字体资产且关闭系统字体时，按 Web 行为恢复系统字体；系统字体族为空时恢复 Arial。已配置的字体族和有效字体资产保留。修复前定向用例复现 useSystemFont 仍为 false，修复后 6 项 Label 契约测试通过。Web 与 Windows Debug/Release 实际场景验证重新启用及保留 Verdana，85 张图像逐字节一致，标准工程串行门禁通过。[当前快照与像素结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] Sprite 和 Label 的 JSB 壳继承 UIRenderer.color。编辑器改色在同步原生颜色后派发一次 COLOR_CHANGED，监听器收到独立副本；运行时改色和重复赋相同值的事件数均为 0。Web 类和 JSB 壳的编辑器/运行时契约由[定向测试](../tests/ui/native-2d-m3-label-shell.test.ts)覆盖，三端运行时赋值由[实际场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)覆盖。
- [ ] 完整组件 parity：Label 其余公开/兼容接口，以及真实场景/Prefab 和资源管线继续验收。radial CPU 几何通过不替代 GPU 像素验收。
  - [x] 原生栅格 Label 按 Web 的 overflow 决定是否自动换行。NONE 按显式换行分段，RESIZE_HEIGHT 即使关闭 enableWrapText 也按节点宽度换行。48 像素宽、多行文本在 Web 与 Windows Debug/Release 切换开关后均保持原有高度，85 张图像逐字节相同。[场景与像素对照](./native-2d-m6-windows-web-gpu-results.json)
- [x] Label 运行时字体切换：从位图字体切回系统字体会清空字体资产；再次关闭系统字体、向空槽写入 null 均保留空槽。显式重新指定 BitmapFont 后立即读取到单个 A 字形宽度 16，且混合遮罩场景中的绿色字形正常绘制。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.contentWidth：实际 JSB 验证初值为 0，加载前写入的小数保留精度。Windows Debug、Release 和 Web 的 TTF 在四种 overflow 下发布各自的节点宽度，强制更新覆盖手动赋值；干净帧刷新、BMFont 和 CHAR 更新保留手动值。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.fontAtlas：位图字体场景读取旧接口的初值 null，赋入字体资产的 FontAtlas 后，重复赋同一字体和强制布局均保留该对象。切换到系统字体后引用清空。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.ttfSpriteFrame：启用系统字体 Label 后即可读取带纹理的 SpriteFrame。进入 CHAR 后保留原 TTF 帧，退出 CHAR 后立即发布新的 TTF 帧；组件销毁后新帧和纹理均失效。Windows Debug、Release 和 Web 完成同组场景验证。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] Label.spriteFrame 在系统 TTF、BMFont、CHAR 下分别返回 TTF 帧、字体资产帧和共享字形纹理。两个字号、颜色不同的 Label 读取同一 1024×1024 CHAR 纹理，GPU 回读包含第二个 Label 新增的绿色字形；第一个退出 CHAR 后另一个仍持有有效纹理。Windows Debug、Release 与 Web 运行同一场景。[GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。

- [x] SpriteFrame 基础数据/算法：quad/sliced UV 迁入 native；rotated、flip、insets、pivot、meshType、packable、clone/reset 与基础静态 API 已补实现，UV 对照与 Windows 定向回归通过，见 [报告](./native-2d-m6.1-sprite-frame.md)。
- [x] SpriteFrame 基础状态：rect/offset/originalSize/pivot 使用 native 可写视图；setter、分量修改、反序列化、克隆和 native 回读不再依赖 JS 权威镜像，Sprite/Mask/BMFont 有原生消费者联动测试。
- [x] SpriteFrame 已序列化 vertices 的读写与克隆。非居中 pivot、非零 Z 的三角形在 Windows Debug/Release JSB 与 Web 实现中得到相同坐标，薄壳回归核对索引、UV、边界及克隆后的独立修改。
- [x] SpriteFrame.mesh 与 ensureMeshData()：按需创建、重复访问、独立克隆、换纹理重建和空多边形。Windows Debug/Release 读取真实 Mesh 的顶点、UV、索引，与 Web 实现使用相同的期望值。
- [x] SpriteFrame 场景验收。已有序列化场景加载静态图集 Prefab，Sprite 绘制原帧，SpriteRenderer 接着绘制原帧和旋转裁剪帧的网格。固定使用导入的静态图集；动态合图按下方独立平台用例验收。Windows Debug、Release 各 85 张图与 Web 逐字节一致，见 [GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)。
- [x] SpriteAtlas 表同步：可观察 map 的整体赋值/修改、同名替换、null、remove/clear、Details 依赖回填与 getTexture 顺序已同步到 native；迟到回填隔离、原生引用持有/释放和 Windows 实际 JSB 壳联调通过，见 [报告与写入契约](./native-2d-m6.1-sprite-atlas.md)。真实资源/场景加载仍归下方独立验收项。
- [x] Windows Debug 真实 JSB 应用验证 SpriteFrame、SpriteAtlas 的构造身份、Asset 初始化、ccclass 注册、图集序列化属性及实例隔离。两组实例交替查询原生纹理、写入帧表、改变旋转并检查 UV 回调的发送者与次数。与既有依赖回填及原生方法接收者探针一同通过第 8 节门禁。夹具见 [StaticAtlasProbe](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)，日志见 `native/tests/2d-poc/build/m6-prototype-*.log`。
- [x] TTFFont/LabelAtlas/BitmapFont 基础数据与生命周期：原生持有 TTF 字节/family/source、BMFont 配置/glyph/kerning/SpriteFrame；Label 直接持有字体资产并检测 revision，移除逐字形 JSB 传输；切换/清空/销毁、共享引用、实际 JSB 壳及 Windows Debug/Release 定向验证通过。补齐 deserialize/Details 依赖回填，修复 null 默认值 family 在快速反序列化中被当作对象，JIT/非 JIT 回归通过，见 [报告与边界](./native-2d-m6.1-font-assets.md)。
- [x] 字体重载一致性补充：独立配置版本使同内容原生重载失效旧 JS 视图，同时保留依赖回填期间的编辑；released 后忽略迟到 onLoaded。Windows Debug/Release C++ 与实际 JSB 探针、7 个 Jest suite（58 项）通过，见字体资产报告。
- [x] 字体重复生命周期补充：released 后的 JS 配置/TTF 加载赋值直接忽略；三类字体各 1000 次 native 创建、清空、重载、销毁，以及 BitmapFont/LabelAtlas 各 1000 次实际 JSB 循环通过 Windows Debug/Release。当时字体测试入口为 7 个 suite、64 项，后续新增测试见字体资产报告；直接创建资产的循环不替代 asset-manager 加载卸载或泄漏验收。
- [x] Windows 自定义字体选择：GDI 拒绝真实 Thonburi.ttf 后回退，现以私有 DirectWrite collection 加载、shaping 和绘制；明确 COM/缓冲区所有权，Debug/Release 各 1000 次释放计数及 64 项 Jest、ASAN 应用通过。该节点 RichText 当时为 9/12 布局一致、严格图像 0/12，见 [报告与未关闭门禁](./native-2d-m6.1-directwrite-fonts.md)。
- [ ] 字体终态验收：真实字体资源/旧场景/Prefab、完整资源加载释放、跨平台 alias/字体句柄与注册表清理、复杂文本和 GPU 对照。TTF 原生字节已持有，渲染仍使用现有 Canvas 平台后端，基础数据通过不替代这些验收。
- [x] Windows 字体注册表补充：修复单参越界、同 alias 重载不替换和无效绝对路径误注册；脚本引擎 cleanup 释放表。Debug/Release 实际 JSB、1000 次同名重载和临时字体文件释放回归通过。本节点仅覆盖 runtime 清理，逐资产机制见下一项，跨平台仍归字体终态项，见 [报告](./native-2d-m6.1-font-registry.md)。
- [x] 已创建的 Windows Canvas 在字体注册、同名替换、释放和恢复后重新选择字形。相同 Canvas 上，Thonburi 与 Open Sans 的测宽在 Windows Debug、Release 和 Chrome 分别为 95.9765625 和 101.9296875；释放最后一个资产后恢复各自的回退宽度。Windows 另验证首个填充、描边与新建上下文逐字节一致。[回归数据与可执行文件哈希](./native-2d-m6-canvas-font-alias.json)
- [x] Win32 GDI 字体回退支持超出 LOGFONT 名称长度的 CSS 别名。Windows 双配置与 Web 使用 45 字符名称完成注册、替换与释放；Windows 各执行 32 次无效文件回退并核对 GDI 对象数。用系统位图字体 8514fix.fon 实测进程私有注册和 Canvas 析构后的释放。[逐配置结果](./native-2d-m6-canvas-font-alias.json)
- [x] Windows TTFFont 逐资产 alias：native 记录明确持有者与来源代次，独立渲染身份隔离同名换源；共享释放、最后持有者清理、两种换源销毁顺序及迟到释放通过。Debug/Release 各 1000 轮 native/实际 JSB、49 项 Jest、10 项静态检查与同快照真实加载/释放、ASAN 应用通过；严格图像仍 9/12，完整异步/跨平台仍待验收，见 [实现与边界](./native-2d-m6.1-font-alias-ownership.md)。
- [x] 字体工厂失败回滚：native 空字节/赋值异常销毁半成品并回调错误，Factory 同步异常清理等待队列、支持同 ID 重试并隔离旧回调；16 个 suite、120 项和 Debug/Release 实际 JSB 故障探针通过。创建前无主 alias、完整异步下载与跨平台仍待验收，见 [报告](./native-2d-m6.1-font-factory-failure.md)。
- [x] Windows 本地 TTFFont 真实资源循环：Debug 普通/ASAN 应用各 1000 次 loadRemote/releaseAsset 与缓存身份检查，逐轮字节/alias/缓存恢复、失败回滚与同 URL 重试、缺失源拒绝和最终延迟销毁通过；当前源码完整引擎 JS 重建，图像仍 9/12。长期 heap、HTTP/bundle、BMFont/LabelAtlas 与跨平台仍待验收，见 [证据](./native-2d-m6.1-font-remote-lifecycle.md)。
- [x] HTTP 字体缓存来源修复：保留资产 URL，onLoaded 从已下载缓存/临时文件读取 native 字节；缓存换源与 released 回调测试通过。按统一文档构建测试工程并执行基础门禁，旧 M4/M5 探针迁移到真实 GPU/原生段观测；历史 HTTP/ASAN 补充证据及 HTTPS、取消、半文件、无主 alias 等剩余边界见 [报告](./native-2d-m6.1-font-http.md)。
- [x] 字体数据边界补充：BitmapFont/LabelAtlas 拒绝溢出 float、非法 glyph/kerning 与重复字形，失败保留 native 数据、版本和 JS 编辑视图；TTFFont 销毁后 initDefault 不再改写状态。Windows Debug/Release native 与实际 JSB 定向回归通过，见 [字体资产报告](./native-2d-m6.1-font-assets.md)。
- [x] 字体字号入口复核：BitmapFont/LabelAtlas 忽略非有限字号及 JSB float 溢出，保留默认/零/小数语义；重复赋值、销毁后迟到赋值保持版本稳定。Windows Debug/Release native 与实际 JSB、7 个 Jest suite（68 项）通过，见字体资产报告。
- [x] SpriteFrame 动态合图状态：native 持有原图/图集与恢复坐标，打包/恢复、独立 clone、覆盖与析构所有权通过 1000 次循环和实际 JSB；补内存图片 buffer 上传及 Web Mask 默认阈值同步。文档工程各门禁最后执行通过，12/12 Web/native RGBA 字节相同；M5 标记可见性已由后续日志节点修复；自动打包、完整资源/生命周期与平台范围仍待验收，见 [报告](./native-2d-m6.1-dynamic-atlas.md)和[日志观测](./native-2d-m6.4-log-observability.md)。
- [x] BitmapFont/LabelAtlas GPU 图集消费者：原生字形 quad 直接采样活动图集，移除整段 CPU 纹理合成；帧 revision、纹理尺寸/同尺寸 GPU 重建、sampler 变化与清空引用回归通过。真实 Windows Debug 工程覆盖两类字体、普通/旋转帧的原图/打包/恢复，并验证 70000 字形分块；证据与布局边界见[报告](./native-2d-m6.1-bitmap-gpu.md)。
- [x] BitmapFont/LabelAtlas 基础原生布局：修复默认 CENTER/CENTER，统一字号/源字号缩放、spacing、词/CJK 换行、九种对齐与四种 overflow/裁剪、无换行测量和尺寸更新；2307 组实际 Web 数值对照在 g++/MSVC 通过，含 kerning 的 76 组布局 GPU 与 12 组默认居中合图图像全部字节一致，文档完整串行门禁通过，见[布局报告](./native-2d-m6.1-bitmap-layout.md)。
- [x] BMFont/LabelAtlas 配置源字号：与公共 fontSize 元数据分离，配置重载按 revision 自动更新 Label，原子校验/清空、缺字段兼容回退及非正源字号空测量/空提交回归通过；76 组布局使用公共字号 64、源字号 16/32/8，100 组 GPU 图像均字节一致，完整文档门禁通过，见[源字号报告](./native-2d-m6.1-bitmap-source-size.md)。
- [x] BMFont/LabelAtlas 帧转换：2307 组 Web 帧矩形、顶点位置和 UV 对照通过，真实 GPU 覆盖非零帧原点、trim/offset 和旋转组合。原生 UI 批次持有 IA 和使用的缓冲区直至清理，确定性回归和完整工程门禁通过，见[帧转换报告](./native-2d-m6.1-bitmap-frame.md)。
- [ ] 字体复杂布局与资产边界：补充平面 BMFont 标量字形通过 2327 个 Web/native 布局对照，Windows Debug/Release 的四种字体/旋转组合与 Web 逐像素相等，见[捕获](./native-2d-m6-bitmap-unicode.json)。bidi/shaping、任意 mesh 和其余 packed 帧状态组合、其余字体配置/元数据动态入口，以及真实旧资产/场景/Prefab 和资源生命周期矩阵继续验收；基础布局通过不关闭字体终态项。
- [x] 动态图集入口回退：拒绝不可上传的来源，满页失败保留剩余空间，同源帧复用已有页。定向 Jest 和真实 Windows Debug/Web 回退探针通过，100 份 RGBA 逐字节一致，见[回退报告](./native-2d-m6.1-atlas-fallback.md)。
- [x] 动态图集帧所有权：删除单帧保留共享源，打包克隆随页跟踪，删除源纹理与重置先恢复帧后释放页。真实 Windows Debug/Web 探针和 100 份 RGBA 对照通过，见[所有权报告](./native-2d-m6.1-atlas-lifecycle.md)。
- [x] 原生组件事件触发自动合图曾在 Windows Debug 与 Web 通过。该实现是禁用前的历史基线，见[触发报告](./native-2d-m6.1-atlas-automatic.md)。
- [x] JSB + Native 暂停运行时动态图集。Windows Debug 验证显式启用、插入、打包和重置均保持原图，Web 自动打包与恢复通过。完整门禁、37 项定向 Jest 和 100 组像素对照通过，见[验收记录](./native-2d-m6.1-atlas-automatic.md#jsb--native-暂停运行时合图)。
- [x] 2026-11-18 确认运行时动态合图终态。JSB + Native 保持禁用，组件和 manager 的显式启用、插入、打包、重置均维持原图；Web 保持启用能力。Windows Debug 完整工程与 Web 重建实测通过，覆盖 Web 回退、自动打包、共享帧恢复及 Sprite/Mask、BitmapFont/LabelAtlas 共 100 组原始像素对照。旧的 Native 自动打包记录留作历史基线。
  - [x] 系统字体 Label 的 CacheMode.BITMAP 遵循同一平台开关。96c37f626f 的 Windows 双 Label 用例在 manager 关闭时仍读到共享纹理。移除独立原生图集后，Windows Debug/Release 实际提交各自的完整源纹理，显式开启 manager 和重绘均保留源纹理。Web 关闭时使用两张源纹理，开启后两帧进入同一图集并保留各自原图。三端重绘前后的红绿字形最大通道差均在 1 以内，两种 Windows 配置各有 92 组位图字体图像与 Web 逐字节相同。[跨平台场景](../native/tests/2d-poc/fixtures/acceptance/BitmapGpuProbe.ts)、[提交纹理检查](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)。
- [x] 旧格式静态图集和 Prefab：Windows Debug/Web 实际加载 TexturePacker plist、PNG 和序列化 Prefab，通过三个加载释放循环、两个独立实例、红绿 GPU 换帧、缓存清理和独立图集持有检查。见[验收报告](./native-2d-m6.1-sprite-atlas.md#5-真实资源和-prefab)。
- [x] SpriteAtlas 帧末释放原生帧表：分别覆盖 C++ 和 JSB 销毁队列，拒绝迟到写入，Debug/Release 1000 轮引用计数复归。真实 Prefab 保留 wrapper 的释放断言和连续文档门禁通过。见[所有权验收](./native-2d-m6.1-sprite-atlas.md#6-原生帧引用随延迟销毁释放)。
- [x] SpriteFrame 帧末归还当前纹理和原图。C++ 与 JSB 的销毁队列共用清理入口，迟到依赖不能重新绑定。Debug/Release 各 1000 轮和 Windows Debug 真实资产释放、完整串行门禁及像素对照通过。见[验收报告](./native-2d-m6.1-sprite-frame.md#帧末归还纹理引用)。
- [ ] 补其余旧资产和场景、异步取消与延迟依赖、clone、跨场景重复加载释放及长期生命周期。
  - [x] 旧静态图集 Prefab 的旋转帧克隆在原 Prefab、图集和原帧释放后继续渲染。运行时显式持有导入纹理，重新加载同一 Prefab 后，新节点解析到新图集并复用该纹理。Windows Debug、Release 和 Web 的中心像素依次为绿、绿、红、绿。销毁克隆并释放最后一个纹理引用后，纹理失效且缓存中已无该 UUID。[真实加载、回读与释放用例](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)

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
- [ ] 完成上述原生路径的终态 API、布局、场景、视觉与用户事件回归；资源/极限对象生命周期和完整 Node wrapper 联调继续验收。
- [ ] 将现有 color/b/i/u、size/br/outline、img/imageAtlas、contentSize、hit/miss 用例迁为固定 Web/native 回归；补 shadow、嵌套样式、复杂对齐/最大宽度、动态更新、点击事件分发与销毁后解绑。
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
- [x] Windows Debug、Release 和 Web 完成 Graphics/Mask 创建、静止和变更测量。32 个矩形在单组件与 32 个组件中分别产生 1、32 个批次，单层与双层 Mask 分别产生 3、5 个批次。三端以 4096 字节纹理上传校准计数，覆盖全部 189 个采样窗口。[成本与复现](./native-2d-m6.3-graphics-cost.md)

交付：M4.3 补充报告、像素对照与性能结论。兼容光栅化基础通过不等于本项完成。

### M6.4 事件、生命周期与硬化

- [x] 原生命中基础链路：Mask.isHit 仅传世界坐标；原生计算圆角/椭圆/反向边界，UITransform 筛选 Camera windowId/layer/离屏并查询当前祖先 Mask。Windows Debug/Release 绑定及生命周期回归、真实场景 19/19 命中检查通过，含 disable/reparent/destroy；见状态与命中报告。完整事件/多 root/Camera/平台矩阵仍由下一项验收。
- [x] hit test：Windows Debug、Release 与 Web 的 22 项命中检查一致。覆盖屏幕 Camera、窗口和层过滤、旋转与非均匀缩放、跨 root 重挂、嵌套 Mask、启停及销毁。[逐项结果](./native-2d-m6-windows-web-gpu-results.json)
- [x] RenderRoot2D 在 Windows Debug、Release 和 Web 通过多 root/Canvas/Camera 回归。11 个注册状态断言覆盖重复启用、禁用、重排、销毁；场景切换 1000 次、4998 项循环断言通过。不同注册/优先级、目标切换和跨场景常驻 root 的 GPU 中心颜色按预期变化。比较器检查命名捕获均存在，再比对 256×256 RGBA。[状态序列与图像指纹](./native-2d-m6-windows-web-gpu-results.json)。
- [x] RenderRoot2D 注册基础硬化：Node 销毁通知、Batcher 独占观察 link、遍历范围强引用快照、重复注册/排序/回调期间变更、跨 root batch/stencil 清理；Windows Debug/Release 与 1000 次 plain Node 注册/释放通过。单 Camera 下两个 root/Canvas 的启停/重排/销毁 GPU 对照通过，扩展夹具 58 图像差值 0、11 注册和 19 命中检查通过；见 [报告与剩余矩阵](./native-2d-m6.4-render-root-lifecycle.md)。不关闭上一项的真实场景/多 Camera/平台门禁。
- [x] Windows Scene/多 Camera 定向矩阵：修复 Graphics 在 onLoad 前丢命令和从未激活实例的 backend 清理；普通 Debug/ASAN 与 Web 同快照 74 图像差值 0，1000 次实际 director 切换、动态纹理创建销毁与 4998 项循环断言通过。见 [报告与边界](./native-2d-m6.4-scene-matrix.md)；不是完整 asset-manager、泄漏、Release GPU 或平台验收。
- [x] CHAR 图集由使用它的 Label 通过 IntrusivePtr 持有。最后一个引用释放时同步清理原生查找指针，JSB 与 Web 共享独立的 LetterRenderTexture 类型。Debug/Release 验证双 Label 共享、释放一个后继续绘制和切换缓存 1000 次，两个配置各 85 张图像与 Web 完全一致。运行时依赖与所有权审计、测试工程 M0/M2/M3/M4/M5 和 SpriteFrame 回归通过。[当前 GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json)
- [ ] 所有 native 组件/资产核对 attach/detach、Node 非 owning 槽位、RenderEntity/DrawInfo、纹理、字体缓存及回调所有权。
  - [x] RichText 内部段的 JSB 借用引用。修复前 Windows Debug 在销毁 RichText 后仍将保留的内部组件包装判为有效。Windows Debug/Release 的[真实绑定测试](../native/tests/2d-poc/build-richtext-runtime-probe.cjs)分别创建 24 个图像段和 24 个文本段，池内的 10 个 Sprite 和 20 个 Label 继续有效，超出容量的包装在重新布局时失效。销毁 RichText 后，所有借用包装（含 Sprite 的 UITransform）均失效，独立创建的 Label 仍有效。双配置各完成 1000 轮真实字体生命周期；与 Web 的 12 组布局一致，每张图在各自平台都与[上轮捕获](./native-2d-m6-canvas-fill-performance.json)哈希一致，严格像素仍为 9/12。本轮场景快照为 `60e7be125431e519b45e4e1714c2330a7a13fb24394095229f50923787883faf`。旧场景包超时当次的分配顺序未经验证。
- [x] Windows Debug/Release 已确认 GLES3 设备线程实际分离，核对主线程 walk、上传快照、队列消费与分帧回收。场景切换、异步资源完成、禁用后销毁及 Web 对照见[线程边界与验收](./native-2d-m6-threads.md)。
- [x] Windows M5 日志观测缺陷：真实 Kernel/Script 日志在 stdout 全缓冲子进程中可确定复现“调用已返回、退出前不可见”；Win32 显式刷新后 red/green 通过。唯一运行日志/二进制指纹/双时钟/CPU/退出码诊断已接入，完整文档串行验收一次通过，同一 app 连续 3 次 M5 在原 45 秒预算内无重试通过，见 [报告](./native-2d-m6.4-log-observability.md)。
- [x] Windows 图集与 RichText 连续场景的帧内资源生命周期。离屏窗口销毁前清除依赖附件的管线帧缓冲，切换窗口刷新活动纹理。UI 批次持有采样视图和源纹理直至清理，帧末停止访问已上传的 DrawInfo。三次原始 ASan 报告分别定位到 framebuffer 析构、批次 reset 和 GLES3 纹理绑定。修复后原生引用计数回归、Windows Debug 串行门禁及 32 项定向 Jest 通过，100 组图像对既有 Web 基准差值为零。ASan M5 共四次通过（含连续三次），每次 9 个 Label、1 个 Sprite、8725 个着色像素。Debug 应用 SHA256 为 `5a3e867cf950618f42342b7f72dbcebe107ae733c649723be6e82204f462fb6d`，ASan 应用 SHA256 为 `decc3ca0c8af6d23c1c7df266706a07149c4e15a821b754879a68c3df84ecff7`。日志位于 `native/tests/2d-poc/build/m6-window-*.log` 和 `build/static-atlas-heap-gate/asan-m5-reports`。完整线程与平台矩阵继续验收。
- [x] Windows 调度回归通过。Debug、Release 交替各启动 10 次，无重试，全部在原 45 秒预算内产生唯一终态标记，清理前进程均存活。每次保留应用哈希、stdout/stderr、单调时间和 CPU 采样。[20 次运行记录](./native-2d-m6-scheduling-results.json)。同场景 Web、Windows Debug/Release 及 ASan 的千次场景切换和 78 张 GPU 图像均通过。旧两次缺失仍无完整日志，原因未定。
- [x] 同场景静态图集与 Prefab 真实资源千轮压力：Windows Debug 与 Web 各通过 5000 个资产引用和缓存检查、22 个 GPU 像素断言。Windows 私有字节采样和 V8 映射稳定，Chrome GC 后堆从第 100 到 1000 轮增加约 0.93 MiB。完整串行门禁通过，见[采样与范围](./native-2d-m6.1-sprite-atlas.md#7-真实资源千轮压力)。
- [x] 完成同场景 Web 千轮堆增长归因。默认与关闭 V8 优化编译各运行 1000 轮，比较第 100 和 1000 轮堆快照。默认快照增长的 90.5% 落在 V8 `code` 类，对照的总自身字节基本持平，两组关键资产实例计数均下降。见[堆快照对照](./native-2d-m6.1-sprite-atlas.md#8-web-堆快照归因)。
- [x] Windows Debug/Release、完整工程 ASan、CRT/V8 诊断主机与 Web 均通过真实旧 Prefab 连续加载卸载 1000 次，每份报告含 5000 项资产和 22 项 GPU 检查。每 100 轮显式 GC、核查 500 个弱引用；Windows 双堆和 Web 快照中 Prefab、图集、精灵帧、纹理、图片实例均减少。Web 新增绘图对象全部追到当前活动场景，Windows ASan stderr 为空。[配置、覆盖限制与复现](./native-2d-m6-asset-lifetime.md)及[逐轮数据](./native-2d-m6-asset-lifetime.json)。
- [x] Windows MSVC Release 应用项目构建与基础渲染矩阵。使用同一套 Debug 验收脚本资源，Release 原生二进制完成 M2 五模式、M3 Label、M4 Mask/Graphics 和 M5 RichText，M5 计入 9 个 Label、1 个 Sprite，着色像素为 8725。Release 输出的 12 份图集与 88 份字体 RGBA 和 Debug 同名捕获逐字节一致。Release 应用 SHA256 为 `ed9de14382436006389b64a9b23928b4dba834766993aec429666ee4e816b6b4`；日志见 `native/tests/2d-poc/build/m6-release-*.log` 和 `m6-windows-release-build.log`。此处 Release 指 C++ 配置，发布脚本与完整事件矩阵继续验收。
- [ ] Windows Debug/Release 构建和关键渲染、字体、事件场景逐格验收。macOS、iOS、Android、OHOS 的 Debug/Release 标为暂缓、待验证。
- [x] 模块裁剪通过。Windows 和 Web 的 Release 引擎分别构建 9 种组合：无 2D，以及 2D 加 rich-text、mask、graphics 三个独立特性的全部 8 种组合。检查每个实际 cc.js 的公开导出，逐类核对启用及移除结果。[18 个 bundle 的 SHA256 和导出清单](./native-2d-m6-feature-matrix.json)。复现命令为 node native/tests/2d-poc/check-m6-feature-matrix.cjs。

交付：平台矩阵、生命周期/泄漏/线程报告和可定位的失败项。

### M6.5 性能、回退与最终 Gate

- [x] 已固定 7e83734299 迁移前版本、7045a76a35 候选、硬件和构建模式；Windows Release 与 Web 完成五种负载三轮对照。每个场景预热 30 帧，稳态及 10% 变更态各采样 120 帧。[方法、环境和数据](./native-2d-m6-performance.md)。
- [x] Windows 文本行宽复用。Label 布局与绘制共享行宽，GDI 复用同一次测量，DirectWrite 左对齐省去定位测量。六轮混合变更帧从 4.2690 降至 3.6188 ms，系统字体和自定义字体在 Windows 的优化前后像素一致。[测量和回归](./native-2d-m6-text-width-reuse.json)
- [ ] 达成总计划 KPI：2D 组件准备/更新与合批 CPU 时间下降 ≥50%，每帧 JSB 调用下降 ≥70%，JS 堆峰值下降 ≥30%，GC 改善；native `Batcher2d` 成本必须纳入，不能以 JS update 直接返回作为收益。
  - [x] Win32 Canvas 在透明目标或不透明源完全覆盖时直接写入 RGBA。三轮混合变更帧中位数从 4.8806 降至 4.1284 ms，两个 Windows 配置通过像素与句柄回归。[测量结果](./native-2d-m6-canvas-fill-performance.json)
  - [x] Windows Label 用测量上下文直接绘字。Debug/Release 通过重复重绘、GDI 句柄与图像回归。Release 混合变更帧从改动前的 4.5218 降至 3.8502 ms，同轮迁移前为 4.5154 ms。[测量方法及各负载结果](./native-2d-m6-performance.md)
  - [x] 从完整候选 `211c790b7d` 重建 Windows Release，与迁移前和绘字隔离版本三轮交错对跑。Web 同版本完成 12 组负载。混合变更帧为 4.0039 ms，较迁移前下降 8.1%，CPU 门禁仍开放。[分段与逐轮证据](./native-2d-m6-performance.md)
  - [x] 六轮交错比较迁移前、移除 Label 覆盖扫描前后。混合变更帧从迁移前的 4.7116 降至 3.4639 ms，下降 26.5%。50% 门槛为 2.3558 ms，尚差 1.1081 ms/帧。[六轮逐项数据](./native-2d-m6-label-coverage-performance.json)
- [x] 14 个原生 override 的物理行数预算已接入 M0 和 native-ts-build。计数保留空行、普通注释及包含运行时逻辑的行，排除版权头、纯类型声明和可确认的 deprecated 直接转发。最接近上限的是 SpriteFrame 298/300 和 Label 491/500；RichText 为 155/500。UIRenderer、LabelOutline、LabelShadow 是保留的 Web 实现，纳入 17 类依赖检查。扩展后的薄壳检查 27 项与 7 项审计测试在本机通过。
- [x] Windows Debug/Release 各完成 14 组场景的创建、稳态、显式 API、同步变更、下一帧、禁用、启用和延迟销毁统计。224 个窗口逐个校验 V8 原生总数；两种配置的迁移类直接调用数逐格一致，稳态为 0，共享 manager 每帧 1 次。[逐组计数与覆盖边界](./native-2d-m6.0-windows-jsb-trace.md)
- [x] 六种独立资产的创建、同步属性变更、destroy 与三帧延迟清理，在 Windows Debug/Release 共 48 个窗口通过 V8 总数校验；记录 TTF 数据释放、位图字体帧解绑和共享资源存活。[逐资产调用与边界](./native-2d-m6.0-windows-jsb-trace.md)
- [x] 迁移组件稳态每帧 JSB 调用 0；属性变更、生命周期和用户显式 API 调用单独统计。常规壳 ≤300 行，Label/RichText ≤500 行（按总计划排除版权、纯类型、deprecated 转发）；超限先移除算法，不能仅压缩排版。
  - Label 的序列化访问器及字体、材质、CHAR 引用桥接在 TS；排版、几何、字形栅格化与上传由原生 Label 完成。RichText 在 TS 保存序列化数据和触摸监听，命中后先保存原生返回的回调名与参数，再遍历命中段与组件派发事件；解析、排版和命中测试由原生执行。两壳的逐帧渲染方法和渲染缓冲分配已纳入静态检查，33 项通过。Web RichText 和两个原生壳的 3 组 Jest 共 15 项通过。调用与配置证据见[组件](./native-2d-m6-jsb-lifecycle.json)、[资产](./native-2d-m6-jsb-assets.json)。本项覆盖薄壳约束，独立的组件行为与字体视觉门禁继续验收。
- [x] 17 个迁移或保留类的 2D 运行时导入闭包已接入薄壳检查和现有 native-ts-build 测试。Windows Debug 部署包逐块匹配 SHA256，78 个 2D 模块中 55 个产生代码，Web Sprite、Label assembler 和 Graphics WebGL 实现均为 0 字节。公共 utils 入口仍导出 html-text-parser（13308 字节）和 text-utils（13330 字节），17 类的 2D 内部依赖链均未导入它们。部署 cc.js 为 `4702081743c4e25996b2815a2ba2266a510c68133e2e2ef260ca03e921b226d5`。源码检查 13 项与审计测试 6 项通过。闭包边界外的回流、实际每帧调用与完整 CI 仍待验证。
- [ ] 扩展现有 `check-thin-shell.js` 等检查，覆盖全部迁移类和间接热路径；CI 执行 Web TS/Jest、native TS、native 构建与组件/场景回归。
  - [x] SIMPLE Sprite 的[四边形对照](../native/tests/2d-poc/run-sprite-quad-parity.ps1)读取 Web assembler 实际写入的 UV 和索引区间，并按各端提交的索引栅格化。Windows Debug/Release 对 Web 各 13 项通过，100×100 图像逐像素一致。将 Web 索引全部置零会产生 10000 个差异像素；单独颠倒绕序或改变 UV，即使纯色图像相同也会判为失败。
  - native-ts-build 的 PR 检查已接入位图字体布局和径向 Sprite 的 C++/Web assembler 对照。本机运行同一对入口，2327 个布局和 3024 个几何用例通过；远程 CI 结果及 Windows 完整应用矩阵另行验收。
  - [x] [Windows PR 矩阵](../.github/workflows/native-ts-build.yml)分别构建 Debug/Release 引擎、生成 SWIG 绑定并运行[六组 JSB 用例](../native/tests/2d-poc/run-windows-jsb-probes.ps1)，覆盖 renderer manager、Sprite API、SpriteAtlas、字体资产、布局和 RichText。每次运行同时检查场景记录的节点挂接。两种配置均在本机从空目录编译通过，六组用例与 SIMPLE Sprite 对 Web 的 13 项检查全部通过。Web 全量检查通过 TypeScript 编译和 197 组 Jest（1467 项通过、8 项跳过、16 项待实现），native TS 编译通过。托管 runner 的执行结果与完整应用场景仍待签收。
- [ ] 按组件/模块演练回退，验证 override、依赖资产、材质与旧场景可用；回退后记录行为与性能。
  - [x] UIOpacity 支持独立切回 JS 并恢复原生实现。Windows Debug/Release 各验证两种实现、Prefab 字段、组件生命周期、85 张 Web 对照图与 setter 耗时。[复现和采样](./native-2d-m6-ui-opacity-rollback.md)
  - [x] RenderRoot2D 支持独立切回 JS 并恢复原生注册。Windows Debug/Release 各验证两种实现、Prefab 实例化、11 个根注册检查点、85 张 Web 对照图与组件启停耗时。[复现和采样](./native-2d-m6-render-root-rollback.md)
- [ ] 汇总 `native-2d-m6-gate.md`：每个任务、平台、指标均链接候选版本的日志/产物；失败和未验证项不能记作通过。

交付：性能报告、回退记录、M6 Gate。原计划 4–5 周是早期估算，未包含当前列出的全部 M4/M5 终态欠项；完成 M6.0 后重新排期。

## 3. 终态验收标准

| 门禁 | 必须满足 | 不足以判定通过的证据 |
|---|---|---|
| 范围与 API | 冻结范围内逐类 parity，旧场景/prefab/资产、公开 API 与用户脚本兼容 | 仅 smoke 或方法存在 |
| 薄壳 | 元数据/序列化、生命周期、API/事件桥接；无 UV/几何、文本/HTML、材质选择算法或第二份权威状态 | 只改 prototype 或只满足行数 |
| 原生热路径 | native 准备、几何/文本/材质与提交闭环，稳态每帧 JSB 0 次 | JS 调用 native，但仍在 JS 逐段布局 |
| 视觉与事件 | Sprite/Graphics 通道容差 1；文本按记录的布局/字形/基线容差；事件序列一致 | colored 非零、面积或 ±20% sanity 单项 |
| 图形完整性 | Graphics 三角化/GPU 提交和描边语义，Mask 混合/嵌套/恢复正确 | 256×256 兼容光栅化探针 |
| 性能 | 上述 ≥50% CPU、≥70% JSB、≥30% JS 堆目标及 GC 数据 | M2 ≥30% 阶段 KPI 或单一空闲场景 |
| 稳定性与平台 | 1000 次加载卸载、无新增泄漏/崩溃、线程边界、Windows Debug/Release 矩阵，另列暂缓平台 | 仅单个配置的功能通过 |
| 工具链与回退 | 绑定/元数据可复现、CI/裁剪组合通过、组件/模块回退演练 | 手工补元数据后本机可运行 |

全部阻断项通过后才能将 M6 和整个 Native 2D 下沉标为终态完成。任何新增容差或范围豁免必须明确记录用例、影响和决策；尚未确认的差异继续列为待处理。

## 4. 范围保持不变

- JS Component 身份、生命周期调度、注册和序列化保留；完整 Component 下沉不进入 M6，参见[评估结论](./native-2d-m6-component-eval.md)。
- `cocos/ui` 不迁移；Canvas/Camera/Widget/View、UIMeshRenderer/UIMesh/UISkew 保持 JS；弃用的 UIStaticBatch 不实现。
- Web 实现保留完整功能；native 差异通过 override 接入。历史实现中为 parity 修改过的 Web 行为仍需回归，不能据此放宽 Web 兼容要求。
