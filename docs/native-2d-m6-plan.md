# Native 2D M6 剩余任务与终态验收

> 更新：2026-11-17。范围沿用[总计划](./native-2d-module-sinking-plan.zh-CN.md)，仅 `cocos/2d` 及必要的 native/绑定/构建支持。
> 状态：**未收口**。M2、M3、M4、M5 的阶段通过记录不代表整个模块满足终态薄壳契约。SpriteFrame 数据/UV、SpriteAtlas map/native 表已有 Windows 定向证据，不代表全平台、完整资源场景或性能 KPI 通过。
> 本文是 M6 剩余任务与终态门禁的统一清单；历史数据保留在各阶段 report/gate 中。
> 所有权约束：M6 原生 2D 代码禁止 shared_ptr/weak_ptr。值成员、unique_ptr、IntrusivePtr 与非 owning 指针分别标明拥有者；借用者必须在拥有者销毁前解绑或收到同步失效通知。

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
- [ ] 完成非 2D 边界重入/动态导入的实际构建产物审计，以及逐组件稳态 JSB trace 基线；源码调用点不能替代运行计数，终态门禁继续归 M6.5。
- [x] 已观察到的壳残留：移除 Label lateUpdate 高度轮询；原生统一管理布局尺寸并由 UITransform 在变化时推送缓存/事件；Label/Graphics 内置材质由原生解析。Windows Debug/Release 实际 JSB、1000 次静止 prepare 与定向测试通过，见 [报告](./native-2d-m6.0-layout-material.md)。全模块稳态调用门禁继续归 M6.5。
- [x] 新增 2D 元数据维护入口：仓库内脚本从六个 Web 资产声明生成补丁，由 native-binding/decorators 重导出；补齐产物检查、生成器/元数据测试与 native-ts-build CI。组件壳使用源码装饰器；历史外部生成器归属未推断，见 [维护说明](./native-2d-m6.0-metadata.md)。

交付：组件矩阵、残留清单、基线版本/环境/命令和原始数据。

### M6.1 资产与状态一致性

- [x] Label 序列化基础兼容：恢复 Web 的字体/系统字体字段、样式/效果/24 个默认值，补旧格式 deserialize/Details 回填与 instantiate 回归；初始化样式传给 native，普通 TTF 下划线厚度与实际字号通过 Windows Debug/Release 联调，见 [报告](./native-2d-m6.1-label-serialization.md)。
- [x] Sprite 壳声明与基础材质/状态兼容：六个缺口、fillRange 默认值/条形负范围、atlas/trim/grayscale/事件、native 材质变体与真正 MaterialInstance、帧/材质持有、尺寸/Node 变化和零填充清理已补，Windows Debug/Release 实际 JSB 与定向测试通过，见 [报告](./native-2d-m6.1-sprite-api.md)。
- [x] Sprite radial 与可变 fillCenter：归一化中心、角度方向、矩形边界三角形、rotated UV 和 flip 行为已修复；fillCenter 分量读写直接桥接 native，加载/克隆/销毁保持视图契约。3024 组实际 Web assembler 与 native CPU 几何对照、Windows Debug/Release 定向测试通过，见 [报告](./native-2d-m6.1-radial.md)。
- [x] Sprite/Label 材质槽 API 与提交：补数组整体赋值/缩短/清空、加载前引用、forceUpdate、实例 owner 解绑；native 区分显式空槽和恢复内置材质，Label 实际 DrawInfo 跟随槽和实例变化。Windows Debug/Release、实际 JSB 与 Web 定向对照通过，见 [报告](./native-2d-m6.1-material-slots.md)。
- [ ] 完整组件 parity：Label 其余公开/兼容接口；材质数组原地修改/重编译回调与 Asset 延迟销毁语义，以及真实场景/Prefab 和资源管线继续验收。radial CPU 几何通过不替代 GPU 像素验收。

