# Windows 2D 帧提交与线程边界

Windows GLES3 的 Debug 和 Release 日志均在真实设备消费者线程绑定上下文后输出 `Device thread detached.`，随后完成资源加载、位图 GPU 捕获和组件销毁后的点击检查。两份应用日志的哈希、行号、二进制哈希见[运行记录](./native-2d-m6-thread-results.json)。Web 作为行为和像素对照。

| 时机 | 执行位置与可读数据 | 生命周期边界 |
|---|---|---|
| 帧开始 | JS 驱动的主线程进入 Root::frameMove，先处理延迟销毁，再执行 Batcher2d::update。walk 在这里读 Node、UITransform、RenderEntity 和组件状态，并同步调用 prepare。 | 节点树、组件指针和绑定开放的可变数据在这一阶段消费。 |
| 上传与提交 | 同一次 frameMove 调用 uploadBuffers、更新描述符、执行 pipeline render、present，最后 reset。 | 组件的几何在 uploadBuffers 前须保持有效。reset 清除本帧借用的 DrawInfo、当前实体和合批状态。 |
| 设备线程 | BufferAgent::update 在消息入队前把数据复制到缓冲区的分帧 staging、队列内存或单独分配的内存。纹理上传把 regions 和各层像素拷入随消息持有的 allocator。 | 设备线程读取消息中的数据和 GFX actor。BufferDestroy 对 staging 的所有权随消息转移，纹理上传消息执行后释放 allocator。 |
| 帧边界 | DeviceAgent::present 发布消息，推进分帧索引，并使用信号量限制在途帧。 | 提交下一帧不要求主线程同步等待 GPU 空闲。复用 staging 时按设备帧索引分段。 |
| 异步资源 | Windows CURL 下载线程产出完成任务。DownloaderCURL::onSchedule 从完成队列取出结果，在调度器执行回调。HttpClient 使用 performFunctionInCocosThread 投递响应。 | 字体注册、资产赋值和后续 Label/图集变更走主线程回调。已销毁帧拒绝迟到的纹理依赖。 |

帧顺序见 [Root](../native/cocos/core/Root.cpp) 和 [Batcher2d](../native/cocos/2d/renderer/Batcher2d.cpp)。设备交接见 [BufferAgent](../native/cocos/renderer/gfx-agent/BufferAgent.cpp)、[DeviceAgent](../native/cocos/renderer/gfx-agent/DeviceAgent.cpp)。资源完成路径见 [DownloaderCURL](../native/cocos/network/Downloader-curl.cpp)、[HttpClient](../native/cocos/network/HttpClient.cpp) 和 [Scheduler](../native/cocos/base/Scheduler.cpp)。

## 行为验证

- 切换场景 1000 次，验证持久节点、跨根命中、失效纹理、最终根注册表；禁用 RenderRoot 后销毁，另覆盖 Mask 禁用后销毁及同级渲染恢复。Windows Debug/Release、ASan 和 Web 有对应的实际图形检查。[逐场景断言与图像](./native-2d-m6-windows-web-gpu-results.json)
- 加载实际 Prefab 及其图集、帧和纹理，实例化后渲染，释放资源并向保留的已销毁 frame wrapper 再次投递纹理。千轮检查覆盖缓存、延迟销毁和 GPU 输出。[生命周期数据](./native-2d-m6-asset-lifetime.json)、[夹具](../native/tests/2d-poc/fixtures/acceptance/StaticAtlasProbe.ts)
- 本机两种构建及 ASan 完成字体异步下载、缓存读取、失败回调和释放。自定义字体三项严格像素差异仍单列在字体门禁。[字体配置数据](./native-2d-m6-richtext-configurations.json)

这些测试覆盖上述运行路径。独立的资源取消语义、组件间裸指针逐类所有权和 CPU 指标仍由对应计划项验收。
