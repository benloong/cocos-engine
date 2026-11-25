# Native 2D M6 Gate

## 2026-11-25 M0 总门禁与 SpriteFrame 套件复验

提交 `ecde8d8a96` 移除了迁移期间新增的四条 Web 用例，涉及字体超时重试、预加载数据复用、动态图集上传字节范围和 Sprite 模板材质阈值。按迁移前基线 `7e83734299` 恢复了被替换的 FontFaceSet 用例，验证字体注册与加载使用同一 CSS family，回调返回原始别名。两条 Native 字体创建用例也继续执行。

| 检查 | 本轮结果 |
|---|---|
| M0 总门禁 | 原入口 `native/tests/2d-poc/run-m0-checks.ps1` 完整执行，退出码 0。C++ 纯逻辑 175/175、位图布局 2327 组、字体资产与序列化组 86/86、TypeScript 检查及末段 Jest 50/50 均通过。M2 像素与 M3 Label 探针使用上一轮 cocos-cli 构建的 Release 包，通过了应用、引擎和场景脚本的哈希核对。 |
| Web SpriteFrame 套件 | 按文件运行 `tests/ui/sprite-frame.test.ts`，读取和克隆两项均通过，退出码 0。 |
| 字体加载器套件 | 单独运行 `tests/ui/font-loader.test.ts`，迁移前的四项 Web 检查和两项 Native 检查均通过，退出码 0。 |

本轮修改仅涉及测试及验收记录。Windows Debug/Release 应用签收沿用下节的双配置实测。[本轮三份原始日志](./acceptance/native-2d-20261125/m0-web-suite-rerun.zip)

## 2026-11-25 M0 位图宽度与 M4 公开接口签收

Windows Native/JSB 本轮三项均通过。候选 `db6fc3770f` 用 cocos-cli 重新导出 `cocos-m1-test`，重建 Native override，并用 CMake 构建 Debug、Release。Debug 使用同批对象重新链接并关闭远程调试监听，Release 使用项目生成的可执行文件。[双配置逐项结果](./acceptance/native-2d-20261125/three-gates-windows.json) · [构建日志、前后对照与 RGBA 原图](./acceptance/native-2d-20261125/three-gates-windows.zip)

| 门槛 | 预期与实测 |
|---|---|
| M0 BitmapFont 2307 | `🙂` 的 BMFont 字形 ID 为 128578，横向步进 17，字号从 16 缩到 8。自然宽度应为 8.5。MSVC Debug、Release 都得到宽 8.5、高 16、一枚字形。Web 用两个 UTF-16 码元拼成的键 `5535756898` 查表，得到宽 0。旧验收误用了这个值。 |
| M0 回归范围 | 两种 MSVC 配置各通过 2327 组。前 2307 组使用原文对照。后 20 组在参考布局中以未占用的 BMP 码点表示同一字形或缺字，Native 输入保持原 Unicode 标量，继续比较换行、字形位置、四顶点及 UV。单字在四种溢出模式下另有明确的尺寸断言。 |
| M4 默认 Mask | 空宿主与自带 120×60 UITransform 的宿主均放在非原点。两种配置下中心命中、远端外点未命中，各只有一个 UITransform，已有变换保留实例与尺寸。旧 Release 在空宿主上缺少变换，中心未命中。 |
| M4 Graphics.impl | 加载前取得的路径实现在激活后保持同一实例，支持替换、置空、恢复，销毁后读回 null。用 `impl.rect()` 构建 40×40 遮罩路径、用组件的 `fill()` 填充，两种配置各得到 1600 个红色像素。旧 Release 缺少 `impl`。M4 场景现通过实际 JSB 类型识别原生路径。 |

两个配置各核对 15 个类的 192 个现行公开成员，缺失 0 项。M1 的窗口命中正负对照、M2–M5 应用探针及三种组件的动态 priority 遮挡顺序通过。各配置的 12 张图集和 92 张位图 RGBA 与归档基线逐字节一致，M5 正常退出。

应用退出后另跑 Release PoC 的 M2 场景性能门槛，Native 为 139.8 ns/Sprite，JS 为 269.0 ns/Sprite，耗时下降 48.0%，门槛为 30%。

候选 `db6fc3770f` 当时的跨端 M0 脚本在 Web 字体加载器的超时重试和预加载数据复用两项失败，同组其余 85 项通过。脚本后续的 RichText 运行时、TypeScript 检查及 50 项末段 Jest 已单独复跑通过。当时另行复跑的 Web SpriteFrame 套件有两项失败，分别涉及动态图集上传的字节范围和 Sprite 模板材质的 Mask 阈值。以上结果保留在该候选的归档中。

## 2026-11-25 M1 窗口命中复验

M1 命中门禁通过。Windows Debug、Release 的打包场景在 M2 切换相机前验证实际窗口的中心与外点，再在 M2 的 RenderTexture 上验证离屏未命中。两端的默认 ID 与错误窗口负向对照也通过。整体验收仍有默认 Mask 命中、Graphics.impl 和 M0 位图字体宽度差异。[M1 门禁](./native-2d-m1-gate.md) · [双配置验收数据](./acceptance/native-2d-20261125/m1-window-hit.json)

## 2026-11-25 动态 priority 像素复验

Sprite、Label 和 Graphics 加载后修改 `priority` 的问题已修复。Windows Debug、Release 新包均通过原生转发与实际遮挡顺序门禁；整体验收仍有其他阻断项。[修复前后像素、构建与复验数据](./native-2d-priority-order-20261125.md)

## 2026-11-25 CLI 新包整体验收

M0–M5 合并签收结论为 **NO-GO**。本轮从 cocos-cli 导出 `cocos-m1-test`，重新构建 Native override 并编译 Windows Debug/Release。公开接口范围仅含现行公开成员。候选实测、各阶段判定和失败对照见[本轮验收记录](./native-2d-cli-acceptance-20261125.json)。下节保留同日此前使用归档包的结果。

| 阶段 | Windows 复验结果 |
|---|---|
| M0 | C++ 纯逻辑 175/175，Sprite 四顶点与参考图零像素差异。原总门禁在 U+1F642 位图字体宽度对照失败，Native 为 8.5，Web 为 0。 |
| M1 | 恢复到屏幕相机后，显式活动窗口 ID 的中心、外点及错误窗口对照均通过。相同中心点省略 ID 时未命中，历史门槛仍未通过。 |
| M2 | 五种 Sprite 模式像素通过。应用测试结束后单独运行 Release PoC，Native 160.7 ns/Sprite，JS 471.6 ns/Sprite，耗时下降 65.9%，达到 30% 门槛。加载后设置 Sprite.priority 未转发给原生组件。 |
| M3 | Label 字体、换行、缓存和应用渲染探针通过。Label.priority 复现同一转发问题。 |
| M4 | 默认矩形、反向、椭圆、模板与嵌套遮罩等 GPU 断言通过。空节点直接添加 Mask 后中心未命中，Graphics 缺少公开的 impl 字段，同样复现 priority 转发问题。 |
| M5 | Windows 阶段场景通过。9 个 Label 段和 1 个 Sprite 段、点击序列及清理检查通过。Debug、Release 分别在 42.44、39.35 秒内自然退出 0。 |

两种配置各有 104 张 RGBA 捕获、80 组布局数据与已验基准完全一致。15 类的 192 个直接声明成员中，每个配置可访问 191 个，缺少 `Graphics.impl`。成员存在性与运行行为分别记录。[可复跑的公开接口门禁](../native/tests/2d-poc/run-m1-m5-public-api.ps1)

最终包每个配置各通过 1000 轮静态图集测试，检查 5000 个资产和 22 次像素。Native 定向 Jest 18 套件、127 项通过，另有 10 项按范围排除。原始混合套件另有动态图集字节范围、Mask 材质阈值和两项 Web 字体加载失败。启动日志仍记录本地可写目录创建失败和缺少 `cc.PhysicsMaterial`。[本轮逐项数据](./native-2d-cli-acceptance-20261125.json)