- [x] SpriteFrame 基础数据/算法：quad/sliced UV 迁入 native；rotated、flip、insets、pivot、meshType、packable、clone/reset 与基础静态 API 已补实现，UV 对照与 Windows 定向回归通过，见 [报告](./native-2d-m6.1-sprite-frame.md)。
- [x] SpriteFrame 基础状态：rect/offset/originalSize/pivot 使用 native 可写视图；setter、分量修改、反序列化、克隆和 native 回读不再依赖 JS 权威镜像，Sprite/Mask/BMFont 有原生消费者联动测试。
- [ ] SpriteFrame 扩展与场景验收：动态合图打包/恢复、mesh/vertices/ensureMeshData 等完整 API parity；真实资源/旧场景/prefab 和 GPU 像素回归。基础数据通过不替代这些验收。
- [x] SpriteAtlas 表同步：可观察 map 的整体赋值/修改、同名替换、null、remove/clear、Details 依赖回填与 getTexture 顺序已同步到 native；迟到回填隔离、原生引用持有/释放和 Windows 实际 JSB 壳联调通过，见 [报告与写入契约](./native-2d-m6.1-sprite-atlas.md)。真实资源/场景加载仍归下方独立验收项。
- [ ] 验证两个 prototype 资产的构造身份、Asset 初始化、ccclass/属性元数据、实例间独立状态与原生回调；保存的原生方法必须在同一实例上调用且无递归。
- [x] TTFFont/LabelAtlas/BitmapFont 基础数据与生命周期：原生持有 TTF 字节/family/source、BMFont 配置/glyph/kerning/SpriteFrame；Label 直接持有字体资产并检测 revision，移除逐字形 JSB 传输；切换/清空/销毁、共享引用、实际 JSB 壳及 Windows Debug/Release 定向验证通过。补齐 deserialize/Details 依赖回填，修复 null 默认值 family 在快速反序列化中被当作对象，JIT/非 JIT 回归通过，见 [报告与边界](./native-2d-m6.1-font-assets.md)。
- [x] 字体重载一致性补充：独立配置版本使同内容原生重载失效旧 JS 视图，同时保留依赖回填期间的编辑；released 后忽略迟到 onLoaded。Windows Debug/Release C++ 与实际 JSB 探针、7 个 Jest suite（58 项）通过，见字体资产报告。
- [x] 字体重复生命周期补充：released 后的 JS 配置/TTF 加载赋值直接忽略；三类字体各 1000 次 native 创建、清空、重载、销毁，以及 BitmapFont/LabelAtlas 各 1000 次实际 JSB 循环通过 Windows Debug/Release。当时字体测试入口为 7 个 suite、64 项，后续新增测试见字体资产报告；直接创建资产的循环不替代 asset-manager 加载卸载或泄漏验收。
- [x] Windows 自定义字体选择：GDI 拒绝真实 Thonburi.ttf 后回退，现以私有 DirectWrite collection 加载、shaping 和绘制；明确 COM/缓冲区所有权，Debug/Release 各 1000 次释放计数及 64 项 Jest、ASAN 应用通过。该节点 RichText 当时为 9/12 布局一致、严格图像 0/12，见 [报告与未关闭门禁](./native-2d-m6.1-directwrite-fonts.md)。
- [ ] 字体终态验收：真实字体资源/旧场景/Prefab、完整资源加载释放、跨平台 alias/字体句柄与注册表清理、复杂文本和 GPU 对照。TTF 原生字节已持有，渲染仍使用现有 Canvas 平台后端，基础数据通过不替代这些验收。
- [x] Windows 字体注册表补充：修复单参越界、同 alias 重载不替换和无效绝对路径误注册；脚本引擎 cleanup 释放表。Debug/Release 实际 JSB、1000 次同名重载和临时字体文件释放回归通过。本节点仅覆盖 runtime 清理，逐资产机制见下一项，跨平台仍归字体终态项，见 [报告](./native-2d-m6.1-font-registry.md)。
- [x] Windows TTFFont 逐资产 alias：native 记录明确持有者与来源代次，独立渲染身份隔离同名换源；共享释放、最后持有者清理、两种换源销毁顺序及迟到释放通过。Debug/Release 各 1000 轮 native/实际 JSB、49 项 Jest、10 项静态检查与同快照真实加载/释放、ASAN 应用通过；严格图像仍 9/12，完整异步/跨平台仍待验收，见 [实现与边界](./native-2d-m6.1-font-alias-ownership.md)。
- [x] 字体工厂失败回滚：native 空字节/赋值异常销毁半成品并回调错误，Factory 同步异常清理等待队列、支持同 ID 重试并隔离旧回调；16 个 suite、120 项和 Debug/Release 实际 JSB 故障探针通过。创建前无主 alias、完整异步下载与跨平台仍待验收，见 [报告](./native-2d-m6.1-font-factory-failure.md)。
- [x] Windows 本地 TTFFont 真实资源循环：Debug 普通/ASAN 应用各 1000 次 loadRemote/releaseAsset 与缓存身份检查，逐轮字节/alias/缓存恢复、失败回滚与同 URL 重试、缺失源拒绝和最终延迟销毁通过；当前源码完整引擎 JS 重建，图像仍 9/12。长期 heap、HTTP/bundle、BMFont/LabelAtlas 与跨平台仍待验收，见 [证据](./native-2d-m6.1-font-remote-lifecycle.md)。
- [x] 字体数据边界补充：BitmapFont/LabelAtlas 拒绝溢出 float、非法 glyph/kerning 与重复字形，失败保留 native 数据、版本和 JS 编辑视图；TTFFont 销毁后 initDefault 不再改写状态。Windows Debug/Release native 与实际 JSB 定向回归通过，见 [字体资产报告](./native-2d-m6.1-font-assets.md)。
- [x] 字体字号入口复核：BitmapFont/LabelAtlas 忽略非有限字号及 JSB float 溢出，保留默认/零/小数语义；重复赋值、销毁后迟到赋值保持版本稳定。Windows Debug/Release native 与实际 JSB、7 个 Jest suite（68 项）通过，见字体资产报告。
- [ ] 动态合图：确认迁移范围、纹理/UV 更新和回退策略，验证 Sprite/Label/Mask 联动。按需迁移项须有范围结论与证据，不能默认为完成。
- [ ] 补旧资产/场景/prefab 加载、instantiate/clone、延迟依赖解析、重复加载释放的原生回归。

