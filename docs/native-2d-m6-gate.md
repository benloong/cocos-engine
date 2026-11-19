# Native 2D M6 Gate

**结论：NO-GO。** 下表的三轮 最新 CPU 采样版本为 `dfd1b03028`，补充平面字形修复版本为 `53af40d18f`。Windows Release 混合负载 CPU 超出预算；Windows 自定义字体有三组图像超过 Web 像素容差。其余未完成项目列在下表。最终签收需要在同一候选上重跑必需的配置和场景。

验收范围为 Windows Debug、Windows Release 和 Web。JSB + Native 禁用动态合图，Web 启用。Windows RichText 内部分段仅通过原生组件查询。macOS、iOS、Android、OHOS 暂缓验收。

## 已测结果

| 项目 | 配置和结果 | 证据 |
|---|---|---|
| Graphics 命令提交 | Windows Debug/Release 与 Web 像素对照。Release 的 256 个闭合路径从逐调用改用复用缓冲，提交耗时中位数从 581.7 降至 349.1 µs，批次和绘制次数均为 1 | [接口选择与分配实测](./native-2d-m6.3-graphics-commands.md) |
| 混合负载 CPU | Windows Release 三轮。迁移前 4.5881 ms，候选 6.3762 ms，目标 ≤2.2941 ms，失败 | [方法与版本](./native-2d-m6-performance.md)、[逐负载数据](./native-2d-m6-performance-label.json) |
| JSB、堆峰值与 GC | 同一负载下 JSB 876→196，堆峰值下降 43.22%，强制 GC 7.943→4.277 ms | [三轮数据](./native-2d-m6-performance-label.json) |
| 稳态组件 JSB | Windows，13 组组件及资产消费者与空 Canvas 对照，各采样 60 帧 | [逐方法计数与对照](./native-2d-m6.0-windows-jsb-trace.md) |
| Graphics/Mask 材质与提交成本 | Windows Debug、Release 和 Web。32 个矩形在一个 Graphics 中为 1 次 draw，分属 32 个 Graphics 时为 32 次；单层和双层 Mask 分别为 3 次和 5 次。共享纹理完成首次上传后，三个测量阶段均为 0 字节重复上传 | [材质隔离与图像](./native-2d-m6-windows-web-gpu-results.json)、[CPU、批次与上传](./native-2d-m6.3-graphics-cost.md) |
| 图形与事件 | Windows Debug 和 Release 各 85 张图像与 Web 逐字节一致，覆盖旧图集 Prefab、SpriteRenderer 生成网格和两个 Sprite stencil 独立交换阈值。场景矩阵同时检查合批、跨根节点命中与场景切换。此前 ASan 覆盖 80 张 | [GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json) |
| 定制 TTF | Windows Debug/Release、ASan 对 Web，布局 12/12，严格字形图像 9/12。粗体、描边、嵌套样式最大通道差分别为 20、30、47 | [逐图和配置数据](./native-2d-m6-richtext-configurations.json) |
| RichText 点击与解绑 | Windows Debug/Release、Web 均收到 first、second、second。命中后停止传播，未命中、关闭触摸、禁用组件和销毁组件后均继续传播且没有多余回调 | [真实事件夹具](../native/tests/2d-poc/fixtures/acceptance/RichTextProbe.ts)、[Windows 断言](../native/tests/2d-poc/run-m5-richtext-probe.ps1)、[Web 断言](../native/tests/2d-poc/run-dynamic-atlas-web.cjs) |
| 线程边界 | Windows Debug/Release 实测分离设备线程，核对提交、异步加载和销毁路径 | [线程与同步报告](./native-2d-m6-threads.md) |
| 旧 Prefab 资产生命周期 | Windows Debug/Release、ASan 和 Web，各 1000 轮；检查引用、GPU 和活动场景持有者 | [数据与采集边界](./native-2d-m6-asset-lifetime.md) |
| 调度与裁剪 | Windows Debug/Release 交替启动 20 次通过；Windows 与 Web 的 18 个独立 Release bundle 导出通过 | [启动记录](./native-2d-m6-scheduling-results.json)、[构建矩阵](./native-2d-m6-feature-matrix.json) |

## 尚需签收的节点

编号采用计划章节；同一行中的不同验收条件均须满足。各已验收子项、夹具及历史版本记录见[逐项计划](./native-2d-m6-plan.md)。

| 章节 | 节点 | 尚缺证据或已知失败 |
|---|---|---|
| M6.1 | 组件 API | Label 其余入口、材质数组原地更新/重编译及延迟销毁 |
| M6.1 | 字体终态 | 平台句柄清理、复杂文本及严格字形对照 |
| M6.1 | 复杂布局 | [补充平面 BMFont 标量已验证](./native-2d-m6-bitmap-unicode.json)，尚缺双向文本及 shaping、任意 mesh、packed 组合和配置更新 |
| M6.1 | 旧资产边界 | 异步取消、延迟依赖、克隆和跨场景生命周期 |
| M6.2 | RichText 终态 | 完整 Node wrapper、极限对象生命周期及三组失败字形 |
| M6.2 | RichText 固定回归 | shadow、样式、布局、用户事件和销毁解绑的完整组合 |
| M6.4 | 所有权审计 | 全组件及资产的 attach/detach、借用指针和回调逐类核查 |
| M6.4 | 平台矩阵 | Windows 两种配置的严格字体检查失败 |
| M6.5 | 性能 KPI | 混合变更负载比迁移前慢 38.97% |
| M6.5 | 薄壳约束 | 全类行数与排除规则、变更和生命周期调用统计 |
| M6.5 | CI | 全部迁移类、间接热路径与组件/场景回归的 CI 证据 |
| M6.5 | 回退 | 分模块回退后的旧场景行为、资产、材质与性能 |
| M6.5 | 最终签收 | 待上述阻断项清零，在同一候选上汇总完整日志 |
