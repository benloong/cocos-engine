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