交付：资产 parity 报告和真实资源回归日志。prototype 改造本身不等于资产下沉验收完成。

### M6.2 RichText 达到终态薄壳

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
- [ ] 完成上述原生路径的终态 API、布局、场景、视觉与用户事件回归；资源/极限对象生命周期和完整 Node wrapper 联调继续验收。
- [ ] 将现有 color/b/i/u、size/br/outline、img/imageAtlas、contentSize、hit/miss 用例迁为固定 Web/native 回归；补 shadow、嵌套样式、复杂对齐/最大宽度、动态更新、点击事件分发与销毁后解绑。
- [ ] 保留 Windows GDI italic 宽度的已接受差异；平台、字体、用例、布局容差分别记录。现有 colored ±20% 只作 sanity，不能替代布局、字形、事件验收。

交付：native 解析/布局测试、场景对照、壳审计。M5 的文本/图片渲染闭环继续有效，不能用它替代本项。

### M6.3 Graphics/Mask 完整性（承接 M4.3）

- [x] 原生几何核心准备：多子路径/增量 fill-stroke、曲线细分、单环 Earcut（含 Z-order、局部交点修复与拆分）、lineJoin/lineCap/miterLimit 网格生成；786 组实际 Web helper/assembler 对照在 g++ 与 Windows MSVC Debug/Release 通过，含 5000 点复杂填充，另验证 80000 顶点的 32-bit 索引。见 [报告](./native-2d-m6.3-graphics-geometry.md)。现已接入下述运行时基础路径，不能替代 GPU 像素/性能验收。
- [x] 原生 Graphics 网格提交基础接入：移除 CPU pixels/Texture/Sprite 兼容路径，使用独立 mesh chunks、graphics 距离顶点布局与 local UBO；80000 顶点分块并实际上传 GPU buffer。Mask rect/ellipse/custom 改用几何，Sprite stencil 保留资产纹理；JS 移除 getFrame/lateUpdate 轮询。显式拥有者/借用通知、CHAR 缓存注册表租用、Windows Debug/Release 实际 JSB 和定向回归通过，见 [运行时报告](./native-2d-m6.3-graphics-runtime.md)。
- [x] Windows Debug 应用 GPU 定向对照：独立相同场景/脚本经真实 Batcher、shader/local UBO、Camera、stencil 和 readPixels 捕获 40 例，Web/native 全通道差值 0；含大尺寸/缩放/3D 旋转、曲线/多路径、9 类描边、80000 顶点 Graphics/Mask、嵌套/inverted/空 Mask 与 alphaThreshold。修复 deprecated graphics→subComp、VERTEX alpha 和两端空嵌套 stencil 配对，见 [报告、结果与待办](./native-2d-m6.3-graphics-gpu.md)。本快照含未提交的已有 SpriteFrame native getter 改动，未作为 M6 最终候选验收。
- [ ] 完成替换后的真实 GPU 绘制与缩放、大尺寸、复杂/多子路径像素回归；实际 Batcher/graphics shader/Camera/UBO 链路和混合场景须验证，buffer 上传通过不替代此门禁。
- [x] Mask radius 与动态几何状态：半径归原生所有，圆角限幅/更新、尺寸/anchor 更新、rect→ellipse 已通过真实 GPU 对照；扩展夹具 48/48 图像全通道差值 0，见 [状态与命中报告](./native-2d-m6.4-mask-state-hit.md)。动态资产、完整混合场景和跨平台仍待验收。
- [ ] 完成 lineJoin/lineCap/miterLimit、roundRect、ellipse、arc、曲线、填充/描边、clear 的场景/GPU 验收。几何对照和 JSB 参数桥接已补，实际像素仍待验收。
- [ ] 对比逐 API JSB 与命令批量提交的 CPU、调用次数、分配和绘制成本；用数据选择接口。JS 允许纯命令收集，不允许路径算法/三角化。
- [ ] 验证 Mask 四类形状、inverted、嵌套与 stencil 恢复、alphaThreshold、segments、尺寸和资产动态切换，补混合 Sprite/Label/Graphics 场景。
- [ ] 复核 Graphics/Mask 的材质选择归属、stencil material 和所有权；补 draw call、合批、纹理上传量与性能报告。

