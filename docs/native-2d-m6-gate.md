# Native 2D M6 Gate

**NO-GO。** Windows Release 候选 `3b6a4f3c9b` 的固定混合变更帧四项性能指标已达标。Windows 自定义字体仍有三组图像超过 Web 像素容差，组件兼容、CI 和旧项目回退等节点仍待签收。最终签收须在同一候选重跑必需配置和场景。

验收范围为 Windows Debug、Windows Release 和 Web。JSB + Native 禁用动态合图，Web 启用。Windows RichText 内部分段仅通过原生组件查询。macOS、iOS、Android、OHOS 暂缓验收。

## 已测结果

| 项目 | 配置和结果 | 证据 |
|---|---|---|
| M6.4 所有权 | 已核对 17 类的组件挂接、资源借用与回调。Windows 双配置各通过 6 组 JSB 探针，Debug、Release、ASan Debug 各完成 1000 次场景切换和 88 张 Web 像素对照。 | [逐类记录](./native-2d-m6.4-ownership.md)、[快照和二进制哈希](./native-2d-m6.4-ownership-results.json) |
| Graphics 命令提交 | Windows Debug/Release 与 Web 像素对照。Release 的 256 个闭合路径从逐调用改用复用缓冲，提交耗时中位数从 581.7 降至 349.1 µs，批次和绘制次数均为 1 | [接口选择与分配实测](./native-2d-m6.3-graphics-commands.md) |
| 混合负载 CPU | `3b6a4f3c9b` Windows Release 六对交错，混合变更帧从迁移前 7.0153 降至 2.3045 ms/帧，下降 67.2%。两端复用同一份 Windows 场景资源，Web 完成 12 项同源负载。 | [六对实测](./native-2d-m6-performance-3b6a4f3c9b.json)、[测量及复现](./native-2d-m6-performance.md#windows-release-候选-3b6a4f3c9b) |
| JSB、堆峰值与 GC | 同六对 Windows Release 样本，JSB 为 876 → 197 次/帧，堆峰值为 30,132,734 → 17,507,898 字节，强制 GC 为 10.6235 → 4.6710 ms。GC 四对改善，两对上升。 | [逐对及中位数](./native-2d-m6-performance-3b6a4f3c9b.json)、[早期 V8 诊断](./native-2d-m6-gc-trace.json) |
| 薄壳与稳态 JSB | 14 个 override 均在行数预算内；17 类检查 2D 内部间接导入。Label 与 RichText 的布局、栅格化及命中计算在原生执行。Windows 双配置每组 60 帧的组件直接调用均为 0，共享 manager 每帧 1 次。同步变更、显式调用和销毁分别计数 | [组件与节点生命周期](./native-2d-m6-jsb-lifecycle.json)、[六种独立资产](./native-2d-m6-jsb-assets.json)、[逐项计划](./native-2d-m6-plan.md) |
| Graphics/Mask 材质与提交成本 | Windows Debug、Release 和 Web。32 个矩形在一个 Graphics 中为 1 次 draw，分属 32 个 Graphics 时为 32 次；单层和双层 Mask 分别为 3 次和 5 次。共享纹理完成首次上传后，三个测量阶段均为 0 字节重复上传 | [材质隔离与图像](./native-2d-m6-windows-web-gpu-results.json)、[CPU、批次与上传](./native-2d-m6.3-graphics-cost.md) |
| 图形与事件 | Windows Debug 和 Release 各 88 张图像与 Web 逐字节一致，覆盖旧图集 Prefab、SpriteRenderer 生成网格和两个 Sprite stencil 独立交换阈值。场景矩阵同时检查合批、跨根节点命中与场景切换。此前 ASan 覆盖 80 张 | [GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json) |
| 组件身份与绑定清理 | Mask 的 Sprite stencil 复用宿主 Sprite。测试绑定清理后，Windows Debug 和 Release 各 88 张图像与 Web 逐字节一致。Windows 双配置的 V8 探针验证三个绑定已移除。UITransform 销毁和替换的节点缓存通过 Windows 双配置和 Web 检查 | [图像与绑定结果](./native-2d-m6-mask-sprite-stencil.json)、[UITransform 探针](../native/tests/2d-poc/build-layout-probe.cjs) |
| UITransform 同级排序 | Windows Debug、Release 和 Web 对分数优先级、同值顺序和重挂接的节点顺序、同级索引及渲染结果一致。完整图形矩阵在两种 Windows 配置各 92 张与 Web 逐字节一致 | [本轮数据](./native-2d-m6-ui-transform-priority.json) |
| Sprite 径向填充 | Web 的中心分量修改现会刷新图形。Windows Debug 和 Release 各 102 张图与 Web 逐字节一致，含新增 10 张径向图、运行时旋转图集帧变更及旧 Prefab | [GPU 读回与哈希](./native-2d-m6-sprite-radial-gpu.json) |
| Sprite 九宫格 | 两端对小于边距总和的节点按轴压缩边框。运行中改边距后更新顶点分区。Windows Debug 和 Release 各 108 张图与 Web 逐字节一致，含缩小、改边距及旋转帧的 6 张图 | [修复前后对照](./native-2d-m6-sprite-sliced-gpu.json) |
| Sprite 平铺 | Windows 原生按帧边距平铺中心区。Windows Debug、Release 各 116 张图与 Web 逐字节一致，新增 8 张涵盖尺寸、旋转、零宽中心、单轴边距及运行时改边距 | [修复前后数据](./native-2d-m6-sprite-tiled-gpu.json) |
| SpriteFrame 自定义多边形 | Windows Debug、Release 与 Web 通过旧序列化拓扑、独立克隆、换纹理与实际 SpriteRenderer 像素检查。119 张图逐字节一致，116 张既有图各端哈希与基准相同 | [输入与逐图证据](./native-2d-m6.1-sprite-frame.md#旧序列化多边形) |
| 生产绑定清理 | 删除 Sprite、Label 和 RichText 的 9 个未用 JSB 读回接口。Windows 双配置各通过 6 组 JSB 探针，108 张图与 Web 及上一节点逐字节一致 | [绑定清单、快照及二进制哈希](./native-2d-m6-binding-cleanup.json) |
| PoC 与遗留测试导出 | Windows 和 Web 重建包均无旧 PoC 入口或组件。Sprite 和 Label 清理 7 个内部或测试调用，Windows 双配置各通过 6 组 JSB 探针、1000 轮场景切换，116 张 GPU 图与 Web 逐字节一致 | [绑定清单、快照及二进制哈希](./native-2d-m6-binding-cleanup.json) |
| RichText 测试导出 | 删除 getSegmentLabel 和 getSegmentSprite。Windows Debug、Release 各通过六组 JSB 探针与 M2–M5。Web 旧工程检查 9 个 Label 和 1 个 Sprite。字体矩阵 42 项布局通过，严格像素 39/42，历史三组字体差异仍待签收 | [绑定与快照记录](./native-2d-m6-binding-cleanup.json) |
| TTF 水平混排 | 同源 Arial、Thonburi 对 Windows Chrome 的原始画布，Windows Debug/Release 的常规及斜体 72/72，合成粗体 0/36。[32 个字形的分阶段重放](./native-2d-m6-bold-replay.json)显示仅更换掩码采样仍有偏差。40 项应用矩阵布局全同，严格图像 37/40。 | [字体哈希、样本和微基准](./native-2d-m6-text-spacing.json) |
| TTF 双向文本与泰文 | Windows Debug/Release 与 Web 的三张新增场景图逐字节一致。字体场景布局 40/40，严格像素 37/40。Arial 混排与小字号的原始画布差异另列 | [字形与场景实测](./native-2d-m6-bidi.json) |
| Label 多行阴影 | Windows Debug/Release 与 Web 的两组重叠硬阴影图像逐字节相同。字体矩阵布局 42/42，严格图像 39/42。 | [正负偏移采样与哈希](./native-2d-m6-multiline-shadow.json) |
| RichText 捕获校验 | Windows 双配置与 Chrome 的每张 RGBA 均通过采集时记录的 SHA-256 校验。双配置布局均为 42/42，严格像素均为 39/42。按通道差大于 1 统计，粗体有 448 个差异像素，绿色描边有 202 个，粗斜体嵌套有 553 个。描边全部差异集中在绿色通道，最大差值 30。分别改动原生图和 Web 图的一个字节，比较器均拒绝该图。 | [二进制与逐图哈希、RGBA 各通道差值](./native-2d-m6-richtext-capture-hashes.json) |
| CHAR 自动高度 | 旧场景 CJK Label 在 Windows Debug、Release 和 Web 均为 240×40。双行文本行高 19.125 时，三端高度均为 38.25，加 1.5 像素描边后均为 41.25。同场景的英文 TTF Label 加 3 像素描边后高度为 56.4。 | [旧场景](../native/tests/2d-poc/fixtures/acceptance/LabelSpike.ts)、[Windows 断言](../native/tests/2d-poc/run-m3-label-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| Label 阴影布局 | Windows Debug/Release 与 Web 的四种溢出模式共 24 组，布局与像素全部一致。含原 13 组 RichText，字体矩阵布局 37/37、严格图像 34/37。另有 88 张既有图形截图逐字节一致 | [逐图与构建数据](./native-2d-m6-label-shadow-layout.json) |
| Label 非零模糊与裁边 | Windows Debug、Release 的五张阴影图与 Web 逐字节一致。原有 42 张图各端哈希与清理节点相同。字体矩阵布局 47/47，严格图像 44/47 | [像素与裁边证据](./native-2d-m6-label-blur.json) |
| Label 零模糊阴影 | 固定尺寸、正负偏移两组，Windows Debug/Release 与 Web 的 GPU 轮廓检查均通过。原 13 张 RichText 图的各端哈希与上轮相同 | [场景及断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts) |
| RichText 动态编辑及未知 shadow 标签 | Windows Debug/Release 对 Web 的扩展矩阵布局 13/13，严格图像 10/13。新增用例的 3496 个着色像素与双色对照一致，原 12 项结果与上轮相同 | [逐项比较器](../native/tests/2d-poc/compare-richtext-gpu.cjs) |
| 定制 TTF | Windows Debug/Release、ASan 对 Web，布局 12/12，严格字形图像 9/12。粗体、描边、嵌套样式最大通道差分别为 20、30、47 | [逐图和配置数据](./native-2d-m6-richtext-configurations.json) |
| RichText 样式与交互 | Windows Debug/Release、Web 同场景验证未知 shadow 标签、双色样式、容器重排、点击、关闭触摸和销毁。47 张既有图像各端哈希一致 | [组合场景证据](./native-2d-m6.2-richtext-gpu.md#样式重排与触摸组合) |
| RichText 点击与解绑 | Windows Debug/Release、Web 均收到 first、second、second。命中后停止传播，未命中、关闭触摸、禁用组件和销毁组件后均继续传播且没有多余回调 | [真实事件夹具](../native/tests/2d-poc/fixtures/acceptance/RichTextProbe.ts)、[Windows 断言](../native/tests/2d-poc/run-m5-richtext-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| 线程边界 | Windows Debug/Release 实测分离设备线程，核对提交、异步加载和销毁路径 | [线程与同步报告](./native-2d-m6-threads.md) |
| 旧 Prefab 资产生命周期 | Windows Debug/Release、ASan 和 Web，各 1000 轮；检查引用、GPU 和活动场景持有者 | [数据与采集边界](./native-2d-m6-asset-lifetime.md) |
| 调度与裁剪 | Windows Debug/Release 交替启动 20 次通过；Windows 与 Web 的 18 个独立 Release bundle 导出通过 | [启动记录](./native-2d-m6-scheduling-results.json)、[构建矩阵](./native-2d-m6-feature-matrix.json) |

## 尚需签收的节点

Windows Debug、Release 将 Direct2D 字形与笔宽同步放大 3、4、7、16、64 倍，按比例调整扩张容差，再将笔画还原至原尺寸。以 Chrome 同字体画布为参考，四个字号的合成粗体和十二组圆角描边共 80 个对照，每个配置的超差像素数和最大 alpha 差均与原尺度相同。仅 24 px 粗体在 3 倍、7 倍时原始 RGBA 哈希变化。调整坐标尺度未改善这组用例，生产路径继续使用原尺度。[粗体逐图数据](./native-2d-m6-bold-replay.json)、[描边逐图数据](./native-2d-m6-stroke-replay.json)

Windows 圆角字体描边的轮廓扩张和边缘细分已分别测量。以 Chrome 的同源 Thonburi 为参考，1、4、8 像素笔宽各比较 25 种容差组合、4 个字号和 3 种字形样式。两个 Windows 配置的逐图哈希一致。4 像素笔宽的最少差异像素为 5112，生产设置为 5835；该组合使 12 像素正体的最大 alpha 差从 43 增至 49。三种笔宽的 900 次比较均未通过逐像素容差 1，生产参数继续使用 0.01。[对照结果](./native-2d-m6-stroke-tolerances.json)、[复现脚本](../native/tests/2d-poc/compare-ttf-stroke-tolerances.cjs)

CanvasKit 和 Direct2D 对同一组生产线段栅格化时，96 个掩码均出现差值大于 1 的采样点，累计 9167 个。用 CanvasKit 扩张并栅格化、再沿用原生混合时，12 张描边图有 7 张通过，其中 24 px 正体进入容差。改用 CanvasKit 扩张并继续用 Direct2D 填充时，12 张均超差。当前应用复测在 Windows 两种配置仍为布局 42/42、严格像素 39/42，各完成 1000 轮字体生命周期。描边生产路径仍需同时核对扩张与覆盖计算。[分阶段与应用数据](./native-2d-m6-ttf-canvaskit.json)

新一轮 Windows 双配置和 Chrome 对照中，先在局部坐标展开轮廓，再做横向四倍采样，alpha 超差像素从 40 降到 7，四张斜体图均进入 RGBA 容差。12 张诊断图中 9 张通过原背景的 RGBA 对照，透明背景通过 10 张。亚像素起点和裁剪对照保留同样的失败位置。该实验测的是独立字形回放，真实应用的严格像素 Gate 仍待签收。[局部展开与透明对照](./native-2d-m6-ttf-scaler-stroke.json)

编号采用计划章节；同一行中的不同验收条件均须满足。各已验收子项、夹具及历史版本记录见[逐项计划](./native-2d-m6-plan.md)。

| 章节 | 节点 | 尚缺证据或已知失败 |
|---|---|---|
| M6.1 | 组件 API | 位图 Label 的 spacingX、fontSize、lineHeight 已通过 Windows 双配置与 Web 的细小增减、复位和自动尺寸对照。系统字体 Label 的 outlineWidth 和 shadowBlur 已通过三端描边尺寸与 SHRINK 临界字号对照。容器尺寸微调跨过缩放和换行临界点、行高微调回写均已通过三端验收。其余公开及兼容入口仍待验收。[逐项计划](./native-2d-m6-plan.md) |
| M6.1 | 字体终态 | Windows DirectWrite 源文件替换、失败加载和释放已通过[独立进程验证](./native-2d-m6.1-font-alias-ownership.md#windows-directwrite-源文件释放)。集成进程的句柄波动、其余平台句柄清理、复杂文本及严格字形对照仍待核查 |
| M6.1 | 复杂布局 | [补充平面 BMFont 标量已验证](./native-2d-m6-bitmap-unicode.json)，水平 TTF 字形已有上述 72 组常规/斜体验收。段落换行与方向嵌套、位图字体复杂脚本、任意 mesh、packed 组合和配置更新继续验收。已安装的 16 px Arial 两行文本在 NONE 模式下的自然宽度已修正，Windows 双配置与 Chrome 均为 80.9453125。[Label 系统字体矩阵](./native-2d-m6-system-font.json) |
| M6.1 | 旧资产边界 | 旧静态图集的帧克隆已通过源 Prefab 卸载和重载回归。该 Prefab 的预加载、图集依赖延迟、取消后重试已通过三端回归。同一旧 Prefab 已通过跨场景实例销毁、图集复用及最终缓存释放。Windows 双配置通过 HTTP 字体部分响应断线及同 URL 重试，Web 通过浏览器响应读取中断后重新加载字体。Windows 下载器已验证排队与传输中取消、失败时保留旧文件、清除不可续传的半文件和 Range 续传。Web 已验证 fetch 主动取消及续传。Web 引擎首次断流时返回回退字体，释放后同 URL 已成功重载并测得原字体宽度。其余旧资产仍待验收。[场景夹具](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts) |
| M6.2 | RichText 终态 | 完整 Node wrapper、极限对象生命周期及三组失败字形。[同一轮廓重放](./native-2d-m6.2-ttf-stroke.md#同一字形轮廓按绘制阶段重放)已将独立绿色描边的主要误差定位至轮廓扩张。8 个矩形的圆弧填充可逐字节重现浏览器画笔，三次贝塞尔圆角累计 308 个采样点超差。生产路径仍待修复 |
| M6.4 | 平台矩阵 | Windows 两种配置的严格字体检查失败 |
| M6.5 | CI | [PR 工作流](../.github/workflows/native-ts-build.yml)已配置 Windows Debug/Release 的六组真实 JSB 检查、场景记录和 SIMPLE Sprite 对 Web 的几何对照。两个 Windows 配置均已接入 Chrome 字形对照并归档 108 项结果。正体和斜体在本机通过 72/72，合成粗体通过 0/36。独立的矩形粗体 I 检查已接入同一矩阵，本机两种配置各通过 256/256 个分数起点。工作流还构建 Windows、Web 各九种 Release 功能组合，检查组件导出和已移除的 PoC 入口，并归档导出清单与 bundle 哈希。仍缺远程运行记录、完整应用场景矩阵及其余间接热路径的证据 |
| M6.5 | 回退 | 已验证 [UIOpacity](./native-2d-m6-ui-opacity-rollback.md)、[RenderRoot2D](./native-2d-m6-render-root-rollback.md)、[RichText](./native-2d-m6-richtext-rollback.md)、[Sprite](./native-2d-m6-sprite-rollback.md) 和 [Label](./native-2d-m6-label-rollback.md) 回退与恢复。Sprite 和 Label 已在两种 Windows 配置的旧 cocos-m1-test 工程验证。其余模块的旧项目场景、资产、材质及性能仍待验证 |
| M6.5 | 最终签收 | 待上述阻断项清零，在同一候选上汇总完整日志 |
