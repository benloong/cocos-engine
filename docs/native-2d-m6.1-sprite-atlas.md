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

该结果覆盖文件导入、运行时依赖回填、GPU 采样和资源缓存生命周期。长期堆和 C++ 指针析构时机属于后续验收。

Windows Debug 与 Web 的真实构建均记录通过。完整串行门禁和 39 项定向 Jest 通过，原有 100 组 Sprite/Mask 与位图字体 RGBA 对照逐字节一致。M5 用时 39.32 秒，预算 45 秒。