交付：M4.3 补充报告、像素对照与性能结论。兼容光栅化基础通过不等于本项完成。

### M6.4 事件、生命周期与硬化

- [x] 原生命中基础链路：Mask.isHit 仅传世界坐标；原生计算圆角/椭圆/反向边界，UITransform 筛选 Camera windowId/layer/离屏并查询当前祖先 Mask。Windows Debug/Release 绑定及生命周期回归、真实场景 19/19 命中检查通过，含 disable/reparent/destroy；见状态与命中报告。完整事件/多 root/Camera/平台矩阵仍由下一项验收。
- [ ] hit test：覆盖 Camera/坐标转换、旋转缩放、层级、多个 root、嵌套 Mask、启停与销毁；JS 可分发事件，几何命中使用 native。
- [ ] RenderRoot2D：补多 root/多 Canvas/多 Camera、顺序、启停、重复注册、销毁/场景切换回归；Canvas/Camera/Widget/View 继续保留 JS，不迁移其功能。
- [x] RenderRoot2D 注册基础硬化：Node 销毁通知、Batcher 独占观察 link、遍历范围强引用快照、重复注册/排序/回调期间变更、跨 root batch/stencil 清理；Windows Debug/Release 与 1000 次 plain Node 注册/释放通过。单 Camera 下两个 root/Canvas 的启停/重排/销毁 GPU 对照通过，扩展夹具 58 图像差值 0、11 注册和 19 命中检查通过；见 [报告与剩余矩阵](./native-2d-m6.4-render-root-lifecycle.md)。不关闭上一项的真实场景/多 Camera/平台门禁。
- [x] Windows Scene/多 Camera 定向矩阵：修复 Graphics 在 onLoad 前丢命令和从未激活实例的 backend 清理；普通 Debug/ASAN 与 Web 同快照 74 图像差值 0，1000 次实际 director 切换、动态纹理创建销毁与 4998 项循环断言通过。见 [报告与边界](./native-2d-m6.4-scene-matrix.md)；不是完整 asset-manager、泄漏、Release GPU 或平台验收。
- [ ] 所有 native 组件/资产核对 attach/detach、Node 非 owning 槽位、RenderEntity/DrawInfo、纹理、字体缓存及回调所有权。
- [ ] 主线程修改与渲染线程读取的快照/同步边界明确；覆盖场景切换、异步资源完成、禁用后销毁。
- [ ] 连续加载/卸载 1000 次，无新增泄漏/崩溃；采集 native/JS 堆、引用数和 GC，支持的平台执行 ASan/LeakSanitizer 或等价工具并记录覆盖限制。
- [ ] Win/macOS/iOS/Android/OHOS 的 Debug/Release 构建和关键渲染/字体/事件场景逐格验收；没有运行证据的格子标“待验证”。
- [ ] 验证模块裁剪/构建组合，覆盖 2d、rich-text、mask、graphics 及现有相关开关；不扩大不下沉模块的范围。

