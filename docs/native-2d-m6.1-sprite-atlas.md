# M6.1 SpriteAtlas JS/native 表一致性

> 更新：2026-11-16。JSB map 写入、反序列化依赖回填、顺序与 native 引用持有已完成定向闭环。Windows Debug/Release 的实际 JSB 壳 + C++ 表验证通过；不代表整个 M6、真实资源/Prefab 或跨平台验收完成。

## 1. 实现

- SpriteAtlas 仍直接导出 jsb.SpriteAtlas，通过 native-binding/decorators 注册元数据；没有恢复包装对象或 SpriteFrame.native。
- spriteFrames accessor 返回独立的空原型 Proxy 字典；赋值、删除和数据属性 defineProperty 同步调用原生表接口。getSpriteFrame/getSpriteFrames 读取该映射，getTexture/getSpriteFrameCount 读取同步后的 native 表。
- 整体替换通过 setSpriteFrames 一次提交名称/资产数组。C++ 先持有新引用再替换旧表，覆盖重命名、多名称共享同一 frame、null 与 clear；null 是保留名称的空槽位，也计入命名槽位数。
- JS Object.keys 的顺序显式传给 native，含整数键优先规则。getTexture 与 Web 一样使用第一个可枚举槽位；首槽位为 null 或没有 texture 时返回 null，不跳到后面的有效纹理。
- 反序列化先按文件顺序登记 null 槽位，再让 Details/asset-manager 对代理字典回填 frame。空 UUID 保留空槽位，不发起空依赖请求；依赖乱序完成不会改变名称顺序。
- clear、整体替换和再次反序列化会使旧 map 脱离 native 表。迟到的依赖仍可写入旧字典，但不能重新填充当前 atlas。
- 补充 _serialize：保留 name、交替 name/UUID 数组、空槽位与导出依赖，UUID 压缩沿用 Web 规则。

## 2. 写入契约与边界

- 整体赋值会复制输入字典的自有可枚举项，返回可观察代理。因此不保留输入对象身份；赋值后通过 atlas.spriteFrames 修改。继续修改原始输入对象的别名不会写回 atlas。
- 字典值必须是 native SpriteFrame 或 null，accessor 属性不支持；不能通过给字典挂自定义 getter 或替换 prototype 来动态产生资产。
- 原生引用转换前先做类型校验，因为当前 SWIG 函数失败可能只记录错误而不抛 JS 异常。写入被冻结/只读属性失败时，恢复 native 旧引用与顺序。
- C++ 创建并填充的 atlas 可以在首次访问时还原 JS 映射。映射创建后的修改入口是上述 JS 公开 map/API；本轮未提供任意外部 C++ 修改表后自动通知已持有 JS map 的协议。
- 各同步操作仍在现有主线程模型执行，没有新增每帧扫描、共享内存协议或跨线程写入机制。此前取消的 SpriteFrame TypedArray 改造未恢复。

## 3. 验证

| 检查 | 覆盖 |
|---|---|
| Jest | map 整体赋值、单键修改、替换/null/delete、defineProperty、数字键与特殊名称、失败回滚、冻结、反序列化 Details 回填、反向完成、序列化依赖、迟到写入隔离、native 初始表、ccclass/序列化字段元数据 |
| Windows Debug/Release | SWIG 生成、编译链接及 cc2d_native_poc 通过；真实名称/指针数组（含 null）转换、顺序和 first-slot texture 通过 |
| 实际 JSB 壳联调 | 将当前 sprite-atlas.jsb.ts 转为 CommonJS，在 V8 harness 的真实 jsb.SpriteAtlas/SpriteFrame/Texture2D 上执行；map 修改与依赖回填可直接用保存的原生方法验证 |
| 原生引用检查 | 1000 次替换/clear 后 frame 引用计数恢复；别名替换先持有新引用，清理旧键无悬空引用 |
| 类型与文档 | 常规 TypeScript 和显式包含 JSB 文件的类型检查；diff、文档链接检查 |

V8 探针只隔离 core/元数据模块并显式调用构造钩子；元数据由 Jest 验证。它不加载完整 Creator runtime 或从磁盘加载 .plist/.png/Prefab，不冒充资源场景验收。1000 次字典替换不是 1000 次完整场景加载，也不是 ASan/泄漏工具结论。

复现：先构建最新 native harness，再执行：

