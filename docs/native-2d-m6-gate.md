# Native 2D M6 Gate

**结论：NO-GO。** 当前运行时代码为 `cfe140f062`。Windows Release 混合负载 CPU 超出预算；Windows 自定义字体有三组图像超过 Web 像素容差。其余未完成项目列在下表。最终签收需要在同一候选上重跑必需的配置和场景。

验收范围为 Windows Debug、Windows Release 和 Web。JSB + Native 禁用动态合图，Web 启用。Windows RichText 内部分段仅通过原生组件查询。macOS、iOS、Android、OHOS 暂缓验收。

## 已测结果

| 项目 | 配置和结果 | 证据 |
|---|---|---|
| 混合负载 CPU | Windows Release 三轮。迁移前 4.5881 ms，候选 6.0933 ms，目标 ≤2.2941 ms，失败 | [方法与版本](./native-2d-m6-performance.md)、[逐负载数据](./native-2d-m6-performance-pages.json) |
| JSB、堆峰值与 GC | 同一负载下 JSB 876→196，堆峰值下降 43.21%，强制 GC 7.943→3.967 ms | [三轮数据](./native-2d-m6-performance-pages.json) |
| 稳态组件 JSB | Windows，13 组组件及资产消费者与空 Canvas 对照，各采样 60 帧 | [逐方法计数与对照](./native-2d-m6.0-windows-jsb-trace.md) |
| 图形与事件 | Windows Debug/Release、ASan、Web，80 份图形捕获逐像素一致；覆盖合批、遮罩、混合顺序、跨根节点命中和场景切换 | [GPU 矩阵](./native-2d-m6-windows-web-gpu-results.json) |
| 定制 TTF | Windows Debug/Release、ASan 对 Web，布局 12/12，严格字形图像 9/12。粗体、描边、嵌套样式最大通道差分别为 20、30、47 | [逐图和配置数据](./native-2d-m6-richtext-configurations.json) |
| 旧 Prefab 资产生命周期 | Windows Debug/Release、ASan 和 Web，各 1000 轮；检查引用、GPU 和活动场景持有者 | [数据与采集边界](./native-2d-m6-asset-lifetime.md) |
| 调度与裁剪 | Windows Debug/Release 交替启动 20 次通过；Windows 与 Web 的 18 个独立 Release bundle 导出通过 | [启动记录](./native-2d-m6-scheduling-results.json)、[构建矩阵](./native-2d-m6-feature-matrix.json) |

## 尚需签收的节点

编号采用计划章节；同一行中的不同验收条件均须满足。各已验收子项、夹具及历史版本记录见[逐项计划](./native-2d-m6-plan.md)。

| 章节 | 节点 | 尚缺证据或已知失败 |
|---|---|---|
| M6.1 | 组件 API | Label 其余入口、材质数组原地更新/重编译及延迟销毁 |
| M6.1 | SpriteFrame | mesh、vertices、ensureMeshData 与旧资源 GPU |
| M6.1 | 字体终态 | 平台句柄清理、复杂文本及严格字形对照 |
| M6.1 | 复杂布局 | 补充平面字符、双向文本及 shaping、任意 mesh、packed 组合和配置更新 |
| M6.1 | 旧资产边界 | 异步取消、延迟依赖、克隆和跨场景生命周期 |
| M6.2 | RichText 终态 | 完整 Node wrapper、极限对象生命周期及三组失败字形 |
| M6.2 | RichText 固定回归 | shadow、样式、布局、用户事件和销毁解绑的完整组合 |
| M6.3 | Graphics 提交 | 逐 API 与批量命令在相同输入下的 CPU、调用、分配和绘制对照 |
| M6.3 | Graphics/Mask 材质 | stencil 所有权、绘制次数及纹理上传量 |
| M6.4 | 所有权审计 | 全组件及资产的 attach/detach、借用指针和回调逐类核查 |
| M6.4 | 线程边界 | 核实主线程变更、渲染读取、延迟完成和禁用后销毁的时序 |
| M6.4 | 平台矩阵 | Windows 两种配置的严格字体检查失败 |
| M6.5 | 性能 KPI | 混合变更负载比迁移前慢 32.81% |
| M6.5 | 薄壳约束 | 全类行数与排除规则、变更和生命周期调用统计 |
| M6.5 | CI | 全部迁移类、间接热路径与组件/场景回归的 CI 证据 |
| M6.5 | 回退 | 分模块回退后的旧场景行为、资产、材质与性能 |
| M6.5 | 最终签收 | 待上述阻断项清零，在同一候选上汇总完整日志 |