## 2026-11-25 现行公开接口复验

**打包记录。** 本轮未用 cocos-cli 重新打包 `cocos-m1-test`。M2–M5 使用候选归档中的 Windows Debug/Release 可执行文件及 Resources，复制到独立目录并校验哈希后运行。当前工作树从 CLI 导出、重建 Native override、同步资源到编译并运行新包的端到端流程，本轮未验证。[候选包来源](./native-2d-m6-document-app-8ee11b673e.json) · [CLI 构建与验收流程](./native-2d-build-and-acceptance.zh-CN.md)

**整体验收 NO-GO。** 实现候选为 `8ee11b673e`。在 `d9bf6a317c` 工作树复跑，核对了引擎源码、构建替换配置以及候选二进制和部署包的 SHA-256。Windows Debug、Release 在真实文档工程中复现了下列三项差异。11 月 24 日的 GO 记录对应当时通过的候选用例。[双配置逐项结果](./native-2d-m6-public-parity-8ee11b673e.json)

| 现行公开接口 | 复现步骤与两种配置的结果 |
|---|---|
| `UIRenderer.priority` | 在未激活节点上给 Sprite、Label、Graphics 设置 3，再激活。三个组件的原生 `setPriority` 均收到 3。加载后设置 100，公开 getter 读回 100，三个原生组件均未收到本次更新。探针记录真实绑定调用并转交原方法。继承的 setter 写入壳上的渲染实体，原生合批排序读取实际提交实体的优先级。本项验证了转发路径，未采集遮挡顺序图。[公开 setter](../cocos/2d/framework/ui-renderer.ts) · [原生排序](../native/cocos/2d/renderer/Batcher2d.cpp) |
| 默认 `Mask.isHit` | 在活动场景的空节点上直接添加默认矩形 Mask，宿主未获得 UITransform，世界中心点命中结果为 false。对照节点预先添加 100×100 的 UITransform，中心点返回 true，外部点返回 false。参考实现创建宿主 Graphics 时由 UIRenderer 自动补齐 UITransform。[Mask 参考实现](../cocos/2d/components/mask.ts) · [原生命中](../native/cocos/2d/components/Mask.cpp) |
| `Graphics.impl` | TS 源码将该字段声明为 public，公开声明中也包含它，类型为 Impl 或 null。两种配置中通过 `node.addComponent(Graphics)` 创建的实例都没有此属性，读取结果为 undefined。[字段声明](../cocos/2d/components/graphics.ts) |

公开成员抽查覆盖 15 个组件、基类和资产类的 192 个直接声明成员，包含静态成员。属性的 getter 和 setter 按同一名字合并核对源码及声明中的弃用或内部标记。每种配置均能访问 191 个成员，唯一缺失的是 `Graphics.impl`。成员存在性与行为分别验证，`priority` 和 `isHit` 均在存在性检查中通过。兼容入口和已弃用接口退出签收统计。

| 其余门禁 | 本轮证据 |
|---|---|
| 原生与 JSB | 两种配置各通过原生核心、7 个 JSB 探针和 1000 轮 DirectWrite 文件检查。Native TS 编译、6 个资产类的元数据检查、43 项薄壳检查、18 项 M1 检查及 28 项审计工具测试通过。18 个定向 Jest 套件有 127 项通过、10 项按范围排除。[本地结果](../native/tests/2d-poc/build/public-parity-1795572295121/jest.json) |
| 文档工程 | 重新运行 M2 Sprite、M3 Label、M4 Mask、M4 Extra、M5 RichText，双配置各通过 5 个入口。M5 均自然退出，退出码为 0。每种配置各有 12 张图集捕获和 92 张位图字体捕获逐张匹配基准。[Debug 日志](../native/tests/2d-poc/build/public-parity-1795572295121/document-Debug/m5-richtext.log) · [Release 日志](../native/tests/2d-poc/build/public-parity-1795572295121/document-Release/m5-richtext.log) |
| 归档与性能 | 核对了 12 份生成绑定产物、9 组裁剪包、每配置 14 个稳态追踪窗口、每配置千轮静态图集和 348 张离线 RichText 捕获。重放候选 6 对性能样本，混合变更帧 CPU、JSB、JS 堆峰值、强制 GC 耗时分别下降 57.36%、77.51%、43.49%、21.45%。[性能重放](../native/tests/2d-poc/build/public-parity-1795572295121/performance.json) |