```powershell
& native/tests/2d-poc/run-m6-sprite-atlas-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

脚本生成实际 JSB 源码探针，要求输出 jsb shell integration: OK，然后执行 SpriteAtlas native/Web 两组 Jest 用例；旧 exe 忽略探针参数时会判失败。run-m0-checks.ps1 已在存在 native Debug harness 时接入该入口。

## 4. 后续

测试工程内的旧格式静态图集和 Prefab 已加入下方验收。其余旧项目场景、RichText imageAtlas、异步取消、长期生命周期、平台及性能继续按 [M6 计划](./native-2d-m6-plan.md) 执行。

## 5. 真实资源和 Prefab

验收工程由 CLI 导入 TexturePacker format 2 的 plist 和 32×16 PNG。Prefab 序列化字段引用图集和第一个 SpriteFrame 的资源 UUID。探针先按资源路径加载 Prefab，再加载同一图集，检查两个帧的身份、纹理、旋转、裁剪、偏移以及原生表条目数。

每次实例化两个 Sprite。图集和初始帧共用，实例的组件和换帧状态独立。渲染到 M4 的隔离 Camera 目标，检查从红色原帧切换到绿色旋转帧后的中心像素。先销毁实例，再释放 Prefab，图集由显式引用继续持有。最后归还该引用并检查 Prefab、图集、两个帧和 Texture2D 均移出资源缓存。每端重复三轮，并要求 `M6_STATIC_ATLAS_PASS`。

该结果覆盖文件导入、运行时依赖回填、GPU 采样和资源缓存生命周期。长期堆和其他持有者的析构时机继续验收。下节覆盖图集归还自身引用的时机。

Windows Debug 与 Web 的真实构建均记录通过。完整串行门禁和 39 项定向 Jest 通过，原有 100 组 Sprite/Mask 与位图字体 RGBA 对照逐字节一致。M5 用时 39.32 秒，预算 45 秒。

## 6. 原生帧引用随延迟销毁释放

SpriteAtlas 原生表的每个命名槽持有一个 IntrusivePtr<SpriteFrame>，包括多个名称指向同一帧的情况。申请销毁后仍可读取已经加载的帧。原生 onPreDestroy 在帧末清空表和顺序，归还它持有的所有引用。调用方独立持有的帧不由图集销毁。

JSB 通过 CCObject 的脚本延迟销毁队列调用 _onPreDestroy，在帧末清空原生表并解除当前字典绑定。旧字典上的迟到写入只修改该字典，销毁中的 JSB 读取使用原生表的临时视图。原生新增、整表替换和顺序更新入口也检查销毁标志。完整工程探针在保证图集 JS wrapper 仍可访问时验证原生帧数归零。仅接通 C++ 队列的中间候选在真实 Prefab 释放后仍持有帧，触发 M6_STATIC_ATLAS_ERROR。C++ 探针覆盖独立持有同一帧、两个图集槽引用以及帧末恢复原始计数。

同一 Windows Debug 应用在两次 M5 运行中结束于嵌套 Mask 后、Bitmap GPU 首个标记前，退出码为 0xC0000005。两次静态图集释放断言均已通过。一次本地调试另记录 GLES3 纹理绑定 GL_INVALID_ENUM。没有取得足以确认这些现象同源的堆栈。停止其他测试进程后，同一应用的一次独立 M5 在 40.22 秒内通过。M6.4 的长期调度稳定性仍待验收。

最终连续 Windows Debug 门禁和 Web 构建均通过。Debug 和 Release 的 C++ 探针各完成 1000 轮原生引用计数验证，两种配置的实际 JSB 探针也通过，39 项定向 Jest 通过，100 组 RGBA 对照逐字节一致。最终连续运行的 M5 用时 39.40 秒。

## 7. 真实资源千轮压力

Windows Debug 和 Web 在同一套 plist、PNG、Prefab 资产上各完成 1000 次资源路径加载、实例化、换帧、销毁和释放。每端 5000 个 Prefab、SpriteAtlas、SpriteFrame 和 Texture2D 的引用与缓存检查通过。Windows 同时校验原生 Asset 引用归零，释放后仍可访问的 wrapper 不再持有帧或纹理。每端通过 22 个实际 GPU 中心像素断言，覆盖首轮和每个百轮检查点。

| 轮次 | Windows 私有 MiB | Windows 工作集 MiB | V8 原生映射 | Chrome JS 堆 MiB | 存活 wrapper（Windows / Web） |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 223.77 | 241.49 | 253 | 143.29 | 0 / 0 |
| 100 | 224.71 | 244.02 | 261 | 144.20 | 5 / 5 |
| 200 | 224.28 | 243.95 | 261 | 144.42 | 5 / 5 |
| 300 | 221.77 | 242.19 | 261 | 144.67 | 5 / 5 |
| 400 | 226.17 | 245.04 | 261 | 144.70 | 5 / 5 |
| 500 | 224.26 | 244.19 | 261 | 144.86 | 5 / 5 |
| 600 | 220.99 | 242.44 | 261 | 144.97 | 5 / 5 |
| 700 | 224.06 | 244.86 | 261 | 144.98 | 5 / 5 |
| 800 | 222.93 | 245.74 | 261 | 145.02 | 5 / 5 |
| 900 | 222.80 | 246.18 | 261 | 145.09 | 5 / 5 |
| 1000 | 224.52 | 245.39 | 261 | 145.12 | 5 / 5 |

每批统计本批 500 个受测资产 wrapper。在 100 至 1000 轮的样本里，Windows V8 映射一直是 261。Windows 进程内存是组合指标。Chrome JS 堆从首批到末批增加约 0.93 MiB，增长来源见第 8 节。跨场景切换、ASan 和长期泄漏判定仍待验收。

Windows 应用 SHA256 为 `b84de791a260ea158d6d515f4882fa0a48e659e8fd61aff51d53d5de3b87e946`，场景 JS 包 SHA256 为 `5f13e1322566665c0eb9d2e5bcfb0df418e84e74865f73003dd6dc14c2240671`。原始报告和日志位于 `native/tests/2d-poc/build/static-atlas-stress-native` 与 `native/tests/2d-poc/build/static-atlas-stress-web`。最初用六分钟预算启动的 Windows 采集在第 500 轮后主动停止，延长压力预算后重新完整采集上述结果。

同一候选的常规 Windows Debug 连续门禁、Web 构建和 39 项定向 Jest 通过，100 组常规 GPU 捕获逐字节一致。M5 用时 40.06 秒。

## 8. Web 堆快照归因

从引擎 `605097fe88` 构建 `cocos-m1-test`，在 Chrome 157.0.8103.78 中运行相同的静态图集压力场景。默认与对照运行各通过 1000 轮、5000 个资产检查和 22 个 GPU 采样。在第 100 和 1000 轮 GC 采样后各取一次堆快照。对照运行关闭 TurboFan 和 Maglev。采集及对照命令见[构建与验收流程](./native-2d-build-and-acceptance.zh-CN.md#web-堆增长诊断)。

默认运行的快照自身字节净增 781280 B，其中 V8 `code` 类净增 706756 B，占净增长的 90.5%。最大的条目是 `InstructionStream`（455296 B）和 `TrustedByteArray`（136388 B）。Prefab、SpriteAtlas、SpriteFrame 和 Texture2D 实例计数分别从 2、1、15、22 降到 1、0、12、20。

关闭优化编译后，快照自身字节净减 1408 B，V8 `code` 类净增 10604 B，四类资产的对象计数变化与默认运行相同。第 100 轮取快照后，从第 200 到 1000 轮的 Chrome JS 堆时点采样，默认运行增加 732916 B，对照运行增加 7824 B。两组证据均指向优化编译造成的堆增长。

预采集的对象边显示，新增 `WeakArrayList` 的主要入边来自 V8 `Map` 的 `dependent_code`。少量 `RenderData` 由场景中现存的 Label 和 Sprite 持有，其 `chunk` 指向对应的 `StaticVBChunk`。默认运行中这两类对象的自身字节合计净增 1404 B。

取快照会触发额外的 GC。快照的对象自身字节、时点采样的 Chrome JS 堆以及原生或 GPU 分配分别计量。两组原始快照分别保存在 `native/tests/2d-poc/build/static-atlas-heap` 和 `native/tests/2d-poc/build/static-atlas-heap-no-opt`，差分 JSON 和门禁日志位于 `native/tests/2d-poc/build/static-atlas-heap-gate`。本节归因覆盖同场景的 Web 千轮夹具。跨场景、长期运行和原生泄漏检测仍待验收。
