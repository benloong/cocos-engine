# Native 2D M6 Gate

**NO-GO。** Windows Release 固定混合变更帧已达到约定的 CPU、JSB、JS 堆和 GC 指标。Windows 自定义字体仍有三组图像超过 Web 像素容差，组件兼容、CI 和旧项目回退等节点仍待签收。最终签收须在同一候选重跑必需配置和场景。

验收范围为 Windows Debug、Windows Release 和 Web。JSB + Native 禁用动态合图，Web 启用。Windows RichText 内部分段仅通过原生组件查询。macOS、iOS、Android、OHOS 暂缓验收。

## 已测结果

| 项目 | 配置和结果 | 证据 |
|---|---|---|
| M6.4 所有权 | 已核对 17 类的组件挂接、资源借用与回调。Windows 双配置各通过 6 组 JSB 探针，Debug、Release、ASan Debug 各完成 1000 次场景切换和 88 张 Web 像素对照。 | [逐类记录](./native-2d-m6.4-ownership.md)、[快照和二进制哈希](./native-2d-m6.4-ownership-results.json) |
| Graphics 命令提交 | Windows Debug/Release 与 Web 像素对照。Release 的 256 个闭合路径从逐调用改用复用缓冲，提交耗时中位数从 581.7 降至 349.1 µs，批次和绘制次数均为 1 | [接口选择与分配实测](./native-2d-m6.3-graphics-commands.md) |
| 混合负载 CPU | Windows Release 六轮交错，混合变更帧从迁移前 6.8325 降至 2.6102 ms/帧，下降 61.8%。逐对五轮达到 50%，另一轮为 49.56%。同轮改动前为 3.4167 ms/帧。不同文本零命中时，独立进程中位数变慢 1.3182 ms，同进程交替复测的配对差为 −0.0441 ms。 | [六轮逐项数据](./native-2d-m6-line-raster-performance.json) |
| JSB、堆峰值与 GC | 同组混合变更帧 JSB 为 876 → 197 次/帧，JS 堆峰值为 30,109,940 → 17,110,074 字节，强制 GC 为 6.5685 → 4.6475 ms。每轮每场景每阶段测量一次强制 GC。 | [同轮数据](./native-2d-m6-line-raster-performance.json) |
| 薄壳与稳态 JSB | 14 个 override 均在行数预算内；17 类检查 2D 内部间接导入。Label 与 RichText 的布局、栅格化及命中计算在原生执行。Windows 双配置每组 60 帧的组件直接调用均为 0，共享 manager 每帧 1 次。同步变更、显式调用和销毁分别计数 | [组件与节点生命周期](./native-2d-m6-jsb-lifecycle.json)、[六种独立资产](./native-2d-m6-jsb-assets.json)、[逐项计划](./native-2d-m6-plan.md) |
| Graphics/Mask 材质与提交成本 | Windows Debug、Release 和 Web。32 个矩形在一个 Graphics 中为 1 次 draw，分属 32 个 Graphics 时为 32 次；单层和双层 Mask 分别为 3 次和 5 次。共享纹理完成首次上传后，三个测量阶段均为 0 字节重复上传 | [材质隔离与图像](./native-2d-m6-windows-web-gpu-results.json)、[CPU、批次与上传](./native-2d-m6.3-graphics-cost.md) |
| 图形与事件 | Windows Debug 和 Release 各 88 张图像与 Web 逐字节一致，覆盖旧图集 Prefab、SpriteRenderer 生成网格和两个 Sprite stencil 独立交换阈值。场景矩阵同时检查合批、跨根节点命中与场景切换。此前 ASan 覆盖 80 张 | [GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json) |
| TTF 双向文本与泰文 | Windows Debug/Release 与 Web 的三张新增场景图逐字节一致。字体场景布局 40/40，严格像素 37/40。Arial 混排与小字号的原始画布差异另列 | [字形与场景实测](./native-2d-m6-bidi.json) |
| Label 阴影布局 | Windows Debug/Release 与 Web 的四种溢出模式共 24 组，布局与像素全部一致。含原 13 组 RichText，字体矩阵布局 37/37、严格图像 34/37。另有 88 张既有图形截图逐字节一致 | [逐图与构建数据](./native-2d-m6-label-shadow-layout.json) |
| Label 零模糊阴影 | 固定尺寸、正负偏移两组，Windows Debug/Release 与 Web 的 GPU 轮廓检查均通过。原 13 张 RichText 图的各端哈希与上轮相同 | [场景及断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6RichTextMatrix.ts) |
| RichText 动态编辑及未知 shadow 标签 | Windows Debug/Release 对 Web 的扩展矩阵布局 13/13，严格图像 10/13。新增用例的 3496 个着色像素与双色对照一致，原 12 项结果与上轮相同 | [逐项比较器](../native/tests/2d-poc/compare-richtext-gpu.cjs) |
| 定制 TTF | Windows Debug/Release、ASan 对 Web，布局 12/12，严格字形图像 9/12。粗体、描边、嵌套样式最大通道差分别为 20、30、47 | [逐图和配置数据](./native-2d-m6-richtext-configurations.json) |
| RichText 点击与解绑 | Windows Debug/Release、Web 均收到 first、second、second。命中后停止传播，未命中、关闭触摸、禁用组件和销毁组件后均继续传播且没有多余回调 | [真实事件夹具](../native/tests/2d-poc/fixtures/acceptance/RichTextProbe.ts)、[Windows 断言](../native/tests/2d-poc/run-m5-richtext-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| 线程边界 | Windows Debug/Release 实测分离设备线程，核对提交、异步加载和销毁路径 | [线程与同步报告](./native-2d-m6-threads.md) |
| 旧 Prefab 资产生命周期 | Windows Debug/Release、ASan 和 Web，各 1000 轮；检查引用、GPU 和活动场景持有者 | [数据与采集边界](./native-2d-m6-asset-lifetime.md) |
| 调度与裁剪 | Windows Debug/Release 交替启动 20 次通过；Windows 与 Web 的 18 个独立 Release bundle 导出通过 | [启动记录](./native-2d-m6-scheduling-results.json)、[构建矩阵](./native-2d-m6-feature-matrix.json) |

## 尚需签收的节点

编号采用计划章节；同一行中的不同验收条件均须满足。各已验收子项、夹具及历史版本记录见[逐项计划](./native-2d-m6-plan.md)。

| 章节 | 节点 | 尚缺证据或已知失败 |
|---|---|---|
| M6.1 | 组件 API | 位图 Label 的 spacingX、fontSize、lineHeight 已通过 Windows 双配置与 Web 的细小增减、复位和自动尺寸对照。系统字体 Label 的 outlineWidth 和 shadowBlur 已通过三端描边尺寸与 SHRINK 临界字号对照。容器尺寸微调跨过缩放和换行临界点、行高微调回写均已通过三端验收。其余公开及兼容入口仍待验收。[逐项计划](./native-2d-m6-plan.md) |
| M6.1 | 字体终态 | Windows DirectWrite 源文件替换、失败加载和释放已通过[独立进程验证](./native-2d-m6.1-font-alias-ownership.md#windows-directwrite-源文件释放)。集成进程的句柄波动、其余平台句柄清理、复杂文本及严格字形对照仍待核查 |
| M6.1 | 复杂布局 | [补充平面 BMFont 标量已验证](./native-2d-m6-bitmap-unicode.json)，尚缺双向文本及 shaping、任意 mesh、packed 组合和配置更新。两行 Arial 在 NONE 模式下自然宽度为 Windows 79、Web 80.9453125，见 [Label 布局实测](./native-2d-m6-windows-web-gpu-results.json) |
| M6.1 | 旧资产边界 | 旧静态图集的帧克隆已通过源 Prefab 卸载和重载回归。该 Prefab 的预加载、图集依赖延迟、取消后重试已通过三端回归。同一旧 Prefab 已通过跨场景实例销毁、图集复用及最终缓存释放。Windows 双配置通过 HTTP 字体部分响应断线及同 URL 重试，Web 通过浏览器响应读取中断后重新加载字体。Windows 下载器已验证排队与传输中取消、失败时保留旧文件、清除不可续传的半文件和 Range 续传。Web 已验证 fetch 主动取消及续传。Web 引擎首次断流时返回回退字体，释放后同 URL 已成功重载并测得原字体宽度。其余旧资产仍待验收。[场景夹具](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts) |
| M6.2 | RichText 终态 | 完整 Node wrapper、极限对象生命周期及三组失败字形。[同一轮廓重放](./native-2d-m6.2-ttf-stroke.md#同一字形轮廓按绘制阶段重放)已将独立绿色描边的主要误差定位至轮廓扩张。8 个矩形的圆弧填充可逐字节重现浏览器画笔，三次贝塞尔圆角累计 308 个采样点超差。生产路径仍待修复 |
| M6.2 | RichText 固定回归 | shadow、样式、布局、用户事件和销毁解绑的完整组合 |
| M6.4 | 平台矩阵 | Windows 两种配置的严格字体检查失败 |
| M6.5 | CI | [PR 工作流](../.github/workflows/native-ts-build.yml)已配置 Windows Debug/Release 的六组真实 JSB 检查、场景记录和 SIMPLE Sprite 对 Web 的几何对照。工作流还构建 Windows、Web 各九种 Release 功能组合，检查组件导出和已移除的 PoC 入口，并归档导出清单与 bundle 哈希。仍缺远程运行记录、完整应用场景矩阵及其余间接热路径的证据 |
| M6.5 | 回退 | 已验证 [UIOpacity](./native-2d-m6-ui-opacity-rollback.md)、[RenderRoot2D](./native-2d-m6-render-root-rollback.md) 和 [RichText](./native-2d-m6-richtext-rollback.md) 回退与恢复。其余模块与真实旧项目的场景、资产、材质及性能仍待验证 |
| M6.5 | 最终签收 | 待上述阻断项清零，在同一候选上汇总完整日志 |