M6 清单仍有 7 项待办。组件 parity 已有上述三项可复现的失败。字体全生命周期、复杂布局、异步资源与跨场景释放、RichText 事件与包装对象生命周期仍缺完整候选证据。Windows 双配置矩阵及最终汇总待这些项目逐项复验后关闭。[M6 清单及验收标准](./native-2d-m6-plan.md#3-终态验收标准)

## Windows 最终签收 · 2026-11-24

**GO — 实现候选 `8ee11b673e`。** 用户确认历史 Debug 提前退出和字体共享冲突已处理，关闭这两项阻断。历史记录保留当时的观测，具体退出原因和占用进程未从原始日志确定。

15 份已提交报告均对应同一实现候选。Debug 和 Release [原生核心复验](./native-2d-m6-reaccept-core-8ee11b673e.json)通过，[字体复验](./native-2d-m6-reaccept-font-8ee11b673e.json)各完成 1000 轮。[离线 RichText 应用](./native-2d-m6-offline-richtext-exit-8ee11b673e.json)六次正常退出，348 张捕获与基准逐字节一致。[Windows Release 性能门禁](./native-2d-m6-performance-8ee11b673e.json)四项通过。

### 迁移计划验收复核

本地复跑使用经 SHA-256 核对的 Windows 候选二进制和独立运行目录。Debug 和 Release 的原生核心、各七个 JSB 探针及各 1000 轮 DirectWrite 字体文件检查均通过。两种配置的离线 RichText 应用各自然退出一次，各 58 张 RGBA 捕获与归档基准逐字节一致。Native TypeScript、元数据生成检查、43 项薄壳检查、18 项 M1 薄壳检查、13 项审计工具测试及 175 项独立 C++ 检查通过。定向 Jest 共通过 119 项，其中位图字体补充平面字形断言使用归档的 Native 夹具单独执行。

复核了候选报告中的生成绑定、文档工程 M2–M5 日志与部署包、九组功能裁剪、双配置 272 个 JSB 调用窗口和 12 份性能原始样本。九组 Windows 构建的 Web assembler 保留字节均为 0，稳态窗口中的迁移类直接 JSB 调用均为 0。文档工程构建、千轮静态图集和性能采样沿用归档验收。[文档工程](./native-2d-m6-document-app-8ee11b673e.json) [静态图集](./native-2d-m6-atlas-gate-8ee11b673e.json) [裁剪](./native-2d-m6-feature-gate-8ee11b673e.json) [追踪](./native-2d-m6-jsb-trace-8ee11b673e.json)

整套迁移仍缺完整覆盖证据。现行公开 API、复杂字体与资源组合、RichText 其余包装对象和生命周期场景仍见 M6 逐项计划。最终候选的离线 RichText 复验在 HTTP 字体用例前结束。逐类实施计划中的统一 C++ 组件生命周期尚未达到验收入口，`Sprite` 的 JSB 类仍构造独立 `n2d.Sprite`，Director 仍使用 TS `NodeActivator`。[M6 逐项计划](./native-2d-m6-plan.md) [逐类实施与验收](./native-2d-implementation-matrix.md#实施顺序与验收) [生命周期设计](./native-component-lifecycle-design.md#12-测试矩阵与完成标准)

## 2026-11-25 整体验收

**Windows 默认 Native 候选维持 GO，整套 2D 迁移仍待终态签收。** 在 `d9bf6a317c` 工作树核对了 `cocos/`、`native/cocos/`、`native/tools/`、`exports/` 和 `cc.config.json`，与签收候选 `8ee11b673e` 一致。本轮复用已核对 SHA-256 的候选二进制。验收范围沿用本机 Windows Debug/Release。

| 检查 | 本轮结果 |
|---|---|
| 原生核心、绑定与字体 | 两种配置各运行一次原生核心、七个真实 JSB 探针及 1000 轮 DirectWrite 文件检查。每个探针同时核对退出码、JSB 壳、场景记录和原生 PASS 标记。字体探针起止句柄数分别为 Debug 191 → 191、Release 181 → 181，两者 GDI 均为 0 → 0。[本机日志](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/native) |
| 文档工程应用 | 用独立目录运行 M5 RichText 应用，Debug 和 Release 均通过原生段查询、布局与绘制断言，进程自然退出，退出码为 0。每种配置的 12 张图集及 92 张位图字体捕获均匹配候选基准。[Debug 日志](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/document/Debug/probe.log) · [Release 日志](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/document/Release/probe.log) |
| 薄壳与元数据 | Native TS 编译通过。6 个资产类的生成元数据一致，薄壳检查 43/43、M1 检查 18/18、审计及性能工具测试 28/28 通过。17 类声明审计与基线一致。 |
| 行为回归 | 18 个 Jest 套件，126 项通过，14 项 Web、跨端对照或生成网格断言按范围排除。本轮执行了前次跳过的 9 条 Label、Mask、Graphics 薄壳断言。独立运行未筛选的 13 个混合套件，115 项通过、2 项失败。两项均直接构造 Web SpriteFrame，分别为旋转图集生成网格 UV 和帧末释放网格。[定向结果](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/jest/scoped.json) · [混合套件原始结果](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/jest/report.json) |
| 归档产物复核 | 核对双配置生成的 12 份绑定产物、M2–M5 共 10 份日志及通过标记、两份千轮静态图集报告、9 组裁剪包与模块统计。两种配置各 14 个 60 帧稳态窗口中，迁移类直接 JSB 调用为 0，公共渲染管理器每帧仍调用一次。离线 RichText 六次运行的 348 张 RGBA 逐张匹配归档基准，覆盖到 HTTP 字体用例之前。[文档工程](./native-2d-m6-document-app-8ee11b673e.json) · [调用追踪](./native-2d-m6-jsb-trace-8ee11b673e.json) · [离线应用](./native-2d-m6-offline-richtext-exit-8ee11b673e.json) |
| 性能 | 重放候选六对 Windows Release 原始样本。混合变更帧 CPU 下降 57.36%、JSB 次数下降 77.51%、JS 堆峰值下降 43.49%、强制 GC 耗时下降 21.45%，四项达标。合批阶段耗时单项增加 26.42%。[重放结果](../native/tests/2d-poc/build/acceptance-20261125-1795570054661/performance.json) · [候选样本与门槛](./native-2d-m6-performance-8ee11b673e.json) |

M6 清单仍有 7 项未勾选。Windows 范围内待补的证据包括各组件现行公开 API、双向文本与字形塑形、现行场景及 Prefab 的异步取消和跨场景资源释放、RichText 用户事件及保留 Node 包装对象的生命周期。组件 parity 排除兼容接口和已弃用接口，含 Mask 的 19 个已弃用渲染成员。最终候选还缺逐项映射到 Windows 两种配置的结果与产物。macOS、iOS、Android、OHOS 维持暂缓。统一 C++ Component 调度属于另列的逐类实施计划，M6 保留 JS Component 身份和生命周期调度。[终态标准及范围](./native-2d-m6-plan.md#3-终态验收标准) · [Mask 兼容边界](./native-2d-m6-mask-compat.md) · [逐类实施计划](./native-2d-implementation-matrix.md#实施顺序与验收)

## 历次候选记录

**2026-11-24 检测范围调整。** 按用户决定，后续验收移除 ASan，仅运行 Windows Debug/Release；ASan 不再作为最终签收条件，历史结果保留。执行限本地工具，不启动网络服务或下载依赖。已确认的 [RichText Release 访问冲突](./native-2d-m6-candidate-crash-03b5254ea7.md) 继续阻断签收，须在双配置修复复验。

**NO-GO。** 当前候选 `554d747561`。UIOpacity 阻断已解除；本轮双配置完整工程、千轮图集、RichText 字体应用和薄壳／间接路径通过，但 Debug 字体文件独占打开检查重新失败。该稳定性问题及其余终态行为矩阵继续阻断最终签收。[剩余项验收](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md)

验收范围为 Windows Debug、Windows Release 的 JSB 薄层和 Native 实现。JSB + Native 禁用动态合图。Windows RichText 内部分段仅通过原生组件查询。macOS、iOS、Android、OHOS 暂缓验收。本轮采用本机验收证据，CI 与托管 runner 运行记录退出签收范围。

**2026-11-23 组件范围调整。** SpriteRenderer 及 ModelRenderer 的实现、JSB 薄壳和相关验收移出本期 M6。生成网格渲染、旋转／翻转方向、深度裁剪、模型／IA 重绑、纹理描述符更新及对应网格／缓冲生命周期用例归入范围外历史记录。相关失败退出 M6 阻断清单。混合套件按断言和实际执行路径筛选范围内用例，重新统计捕获及检查数量。

**序列化验收范围。** 场景、Prefab 和资产使用现行序列化格式及现行类名，继续验证字段恢复、资源绑定与生命周期。旧版本序列化数据的加载、迁移和兼容不列入 M6 签收。

**现行格式回归覆盖。** `cc.Label` 的字段和字体绑定、`cc.Sprite` 独立图片与图集生命周期、`cc.Mask` 模板材质以及 `cc.Graphics` 的样式和材质恢复已有对应夹具。夹具的提交不改变最终候选的待验收状态。[Label 与 Sprite](./native-2d-m6-label-renderer-compat.md) [Mask](./native-2d-m6-mask-compat.md) [Graphics](./native-2d-m6-graphics-compat.md)

**2026-11-23 验收范围调整。** 现有 Web 实现的 TypeScript、全量 Jest、构建、动态图集、资源加载及 GPU／字体应用检查退出 M6 签收。历史 Web 结果保留为观察记录，Web 运行成功和 Windows 对当前 Web 的布局／像素一致性均退出强制门槛。Native 的 API、现行格式序列化、渲染、事件、资源与对象生命周期仍须在 Windows 双配置独立验收。

既有 Web 捕获及对照脚本可作可选参考。Native 视觉验收使用已确认的夹具期望和基准图像，核对布局、采集哈希、渲染可见性、交互及字体生命周期。此前三项字体跨端像素暂缓约定归入历史记录。[历史字体矩阵](./native-2d-m6-font-source-isolation.json)

## 历史候选 554d747561 的剩余项验收

实现源码未改动。Windows 双配置在独立目录重新构建文档工程和调用追踪程序。M2–M5、各千轮图集、各 62 张 RichText 捕获及千轮字体生命周期、20 次交替启动、18 套件／119 项 Native 断言与 Native TS 通过。双配置 272 个调用窗口核对原生总数，迁移类稳态直接调用均为 0；部署审计核对 84 个 2D 模块和 35 条边界导入，未保留 Web assembler。[完整结果](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md)

**当前失败**为字体文件独占门禁。Debug 原始程序第 998 轮失败。独立诊断在原工作目录第 431 轮捕获有效字体对象释放后的共享冲突（Win32 32），紧接着的观测已可打开。系统占用查询启动返回 29，尚未确定占用者，未证明原始第 998 轮也发生在同一步。双配置原始程序在独立目录各三轮及诊断独立目录 10000 循环通过，均保留为对照，不能覆盖失败。

UIOpacity 修复及双配置各 146 张核心图形结果沿用提交前刚完成的同实现记录，已核对提交后的源码哈希。本轮未重跑 ASan，也未重测旧候选性能／功能裁剪。完整 API、其余复杂字体与资源组合、RichText 极限对象／Node wrapper 和 M6.4／M6.5 最终签收继续保留。

## 2026-11-23 UIOpacity 修复复验

禁用期间写入 opacity 仅保存数值，节点透明度保持 1；重新启用后应用保存的新值。Windows 双配置通过真实组件入口和原生回归，各 146 张核心捕获与修复前 Native 基准及双配置之间逐字节一致。本次未重跑 ASan，初始增量 Release 启动异常保留，最终全量重编译复验通过。[详细记录](../native/tests/2d-poc/build/m6-uiopacity-fix-20261123T152115Z/summary.md)

以下保留修复前的验收结果。

## 2026-11-23 按核心组件范围复验

核对 4319 个源码及夹具文件与同候选构建快照一致。复用已核验的程序与引擎包，在独立验收资源副本中筛除 29 项 SpriteRenderer 相关捕获及调用，保留 146 项核心捕获和原有断言。实现源码无修改。[复验报告](../native/tests/2d-poc/build/m6-core-accept-2026-11-23T14-54-24-737Z/summary.md) [逐项数据](../native/tests/2d-poc/build/m6-core-accept-2026-11-23T14-54-24-737Z/summary.json)

| 项目 | 结果 |
|---|---|
| 核心图形 | Windows Debug、Release、ASan 各完成 146 张捕获、22 项命中、11 项根节点、1000 轮场景和 4998 项场景断言。三配置图像及保留的历史 Native 基准逐张字节一致；每配置另核对 46 项中心颜色和 55 项面积期望。 |
| Native Jest | 18 套件、119 项通过，11 项 Web／跨端与 1 项生成网格检查按范围排除。 |
| RichText | Windows Debug/Release 各通过 62 张捕获、1000 轮字体加载释放、31 次完整 HTTP 传输、断流／取消／续传及 11 个独占读取检查点。缓存均由 22 回到 22，GDI 对象均为 26→26。62 对图像逐张字节一致。 |
| UIOpacity 启停 | 两种配置均失败。真实组件设置 opacity=128 后禁用，节点透明度恢复到 1；保持 enabledInHierarchy=false 写入 opacity=64，节点透明度变为 0.250980406999588，预期禁用期间保持 1。重新启用后为 64/255。 |

Native TypeScript、元数据／薄壳／工具检查、C++ 基础、重建后的双配置原生程序及各六组 JSB 探针沿用前一轮同候选有效结果。文档工程、资源压力、调度、裁剪、调用追踪和六对性能数据沿用同候选完整复验记录。验收副本初始的字体采样路径、探针依赖映射和控制断言位置问题已纠正，初次记录留存在本轮产物中，最终结果以报告为准。

SpriteRenderer 相关历史失败保持范围外记录。UIOpacity 失败归入 M6.4 组件启停与状态一致性，修复及复验后再处理最终签收。

## 当前候选 529cb53636 的完整本机复验

2026-11-23 丢弃 sprite-frame.jsb.ts 草稿后，从 `529cb5363685961f22647b10f547bc248c04e2a7` 的独立干净工作树重新构建。sprite-renderer.jsb.ts 和对应 override 均不存在。所有应用重新生成 Native 2D 引擎包，实际部署的 7 份包逐一匹配新构建的 SHA256，未复用此前含草稿的包。当前 cc.js 为 `1bc8cd683c4d95d438525541ec52d2c9aa08f7677decf63f020670a694e224ba`。逐项记录见[候选复验数据](./native-2d-m6-candidate-recheck.json)中的 `fullRechecks`。

| 项目 | 本轮结果 |
|---|---|
| 基础与类型检查 | 元数据、M6 基线、43 项薄壳、18 项 M1 壳、13 项工具测试、Native TypeScript、175 项 C++ 基础检查通过。 |
| Native Jest | 18 套件、120 项通过，11 项纯 Web／跨端断言按范围过滤，无 todo。 |
| 原生程序与探针 | Windows Debug/Release 最终各三轮通过，各六组 JSB 探针、千轮字体文件所有权与日志可见性通过。首轮异常另列保留。 |
| 文档工程 | 两种配置的 M2、M3、M4、M4 Extra、M5 均通过，静态图集各 1000 轮。10 轮双配置调度共 20 次启动通过，最长 40.245 秒，预算 45 秒。 |
| Native 图像 | 文档工程 104 对 Debug/Release 图像逐字节一致；RichText 62 对通过，最大通道差 0。没有执行当前 Web 对照。 |
| RichText 完整应用 | Debug/Release 各 62 张捕获、1000 轮字体生命周期、31 次完整 HTTP 传输及文件句柄检查通过。断流、取消续传、别名和失败重试通过。ASan RichText 完整场景通过。 |
| 裁剪与部署审计 | Windows 9 组功能组合均通过，Web assembler 保留字节均为 0。部署审计匹配 cc.js，84 个 2D 图模块，没有 Web assembler 代码。 |
| JSB 调用追踪 | Debug/Release 逐组件和六种独立资产生命周期通过，稳态迁移类直接调用为 0。 |
| 范围内图形应用矩阵 | 本轮按核心组件清单完成复验，Windows Debug/Release/ASan 各 146 张捕获，命中、根节点和千轮场景通过，详见上节。 |
| Native 性能 | 相对迁移前 `7e83734299` 六对交错。混合变更帧 CPU 为 3.706675→1.436275 ms，下降 61.3%；JSB 为 876→197 次/帧，下降 77.5%；JS 堆峰值为 30,061,608→17,482,932 字节，下降 41.8%；强制 GC 为 4.982→3.569 ms，下降 28.4%。四项门槛通过，GC 6/6 对改善。比较器保留场景、V8、渲染器、部署包和分段计时检查，仅移除 Web 目标。 |

本轮 batch 子阶段为 0.69875→0.7394 ms，增加 5.8%，没有独立子阶段门槛；包含 setter、准备和 batch 的整帧 CPU 达标。

原生成网格渲染场景的 GL 错误、角点断言与 ASan 释放后使用记录，随本次组件范围调整归入范围外历史结果。原始日志和失败数据保留在[候选复验数据](./native-2d-m6-candidate-recheck.json)；范围内的 Graphics／Mask 几何提交、Sprite 渲染和资源生命周期继续验收。

首轮 Debug 的 DirectWrite 进程句柄曾为 397→403，Release 字体共享／Label 字体选择断言曾失败，普通 Debug RichText 一次重跑提前退出。最终三轮原生、六组 JSB 及 RichText 复测均通过，这些首轮异常未复现，原因仍未确认。稳定性记录继续保留。

运行恢复也保留在数据中。CLI 已完成资源导入与脚本生成，MSBuild 的长路径临时目录触发 FTK1011 后，使用独立 Ninja 目录编译同一项目。文档工程的宽功能包包含未解析的 DragonBones／Box2D 外部模块，随后以本轮 Native 2D 功能包完成 M2–M5。首次追踪命令遗漏 MSVC 默认选项，已补回后重建；重复可写目录和字体读取并发造成的采样失败通过脚本原有隔离目录串行复验。

UIOpacity 启停失败已按上节修复并复验。后续 554d747561 的字体文件稳定性失败及剩余签收项见本文当前候选章节，M6 Gate 保持 NO-GO。

## 历史候选 5cdc896f3c 的本机复验

源码基于 `5cdc896f3ccd5ab552a090a9e61328f98dea33a2`。Windows Debug、Release 原生测试程序与完整应用均完成重建，Graphics、RichText 的 Windows/Web 场景资源及四份当前引擎包均构建成功。本机记录见[候选复验数据](./native-2d-m6-candidate-recheck.json)中的 `localRechecks`。以下保留修复前的原始结果，修复后的定向验证见下一节。

| 项目 | 本轮结果 |
|---|---|
| 基础检查 | 元数据、M6 基线、43 项薄壳及 18 项 M1 壳检查通过。脚本单元测试 33 项通过，Web 和 Native TypeScript 编译通过。 |
| C++ 与历史对照采样 | C++ 175 项检查、径向 Sprite、RichText 解析／布局、Graphics 几何和 SpriteFrame UV 对照通过。位图字体布局对照失败，第 2307 例的 U+1F642 在 Native 测得宽度 8.5，Web 为 0。该跨端差异保留作参考，Native 布局需按独立期望核对。 |
| 全量 Jest | 186 套件通过、12 套件失败、6 套件跳过。1461 项通过、25 项失败、8 项跳过、16 项待实现。失败涉及字体加载与反序列化、动态图集、SpriteFrame 网格／释放、Mask 模板生命周期等。这是范围调整前的原始统计，纯 Web 用例退出签收，混合套件中的 JSB／Native 断言仍须逐项核对。 |
| 原生 JSB 探针 | Release 六组全部通过。Debug 在原生测试前置的 Label 提交透明度检查处失败，期望 0.501961，实际 1.0，后续 JSB 探针被阻断。 |
| Graphics 完整应用 | Web 多边形帧的空数据错误归为范围外观察。Windows Debug 串行复测出现 `glDrawElements` 错误 `0x505`，终止了停住的测试进程。Release 使用独立可写目录重试后，在矩形网格方向检查处失败。Native 图像、命中和场景生命周期的完整验收仍待完成。 |
| RichText 完整应用 | Debug 完成 62 张捕获与 1000 轮字体加载释放，HTTP 断流、取消续传和重试通过。Release 在激活期间重建后未恢复。Web 字体重试后宽度仍为 108 的结果归为范围外观察。Native 双配置的独立视觉与生命周期签收仍待完成。 |
| 同候选性能 | Windows Release 对迁移前 `7e83734299` 完成六对交错采样，Web 完成 12 项负载。混合变更帧 CPU 为 4.30625 → 2.043675 ms/帧，下降 52.5%；JSB 为 876 → 197 次/帧，下降 77.5%；JS 堆峰值为 30,044,958 → 17,458,212 字节，下降 41.9%；强制 GC 为 6.9365 → 4.5440 ms，下降 34.5%。四项性能门槛通过，GC 六对中五对改善。比较器已核对 29 份场景资源、V8 DLL 和渲染器一致，计时包含 Native 脏队列刷新。 |

本轮采用现行格式和默认 Native 路径。此前候选的图像、裁剪和调用追踪结果继续作为阶段记录，已完成下述测试与原生探针复验，Graphics／RichText 的已提交版本独立应用复验以及尚未重跑的 Native 功能裁剪、调用追踪、ASan 和文档工程 Windows 门禁继续待签收。

## 已提交修复与定向复验

以下保留前次修复及包来源更正的历史状态，当前独立重打包结果以上节为准。

| 修复 | 提交 | 验证 |
|---|---|---|
| Native 字体壳测试使用 JSB 分支 | `b11d592dac` | 普通与 JIT 两套共 41 项通过。 |
| Native 资产工厂异常处理测试使用 JSB 分支 | `efae6564c9` | 5 项通过，覆盖异常通知、迟到回调、重复完成及重入。 |
| nullable 反序列化测试使用 JSB 分支 | `5f05528228` | 普通与 JIT 两套共 7 项通过。 |
| Native 字体创建失败用例隔离平台与原生销毁钩子 | `3b2a52ee67` | 两项通过，真实 Native 字体探针另验证失败释放和重试。 |
| 补充平面字形独立指标检查 | `4be65d470b` | 四种溢出模式通过。U+1F642 的步进 17、缩放 0.5，对应行宽 8.5。 |
| 修复 Ninja 的 MSVC 头文件依赖前缀解码 | `4773a636bb`、`d91cd90f12` | 按原始字节提取前缀，英文／中文及两种路径分隔符四组检查通过。测试入口记录 616 个头文件依赖，头文件变更可触发重编译。 |

在干净提交快照 `4773a636bb` 中，8 个 Native Jest 套件共 63 项通过，11 项 Web／跨端参考检查排除，六组真实 Debug JSB 探针通过。Windows Debug、Release 的完整图形应用各完成 175 张捕获、22 个命中检查、11 个根节点检查和 1000 轮场景循环。两个配置的 RichText 各完成 62 张捕获、1000 轮字体加载释放及 HTTP 断流、取消续传和重试，原有激活重建失败已消除。Native 双配置共 237 对图像逐张字节一致，已归档每张图像的 SHA-256。

**应用包来源更正。** 应用复用的 JS 包实际包含未提交的 `sprite-frame.jsb.ts` 修改和新增的 `sprite-renderer.jsb.ts` override，包 SHA-256 为 `fcb88fdbfedba1912972b2b15b191d5a00efff16736db1327386697a8844fe0d`。已提交源码之间相同不足以证明该包来自干净提交。上述 237 对图像一致及应用通过结果对应含草稿的工作区 JS 包与干净重建的 C++，已提交版本的 Graphics／RichText 应用仍需重新打包复验。验证过程的引擎包与二进制指纹、日志和捕获记录见[复验数据](./native-2d-m6-candidate-recheck.json)中的 `fixRechecks`。63 项 Jest 与六组 JSB 探针使用干净提交快照，其结果独立有效。完整应用复验与 M6 最终签收继续待办。

## 此前阶段结果

以下保留历史阶段记录。旧混合矩阵的总数包含后来移出的用例，当前 M6 签收按本页范围和逐项计划核定。

| 项目 | 配置和结果 | 证据 |
|---|---|---|
| M6.4 所有权 | 已核对 17 类的组件挂接、资源借用与回调。Windows 双配置各通过 6 组 JSB 探针，Debug、Release、ASan Debug 各完成 1000 次场景切换和 88 张 Web 像素对照。 | [逐类记录](./native-2d-m6.4-ownership.md)、[快照和二进制哈希](./native-2d-m6.4-ownership-results.json) |
| BMFont 资源 | Windows Debug、Release 和 Web 验证 XML FNT 的 Prefab 预加载、图集依赖延迟与取消后重试、跨场景使用、保留原图、完全卸载和冷重载。Web 修复自有 FontAtlas 造成的原图与 ImageAsset 缓存滞留。取消后五个资产缓存键均为空，重试后的 144 张图三端逐字节一致。 | [生命周期与像素](./native-2d-m6-legacy-bmfont.json) |
| 旧式 LabelAtlas 资源 | Creator 从 `.labelatlas` 元数据导入 8 个数字字形。Windows Debug、Release 和 Web 验证 Prefab 类型及绑定、图集依赖取消后重试、跨场景共享、释放及冷重载。Windows 使用原图，Web 进入动态合图页。150 张图三端逐字节一致。 | [导入、缓存和像素](./native-2d-m6-legacy-label-atlas.json) |
| Graphics 命令提交 | Windows Debug/Release 与 Web 像素对照。Release 的 256 个闭合路径从逐调用改用复用缓冲，提交耗时中位数从 581.7 降至 349.1 µs，批次和绘制次数均为 1 | [接口选择与分配实测](./native-2d-m6.3-graphics-commands.md) |
| 混合负载 CPU | `3b6a4f3c9b` Windows Release 六对交错，混合变更帧从迁移前 7.0153 降至 2.3045 ms/帧，下降 67.2%。两端复用同一份 Windows 场景资源，Web 完成 12 项同源负载。 | [六对实测](./native-2d-m6-performance-3b6a4f3c9b.json)、[测量及复现](./native-2d-m6-performance.md#windows-release-候选-3b6a4f3c9b) |
| JSB、堆峰值与 GC | 同六对 Windows Release 样本，JSB 为 876 → 197 次/帧，堆峰值为 30,132,734 → 17,507,898 字节，强制 GC 为 10.6235 → 4.6710 ms。GC 四对改善，两对上升。 | [逐对及中位数](./native-2d-m6-performance-3b6a4f3c9b.json)、[早期 V8 诊断](./native-2d-m6-gc-trace.json) |
| 薄壳与稳态 JSB | 薄壳检查覆盖 Native override、TS 帧方法、渲染数据分配和 2D 内部间接导入。Label 与 RichText 的布局、栅格化及命中计算在原生执行。Windows 双配置每组 60 帧的组件直接调用均为 0，共享 manager 每帧 1 次。同步变更、显式调用和销毁分别计数 | [组件与节点生命周期](./native-2d-m6-jsb-lifecycle.json)、[六种独立资产](./native-2d-m6-jsb-assets.json)、[逐项计划](./native-2d-m6-plan.md) |
| Graphics/Mask 材质与提交成本 | Windows Debug、Release 和 Web。32 个矩形在一个 Graphics 中为 1 次 draw，分属 32 个 Graphics 时为 32 次；单层和双层 Mask 分别为 3 次和 5 次。共享纹理完成首次上传后，三个测量阶段均为 0 字节重复上传 | [材质隔离与图像](./native-2d-m6-windows-web-gpu-results.json)、[CPU、批次与上传](./native-2d-m6.3-graphics-cost.md) |
| 图形与事件 | 历史混合矩阵覆盖图集 Prefab、Sprite 模板阈值、合批、跨根节点命中和场景切换。原图像总数包含本轮范围外用例，当前签收按核心组件用例逐项核定。 | [历史 GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json) |
| 组件身份与绑定清理 | Mask 的 Sprite stencil 复用宿主 Sprite。测试绑定清理后，Windows Debug 和 Release 各 88 张图像与 Web 逐字节一致。Windows 双配置的 V8 探针验证三个绑定已移除。UITransform 销毁和替换的节点缓存通过 Windows 双配置和 Web 检查 | [图像与绑定结果](./native-2d-m6-mask-sprite-stencil.json)、[UITransform 探针](../native/tests/2d-poc/build-layout-probe.cjs) |
| UITransform 同级排序 | Windows Debug、Release 和 Web 对分数优先级、同值顺序和重挂接的节点顺序、同级索引及渲染结果一致。完整图形矩阵在两种 Windows 配置各 92 张与 Web 逐字节一致 | [本轮数据](./native-2d-m6-ui-transform-priority.json) |
| Sprite 径向填充 | Web 的中心分量修改现会刷新图形。Windows Debug 和 Release 各 102 张图与 Web 逐字节一致，含新增 10 张径向图、运行时旋转图集帧变更及图集 Prefab | [GPU 读回与哈希](./native-2d-m6-sprite-radial-gpu.json) |
| Sprite 九宫格 | 两端对小于边距总和的节点按轴压缩边框。运行中改边距后更新顶点分区。Windows Debug 和 Release 各 108 张图与 Web 逐字节一致，含缩小、改边距及旋转帧的 6 张图 | [修复前后对照](./native-2d-m6-sprite-sliced-gpu.json) |
| Sprite 平铺 | Windows 原生按帧边距平铺中心区。Windows Debug、Release 各 116 张图与 Web 逐字节一致，新增 8 张涵盖尺寸、旋转、零宽中心、单轴边距及运行时改边距 | [修复前后数据](./native-2d-m6-sprite-tiled-gpu.json) |
| BMFont 配置实时重载 | Windows Debug、Release 和 Web 使用 XML FNT 与序列化 Prefab，保持 Label 绑定并依次重载字距、删除字形和恢复配置。布局宽度为 40、42、37、40 像素。163 张图三端逐字节一致。 | [布局、生命周期和图像](./native-2d-m6-bitmap-config-reload.json) |
| 历史记录 · Windows Label 回退的捆绑 TTF | Windows Debug、Release 各在原生、TS 回退和恢复阶段通过 163 张与 Chrome 的逐字节对照。修复回退纹理的整数尺寸后，三张捆绑 TTF 图通过，原有 160 张的哈希保持一致。 | [六次本机运行及旧版本差异](./native-2d-m6-label-ttf-canvas-size.json) |
| 历史记录 `68af105c8d` · 应用、回退与裁剪 | Windows 双配置各完成默认应用以及 Sprite、Label、Graphics／Mask、UIOpacity 和 RenderRoot2D 的回退与恢复。每次 163 张 RGBA 与同快照 Chrome 捕获逐字节一致，22 个命中检查和 1000 轮场景切换通过。RichText 双配置的原生、回退、恢复每次布局 62/62、严格像素 59/62，各配置的 62 张本机图跨阶段逐张相同。18 种裁剪组合通过。 | [逐配置的二进制、部署包和比较结果](./native-2d-m6-candidate-recheck.json) |
| 历史记录 `68af105c8d` · 性能 | Windows Release 六对交错。固定混合变更帧 CPU 下降 59.3%、JSB 下降 77.5%、JS 堆峰值下降 41.7%，强制 GC 中位数下降 1.8%。Web 完成 12 项同源负载。 | [逐轮数据](./native-2d-m6-performance-68af105c8d.json) |
| 生产绑定清理 | 删除 Sprite、Label 和 RichText 的 9 个未用 JSB 读回接口。Windows 双配置各通过 6 组 JSB 探针，108 张图与 Web 及上一节点逐字节一致 | [绑定清单、快照及二进制哈希](./native-2d-m6-binding-cleanup.json) |
| PoC 与遗留测试导出 | Windows 和 Web 重建包均无旧 PoC 入口或组件。Sprite 和 Label 清理 7 个内部或测试调用，Windows 双配置各通过 6 组 JSB 探针、1000 轮场景切换，116 张 GPU 图与 Web 逐字节一致 | [绑定清单、快照及二进制哈希](./native-2d-m6-binding-cleanup.json) |
| RichText 测试导出 | 删除 getSegmentLabel 和 getSegmentSprite。Windows Debug、Release 各通过六组 JSB 探针与 M2–M5。Web 旧工程检查 9 个 Label 和 1 个 Sprite。字体矩阵 42 项布局通过，严格像素 39/42，三组历史像素超差见本轮范围说明 | [绑定与快照记录](./native-2d-m6-binding-cleanup.json) |
| Sprite、Graphics 与 Label 测试读回 | Sprite、Graphics 的 `getRenderEntity` 和 Label 的 `getString` 已从生产 JSB 移除。Windows 双配置各通过六组 JSB 探针。Web 旧工程位图字体 92 张 GPU 图像通过 | [绑定与二进制哈希](./native-2d-m6-binding-cleanup.json) |
| Label 提交实体读回 | 生产 JSB 已移除 `Label.getRenderEntity`。Windows 双配置的正常应用检查测试绑定缺席，M2–M5 和各六组 JSB 探针通过。两种 Windows 配置各有 92 张位图字体图像与 Web 逐字节一致。47 项字体布局一致，严格像素仍为 44/47，各端字体图像与清理前逐字节一致 | [验收结果与二进制哈希](./native-2d-m6-binding-cleanup.json) |
| 原生 UIRenderer 与解析器测试入口 | 移除六个内部 JSB 成员、Sprite 重复的节点绑定及 Web 解析器测试全局入口。Windows 双配置各通过六组 JSB 探针和 M2–M5，各有 92 张位图图像与 Web 逐字节一致。Windows 和 Web 各 9 种功能组合无旧 PoC 导出 | [绑定清单及构建哈希](./native-2d-m6-binding-cleanup.json) |
| TTF 水平混排 | 同源 Arial、Thonburi 对 Windows Chrome 的原始画布，Windows Debug/Release 的常规及斜体 72/72，合成粗体 0/36。[32 个字形的分阶段重放](./native-2d-m6-bold-replay.json)显示仅更换掩码采样仍有偏差。40 项应用矩阵布局全同，严格图像 37/40。 | [字体哈希、样本和微基准](./native-2d-m6-text-spacing.json) |
| TTF 双向文本与泰文 | Windows Debug/Release 与 Web 的三张新增场景图逐字节一致。字体场景布局 40/40，严格像素 37/40。Arial 混排与小字号的原始画布差异另列 | [字形与场景实测](./native-2d-m6-bidi.json) |
| Label 多行阴影 | Windows Debug/Release 与 Web 的两组重叠硬阴影图像逐字节相同。字体矩阵布局 42/42，严格图像 39/42。 | [正负偏移采样与哈希](./native-2d-m6-multiline-shadow.json) |
| RichText 捕获校验 | Windows 双配置与 Chrome 的每张 RGBA 均通过采集时记录的 SHA-256 校验。双配置布局均为 42/42，严格像素均为 39/42。按通道差大于 1 统计，粗体有 448 个差异像素，绿色描边有 202 个，粗斜体嵌套有 553 个。描边全部差异集中在绿色通道，最大差值 30。分别改动原生图和 Web 图的一个字节，比较器均拒绝该图。 | [二进制与逐图哈希、RGBA 各通道差值](./native-2d-m6-richtext-capture-hashes.json) |
| CHAR 自动高度 | 旧场景 CJK Label 在 Windows Debug、Release 和 Web 均为 240×40。双行文本行高 19.125 时，三端高度均为 38.25，加 1.5 像素描边后均为 41.25。同场景的英文 TTF Label 加 3 像素描边后高度为 56.4。 | [旧场景](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)、[Windows 断言](../native/tests/2d-poc/run-m3-label-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| Label 阴影布局 | Windows Debug/Release 与 Web 的四种溢出模式共 24 组，布局与像素全部一致。含原 13 组 RichText，字体矩阵布局 37/37、严格图像 34/37。另有 88 张既有图形截图逐字节一致 | [逐图与构建数据](./native-2d-m6-label-shadow-layout.json) |
| Label 非零模糊与裁边 | Windows Debug、Release 的五张阴影图与 Web 逐字节一致。原有 42 张图各端哈希与清理节点相同。字体矩阵布局 47/47，严格图像 44/47 | [像素与裁边证据](./native-2d-m6-label-blur.json) |
| 本机 RichText 字体应用矩阵 | 候选 `244decdeb0` 重建 Windows 双配置与 Web。两种 Windows 配置各通过 47 项布局、44 项严格像素和 1000 次字体加载释放；三项已知超差按当前范围暂缓。三端的 47 张图各自与上一轮逐字节一致。HTTP 断流、主动取消及同 URL 重试通过 | [同一快照与构建哈希](./native-2d-m6-richtext-configurations.json) |
| 独立 TTF Bundle | 序列化 Label Prefab 在 Windows Debug、Release 和 Web 通过预加载、跨场景引用、完全卸载及冷重载。Web 修复最后一个资产释放后残留的 `FontFace` 注册。五张新增场景图和原有 150 张图均逐字节一致。 | [本地三端证据](./native-2d-m6-ttf-bundle.json) |
| 同名 HTTP TTF | 同名的 Thonburi 和 Open Sans 在 Windows 双配置与 Web 分别加载、独立渲染。两种释放顺序均保留存活字体的测宽，四张新增图逐字节一致。 | [请求和生命周期记录](./native-2d-m6-font-source-isolation.json) |
| TTF 预加载注册 | Web 仅预加载或丢弃 TTF 时均无注册，TTFFont 接管时注册并在最后释放时移除。Windows 双配置及 Web 通过真实 Bundle 缓存消费，Chrome 默认路径和强制 CSS 轮询的 155 张图逐字节一致。 | [预载和像素证据](./native-2d-m6-font-preload-ownership.json) |
| RichText 段节点与生命周期 | Windows Debug、Release 和 Web 各验证 64 个文字段、64 个图片段、32 轮回收重建和图集缓存释放。宿主换层时段跟随更新，四张新增图逐字节一致。 | [三端验收](./native-2d-m6-richtext-node-lifecycle.json) |
| RichText 激活事件重入 | Windows Debug、Release 和 Web 验证段激活回调清空内容、重建、经停用父节点重挂接及销毁宿主。既有字体图在各端逐张保持一致，布局 62/62，严格像素 59/62。 | [重入与字体回归](./native-2d-m6-richtext-reactivation.json) |
| RichText 相机与 Mask 输入 | Windows Debug、Release 和 Web 通过输入派发器完成 3 次按下、1 次取消和两个链接回调。覆盖偏移相机、变换后的祖先 Mask、反转和窗口筛选。62 张字体图和 155 张通用场景图各端哈希与前一候选一致。 | [事件序列与逐配置证据](./native-2d-m6-richtext-projected-input.json) |
| Label 的 TTF 小数字号 | Windows 双配置与 Web 用同一 Thonburi，依次设置 24、24.25、24.75、25、24 px。三端宽度最大差小于 0.000054 px，各次切换重绘，复位与初始图逐字节一致。既有 47 张图的各端哈希与上一轮一致，当前字体门禁通过 | [字号与快照数据](./native-2d-m6-richtext-configurations.json) |
| Label 零模糊阴影 | 固定尺寸、正负偏移两组，Windows Debug/Release 与 Web 的 GPU 轮廓检查均通过。原 13 张 RichText 图的各端哈希与上轮相同 | [场景及断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts) |
| RichText 动态编辑及未知 shadow 标签 | Windows Debug/Release 对 Web 的扩展矩阵布局 13/13，严格图像 10/13。新增用例的 3496 个着色像素与双色对照一致，原 12 项结果与上轮相同 | [逐项比较器](../native/tests/2d-poc/compare-richtext-gpu.cjs) |
| 定制 TTF | Windows Debug/Release、ASan 对 Web，布局 12/12，严格字形图像 9/12。粗体、描边、嵌套样式最大通道差分别为 20、30、47 | [逐图和配置数据](./native-2d-m6-richtext-configurations.json) |
| RichText 样式与交互 | Windows Debug/Release、Web 同场景验证未知 shadow 标签、双色样式、容器重排、点击、关闭触摸和销毁。47 张既有图像各端哈希一致 | [组合场景证据](./native-2d-m6.2-richtext-gpu.md#样式重排与触摸组合) |
| RichText 点击与解绑 | Windows Debug/Release、Web 均收到 first、second、second。命中后停止传播，未命中、关闭触摸、禁用组件和销毁组件后均继续传播且没有多余回调 | [真实事件夹具](../native/tests/2d-poc/fixtures/acceptance/RichTextProbe.ts)、[Windows 断言](../native/tests/2d-poc/run-m5-richtext-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| 线程边界 | Windows Debug/Release 实测分离设备线程，核对提交、异步加载和销毁路径 | [线程与同步报告](./native-2d-m6-threads.md) |
| Prefab 资产生命周期 | Windows Debug/Release、ASan 和 Web，各 1000 轮；检查引用、GPU 和活动场景持有者 | [数据与采集边界](./native-2d-m6-asset-lifetime.md) |
| 调度与裁剪 | Windows Debug/Release 交替启动 20 次通过；Windows 与 Web 的 18 个独立 Release bundle 导出通过 | [启动记录](./native-2d-m6-scheduling-results.json)、[构建矩阵](./native-2d-m6-feature-matrix.json) |
| 历史记录 · Graphics／Mask 回退 | Windows Debug 和 Release 各运行默认、TS 回退、恢复三阶段。每次 138 张图均与 Web 逐字节一致，22 项命中和 1000 轮场景切换通过。回退同时切换宿主 Sprite 的模板提交路径 | [三阶段构建哈希与耗时](./native-2d-m6-graphics-mask-rollback.json) |

## 字体像素诊断

Windows Debug、Release 将 Direct2D 字形与笔宽同步放大 3、4、7、16、64 倍，按比例调整扩张容差，再将笔画还原至原尺寸。以 Chrome 同字体画布为参考，四个字号的合成粗体和十二组圆角描边共 80 个对照，每个配置的超差像素数和最大 alpha 差均与原尺度相同。仅 24 px 粗体在 3 倍、7 倍时原始 RGBA 哈希变化。调整坐标尺度未改善这组用例，生产路径继续使用原尺度。[粗体逐图数据](./native-2d-m6-bold-replay.json)、[描边逐图数据](./native-2d-m6-stroke-replay.json)

Windows 圆角字体描边的轮廓扩张和边缘细分已分别测量。以 Chrome 的同源 Thonburi 为参考，1、4、8 像素笔宽各比较 25 种容差组合、4 个字号和 3 种字形样式。两个 Windows 配置的逐图哈希一致。4 像素笔宽的最少差异像素为 5112，生产设置为 5835；该组合使 12 像素正体的最大 alpha 差从 43 增至 49。三种笔宽的 900 次比较均未通过逐像素容差 1，生产参数继续使用 0.01。[对照结果](./native-2d-m6-stroke-tolerances.json)、[复现脚本](../native/tests/2d-poc/compare-ttf-stroke-tolerances.cjs)

CanvasKit 和 Direct2D 对同一组生产线段栅格化时，96 个掩码均出现差值大于 1 的采样点，累计 9167 个。用 CanvasKit 扩张并栅格化、再沿用原生混合时，12 张描边图有 7 张通过，其中 24 px 正体进入容差。改用 CanvasKit 扩张并继续用 Direct2D 填充时，12 张均超差。当前应用复测在 Windows 两种配置仍为布局 42/42、严格像素 39/42，各完成 1000 轮字体生命周期。扩张与覆盖计算均影响描边结果。[分阶段与应用数据](./native-2d-m6-ttf-canvaskit.json)

新一轮 Windows 双配置和 Chrome 对照中，先在局部坐标展开轮廓，再做横向四倍采样，alpha 超差像素从 40 降到 7，四张斜体图均进入 RGBA 容差。12 张诊断图中 9 张通过原背景的 RGBA 对照，透明背景通过 10 张。亚像素起点和裁剪对照保留同样的失败位置。该实验测量独立字形回放，应用结果见上表。[局部展开与透明对照](./native-2d-m6-ttf-scaler-stroke.json)

## 历史候选的待签收清单

以下为当前签收前记录的状态。各用例的候选版本和覆盖范围见[逐项计划](./native-2d-m6-plan.md)。

| 章节 | 节点 | 尚缺证据或已知失败 |
|---|---|---|
| M6.1 | 组件 API | 位图 Label 的 spacingX、fontSize、lineHeight 已通过 Windows 双配置与 Web 的细小增减、复位和自动尺寸对照。系统字体 Label 的 outlineWidth 和 shadowBlur 已通过三端描边尺寸与 SHRINK 临界字号对照。容器尺寸微调跨过缩放和换行临界点、行高微调回写均已通过三端验收。其余现行公开接口仍待逐项验收。[逐项计划](./native-2d-m6-plan.md) |
| M6.1 | 字体终态 | Windows DirectWrite 源文件替换、失败加载和释放已通过[独立进程验证](./native-2d-m6.1-font-alias-ownership.md#windows-directwrite-源文件释放)。Windows 双配置各完成 1000 轮应用内本地字体释放和 30 轮 HTTP 重复下载释放，源文件在采样点均可独占打开。[句柄分阶段记录](./native-2d-m6.1-font-alias-ownership.md#windows-应用内字体句柄) 其余旧资源生命周期、复杂文本及范围内的字形对照继续验收 |
| M6.1 | 复杂布局 | [补充平面 BMFont 标量已验证](./native-2d-m6-bitmap-unicode.json)，水平 TTF 字形已有上述 72 组常规/斜体验收，普通 TTF 的三种溢出模式已通过整词换行像素对照。含嵌套书写方向、泰文叠加标记、拉丁组合音标和控制空白的四组 TTF 段落与 Web 逐字节相同。其余复杂字形、位图字体复杂脚本、字体图集帧状态组合和配置更新继续验收。已安装的 16 px Arial 两行文本在 NONE 模式下的自然宽度已修正，Windows 双配置与 Chrome 均为 80.9453125。[Label 系统字体矩阵](./native-2d-m6-system-font.json) |
| M6.1 | 资源管线与生命周期 | 静态图集的帧克隆已通过源 Prefab 卸载和重载回归。该 Prefab 的预加载、图集依赖延迟、取消后重试已通过三端回归。同一 Prefab 已通过跨场景实例销毁、图集复用及最终缓存释放。Windows 双配置通过 HTTP 字体部分响应断线及同 URL 重试，Web 通过浏览器响应读取中断后重新加载字体。Windows 下载器已验证排队与传输中取消、失败时保留旧文件、清除不可续传的半文件和 Range 续传。Web 已验证 fetch 主动取消及续传。Web 引擎首次断流时返回回退字体，释放后同 URL 已成功重载并测得原字体宽度。其余现行格式资产和场景的资源生命周期仍待验收。[场景夹具](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts) |
| M6.2 | RichText 终态 | 固定布局、场景、视觉和输入回归已通过当前范围。`CHILD_ADDED` 回调修改宿主锚点后，Windows Debug、Release 和 Chrome 均使用新锚点，并验证段节点包装对象的身份与后续位置。当前布局 62/62、严格像素 59/62。剩余资源与极限对象生命周期、其他 Node wrapper 场景及最终候选复验继续验收。[锚点回归证据](./native-2d-m6-richtext-anchor-during-attach.json) |
| M6.4 | 字体文件独占阻断 | Debug 原目录字体文件门禁第 998 轮失败；独立诊断捕获有效字体释放后的瞬时共享冲突，来源未确定。独立目录复测通过不覆盖此项失败。[日志与对照](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md) |
| M6.4 | UIOpacity 启停已修复 | Debug/Release 真实组件及原生回归通过，禁用期间保持 1，重新启用应用保存的新值。[修复复验](../native/tests/2d-poc/build/m6-uiopacity-fix-20261123T152115Z/summary.md) |
| M6.4 | 平台矩阵待验收 | 按调整后的核心组件用例清单，在同一最终候选上构建 Windows Debug、Release，逐项核对 JSB／Native 现行场景的渲染、字体、事件和资源生命周期。记录各配置产物及结果，macOS、iOS、Android 和 OHOS 仍暂缓、待验证。 |
| M6.5 | 当前功能包检查通过 | `554d747561` 的 Native TS、18 套件／119 项 Native 断言、17 类基线、43 项薄壳、部署边界审计及双配置 272 个调用窗口通过。完整工程 M2–M5、千轮图集及 20 次交替启动通过。字体文件稳定性和其余行为签收仍见各自节点。[当前证据](../native/tests/2d-poc/build/m6-remaining-554d747561/summary.md) |
| M6.5 | 最终签收 | 待上述阻断项清零，在同一候选上汇总完整日志 |

2026-11-24 修正 V8 属性读取期间的接收对象生命周期后，Windows Debug、Release GPU 应用各一次完成离线 RichText 场景。两侧 58 张 RGBA 捕获逐字节相同，各完成 32 轮分段生命周期、64 轮淘汰及 4 轮包装对象 GC 与重建。应用使用原失败版本的已部署脚本，在独立副本中将输出重定向，并在字体别名和 HTTP 用例前返回；进程在生成结果后由启动器结束。最终候选的重复运行、自然退出和历史崩溃归因继续待验。[配置、哈希与计数](./native-2d-m6-offline-richtext-lifecycle.json)