交付：平台矩阵、生命周期/泄漏/线程报告和可定位的失败项。

### M6.5 性能、回退与最终 Gate

- [ ] 固定候选版本、场景、硬件、构建模式、预热/采样方法，与 Web/迁移前基线同口径对照；覆盖 1000 Sprite、200 Label、50 Mask、RichText 及混合负载。
- [ ] 达成总计划 KPI：2D 组件准备/更新与合批 CPU 时间下降 ≥50%，每帧 JSB 调用下降 ≥70%，JS 堆峰值下降 ≥30%，GC 改善；native `Batcher2d` 成本必须纳入，不能以 JS update 直接返回作为收益。
- [ ] 迁移组件稳态每帧 JSB 调用 0；属性变更、生命周期和用户显式 API 调用单独统计。常规壳 ≤300 行，Label/RichText ≤500 行（按总计划排除版权、纯类型、deprecated 转发）；超限先移除算法，不能仅压缩排版。
- [ ] 扩展现有 `check-thin-shell.js` 等检查，覆盖全部迁移类和间接热路径；CI 执行 Web TS/Jest、native TS、native 构建与组件/场景回归。
- [ ] 按组件/模块演练回退，验证 override、依赖资产、材质与旧场景可用；回退后记录行为与性能。
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
| 稳定性与平台 | 1000 次加载卸载、无新增泄漏/崩溃、线程边界、全平台 Debug/Release 矩阵 | 仅 Windows 功能通过 |
| 工具链与回退 | 绑定/元数据可复现、CI/裁剪组合通过、组件/模块回退演练 | 手工补元数据后本机可运行 |

全部阻断项通过后才能将 M6 和整个 Native 2D 下沉标为终态完成。任何新增容差或范围豁免必须明确记录用例、影响和决策；尚未确认的差异继续列为待处理。

## 4. 范围保持不变

- JS Component 身份、生命周期调度、注册和序列化保留；完整 Component 下沉不进入 M6，参见[评估结论](./native-2d-m6-component-eval.md)。
- `cocos/ui` 不迁移；Canvas/Camera/Widget/View、UIMeshRenderer/UIMesh/UISkew 保持 JS；弃用的 UIStaticBatch 不实现。
- Web 实现保留完整功能；native 差异通过 override 接入。历史实现中为 parity 修改过的 Web 行为仍需回归，不能据此放宽 Web 兼容要求。
