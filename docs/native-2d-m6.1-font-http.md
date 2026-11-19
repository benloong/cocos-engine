# M6.1 HTTP 字体缓存路径与文档工程验收

> 2026-11-17。TTFFont 保留原始资产 URL，在加载 native 字节时解析已下载的本地缓存路径。验收以指定的 cocos-m1-test Windows Debug 工程为准。

## 修复

native adapter 的 HTTP downloader 返回本地缓存文件，font parser 注册该文件的 family；工厂创建资产时仍以原始 HTTP URL 设置 nativeUrl。此前 TTFFont.onLoaded 把 URL 当作本地路径读取，得到空字节并导致工厂失败。

现在 HTTP/HTTPS 来源先查询 cacheManager.getCache，再尝试 getTemp；本地来源保持原路径。资产 nativeUrl/UUID 不改写，实际来源与字节继续由 C++ TTFFont 持有。相同路径和已加载数据不重复读取，缓存换源后重新加载；released 资产在查询缓存前即返回。没有新增每帧 JSB 调用或 shared_ptr。

## 文档工程验收

遵循 [构建与验收流程](./native-2d-build-and-acceptance.zh-CN.md)：确认 CLI engine junction 指向 v4，构建 cocos-m1-test Windows，tools/build-engine.cjs 输出 CCBUILD_DONE，同步 data→Debug/Resources，再通过 MSVC/CMake 编译 Debug app。用户确认恢复无 SpriteFrame.native property 的方案；getter 已移除，源码审计通过。

按同一流程更新了旧阶段探针，而非恢复迁移前的 CPU 纹理缓存：M4 Graphics 使用隔离 GPU readPixels，GRAPHICS_STENCIL 通过 Mask.subComp 绘制真实几何；保留原像素阈值，并检查几何非空。M5 读取真实原生 Label/Sprite 段，保留 JS 子组件计数诊断，增加字号/粗斜体/下划线与 hit/miss 检查。三份探针位于 fixtures/acceptance，由 sync-acceptance-probes.cjs 同步到测试工程，保留其原有 meta UUID。

首次总门禁发现 PoC 重载夹具在系统 TEMP 的 8.3 路径下创建目录被拒绝。夹具改为在自身输出工作目录创建/删除独占临时文件，释放和文件删除断言保留；异常会记录并使测试失败，不再无诊断退出。quad 入口保留原始日志，并删除旧 JSON 以拒绝陈旧输出。应用验收脚本显式使用隐藏窗口。

验证记录包括 M0 总门禁、M2 像素、M3 Label、M4 Mask/Graphics、M4 extra、M5 RichText、M6.1 UV 和文档定向 Jest。结果及日志/源码/测试工程产物 SHA256 见 [验收数据](./native-2d-m6.1-font-http-results.json)。后续改动统一执行文档流程，通过后再提交；定向 PoC/GPU/ASAN 仅作补充。

## 补充证据与边界

缓存/临时路径、换源和 released 回调的 4 个 suite、52 项通过。恢复无 native getter 之前的定向 HTTP 应用快照 dfa775480014f46b36b064423aff383525441e9e960bec199f2cb27009cab425 中，普通/ASAN 各完成 1000 次本地资源循环与真实 loopback HTTP 下载、渲染、释放、缓存文件移除和 404 回调；服务端各记录字体请求 2 次（HEAD/GET）、404 请求 5 次（重试）。渲染宽度 95.9765625，字节 223404，普通/ASAN manifest/RGBA 共 13 文件一致，stderr 0 字节。该历史补充快照不作为当前完整候选的验收替代。

loopback 夹具只监听 127.0.0.1，子进程绕过本地代理，应用写入目录隔离到工作区；在当前执行环境需允许 loopback，沙箱拒绝时不能把连接失败解释为字体错误。HTTPS/TLS、取消/断流与失败半文件回收、创建前无主 alias、完整 bundle/旧场景/Prefab、其他平台和长期 heap 仍待验收。内部原生段节点的 JS 组件查询兼容性亦未关闭。严格 RichText 像素仍为 9/12；本轮基础功能通过不代表 M6 收口。

### 部分响应与同 URL 重试

loopback 服务声明 223404 字节，首次 GET 写出 4096 字节后关闭连接。Windows Debug 和 Release 的首次 loadRemote 均拒绝，URL 缓存为空，资产数和字体别名计数与请求前一致。两种配置重试均取得完整字体，测量宽度为 95.9765625，提交纹理包含可见字形，释放后缓存文件消失。Web 用 fetch 验证 200 响应的正文读取失败，再用引擎 loadRemote 加载同 URL。三个运行各观测到一次中断和一次完整 GET。客户端主动取消和 Web 引擎首次加载的实测结果见下文。

两种 Windows 配置分别对照同一 Web 捕获，布局 12/12、严格像素 9/12。粗体、描边、嵌套样式的最大通道差依次为 20、30、47。

### 客户端取消与 Windows 文件替换

候选快照 78115fb9bbf7cceca497ecbe9385ca1eb8760babe2aedcfe8238c730e1591ba5 在 Windows Debug 和 Release 均通过。对已有目标文件发起下载时，404 和传输中取消均保留原文件。并发上限为 1 时，排队任务取消返回 −4，服务端收到该 URL 的请求数为 0。正在传输的任务在 4096 字节处取消并返回 −4。同一目标重试从该偏移发起 Range 请求，合并后的 223404 字节与原字体逐字节一致，临时文件已清除。资产管理器对不可续传的断流和 404 报错后，磁盘缓存目录的文件清单与请求前一致。每种配置的字体加载释放各 1000 轮，资产缓存计数均为 22 → 22。

Web 通过 AbortController 取消正文读取，从相同偏移请求余下内容，校验完整字体 SHA-256。Windows 取消入口为现有 JSB Downloader.abort。两种 Windows 配置的 12 项布局及逐图像素结果与改动前一致，严格像素仍为 9/12。

### Web 引擎断流与同 URL 重载

Chrome 中首次通过 assetManager.loadRemote 获取 TTF 时，服务端在 4096 字节处断开。引擎返回具有原始别名的字体资产并回退到系统字体。释放该资产后，改动前的同 URL 重试仍以等宽字体绘制，24 px 的 “Atlas 123” 实测宽度为 108 px。仅删除失败的 CSS 规则再插入时，服务端收到的完整 GET 数为 0。

支持 FontFace 的浏览器现在为新请求创建独立对象，加载完成后才将它加入 document.fonts。FontFace 使用原始别名，Canvas 字体描述使用 CSS 序列化名称。并发请求共享加载结果，超时后的旧回调无法覆盖新请求。不支持该接口的浏览器使用原有的宽度轮询，超时会移除失败的样式和预加载元素。

同一夹具重试后收到一次完整 GET，“Atlas 123” 的宽度恢复到 95.9765625 px，并完成 12 张自定义字体图像捕获。Web 应用的 92 项位图捕获通过。轮询分支的超时回调内重试由 Jest 覆盖。
