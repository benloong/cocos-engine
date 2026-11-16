# M6.2 RichText 原生运行时接入

更新：2026-11-16。已加入 native RichText 和 NATIVE `.jsb.ts` override，实际组件路径直接使用已验证的 RichTextParser/RichTextLayout。Windows Debug/Release 的原生组件与实际 JSB 壳定向验证通过；完整 native TS 构建已修复并通过，终态场景/视觉/平台门禁未通过，M6.2 不记为完成。

## 运行时与所有权

- JS 保留 Component 身份、14 个序列化字段、属性接口和用户事件分发。没有 JS HTML 解析、测量、布局、逐段创建或帧轮询；原生配置修改直接触发布局，禁用期间延后重建。
- RichText 是子渲染器组，原生持有每段的 Node、UITransform、Label 或 Sprite，不占用父节点 RenderEntity。Batcher2d 在读取该节点实体和子节点前准备 RichText，支持与同节点 Sprite 共存。新增 native 遍历成本仍须纳入 M6.5 性能采样。
- 相同位置/类型的段复用 Node；退役 Label/Image 各保留最多 20/10 个原生对象。回收时清空字体、图集、纹理、CHAR 缓存和事件字符串；detach 清空活动段与池。生成节点设置 DontSave/HideInHierarchy。
- 准备时从 Node 槽位核对非 owning UITransform，支持组件先加载、变换后到达；变换移除时清理旧段，避免访问过期指针。
- Label 新增不创建纹理的原生文本测量入口，使用平台字体测量；CHAR 按字形 advance 累加，BMFont 读取原生 glyph/kerning。只在绘制段中生成纹理，不为每个测量前缀上传纹理。
- 修复 Label 重复着色：纹理保留文字 RGB 和覆盖率，内部 Sprite 使用白色 RGB、组件 alpha；透明度通过实体/顶点应用并保留子节点级联。已补实际提交顶点与纹理 alpha checksum 检查，避免中间色和半透明文字被乘两次。
- 字体、SpriteAtlas 表与 SpriteFrame revision 在 native 检测。图集增加 revision，用于迟到加载、替换和移除；JS 不轮询资产或逐字形传输。
- 原生保存每段 click/param，点击时通过原生包围盒返回命中段；JS 只向 enabled 的用户组件分发函数调用。禁用/销毁解绑监听，销毁同时解除 native 字体/图集与 Node 关系。
- Node JSB 构造钩子原先会覆盖共享内存中的 layer；现在保留 C++ 已初始化的默认层或原生自定义层，避免原生生成节点首次得到 JS wrapper 时丢失 UI 层。回归执行实际构造函数源码，并检查共享内存字节不被改写。

## 已运行的验证

```powershell
& native/tests/2d-poc/run-m6-richtext-runtime-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

| 检查 | 已证明的范围 |
|---|---|
| Windows C++ Debug/Release | 原生 Label/Sprite 段、DrawInfo 和可见文本像素、父 Renderer 共存、DontSave、命中/未命中、禁用后更新、节点复用、字体/图像引用释放、frame/atlas revision；实际 Batcher walk 在遍历子节点前处理图像变化 |
| 实际 V8/JSB 壳 | 真实 RichText JSB 源码、SWIG 构造与方法、原生段身份、点击参数和停止传播、Font/Atlas 变化、启停与销毁 |
| Jest 3 套件 / 11 项 | Web 默认值/枚举/字段元数据、Details 回填与 instantiate、属性桥接、事件去重/解绑和回调重入、Web 既有 RichText 回归、Node 构造共享内存保持 |
| TypeScript | 常规项目显式加入 RichText JSB：0 诊断；完整 native TS：已修复导入边界并通过，见下方 |

1000 次静止 prepare 保持布局 revision、段身份和尺寸推送次数不变。这是重建/通知检查，不是完整运行时 JSB trace、1000 次场景加载卸载或泄漏证明。V8 探针隔离 JS 基类/装饰器，Jest 补真实 Component/元数据覆盖；尚未验证 Creator 完整 Node wrapper、场景加载与 GPU golden。

## 构建修复与剩余门禁

`scripts/compile-native-ts.js` 已加入 rich-text feature，确保 CI 会检查新 override。首次执行存在 30 项 2D 诊断，后续已修复并重新运行 `node scripts/compile-native-ts.js --no-clean` 通过（exit 0）。原因及修复为：

- 2d/index.ts 的 assembler barrel 带入 Web 文本/几何算法；新增 native assembler barrel，legacy manager 名称保留，更新请求直接转发 native。未补回 Web Label 的 Canvas/布局状态来消除诊断；这些兼容 API 的终态 parity 仍按 M6.1 验收。
- SpriteFrame JSB 重导出 IUV 类型；Mask 改为直接从 2D 资产模块导入 SpriteFrame。
- UITransform.__preload 以 Node UI 槽位自身的类型表达跨 override 赋值，不再显式 import 原始 Web UITransform。由此不再编译无关的 Web UITransform 实现及其 _native/_priority/Mask.isHit 类型冲突。

构建参数同时改用 TypeScript API 的 target/moduleResolution 枚举。完整生成与编译已通过，复现、实际 JSB 回归和审计边界见 [报告](./native-2d-m6-native-ts-boundary.md)。跨非 2D 边界的实际运行时/动态导入与裁剪组合审计仍待完成。

还需完成真实字体/复杂文本与 italic 容差、shadow、完整布局/视觉和事件矩阵、旧场景/Prefab/资源生命周期、Node wrapper 的完整引擎联调，以及全平台/裁剪/线程、GPU、稳态调用与性能门禁。现有 parser/layout 的独立 Web 对照继续有效，不能替代上述运行时验收。

## 点击回调重入补充（2026-11-16）

命中几何继续由 native 计算。JS 在调用用户代码前读取本次命中段的 handler/param，作为一次事件的临时数据；回调改变 string、图集或触发布局后，不再用旧索引查询已经复用的原生片段。回调销毁、禁用组件或关闭 handleTouchEvent 时，立即停止剩余分发；已命中的事件先标记停止传播。该临时事件数据不是 JS 布局或第二份片段状态，没有新增每帧调用或 native 所有权。

四项 Jest 回归先复现失败，修复后 8 项壳测试通过。实际 JSB 探针用两个 offset 重叠的原生图片段命中，首回调同步替换文本，验证原命中参数仍为 first/second；另验证 destroy、disable、touch-off 三种回调行为均停止当前及后续分发。Windows Debug/Release 两个 harness 和实际 JSB 通过，完整入口 3 个 suite、11 项测试通过；常规及完整 native TS 构建通过。原始本机日志在 native/tests/2d-poc/build/richtext-event-{before,after,jsb-final,types,native-types}.log。探针使用原生 Node/SWIG 和实际 RichText 壳，Component 调度及事件入口经过隔离；不替代完整应用中的触摸输入、Camera/Mask 分发、旧场景或字体 GPU 验收。

## Label 准备入口硬化（2026-11-16）

真实应用发现：TTF 赋值会调用 Label::clearRenderedData，而内部 Sprite::clearFrame 禁用了 RenderEntity。Batcher 跳过禁用实体，因此 Label 的 prepare listener 永远不会再生成字体纹理；直接调用 Label::prepareRenderEntity 的旧测试绕过了该缺口。修复后，Label 清空旧帧仍按其自身 enabled 状态保持准备入口；Label::setEnabled 同时更新 Component 和内部 Sprite 状态，字体失效不能重新启用被禁用的 Label。Sprite 自身 clearFrame 契约不变，没有新增持有关系。

新增 RichText 带 TTF 段的 RenderEntity 启用/Batcher prepare 回归，修复前两个原生断言失败；修复后 Windows Debug/Release 原生与实际 JSB、3 个 Jest suite（11 项）通过。另覆盖 Label 禁用期间切换 TTF/BMFont 后仍禁用，再启用可重新准备。真实应用中同一段原先 capture 时 opaque=0、手工 prepare 后为 467；修复后 capture 前已为 467，文本已出现在 GPU 图像中。该像素计数只说明准备链路恢复。正在建设的同源 TTF 字体矩阵另检出 Windows GDI 对 tests/fixtures/Thonburi.ttf 选择回退字体，而 Web 使用该字体，完整字体/视觉门禁仍未通过。本机日志 richtext-label-before.log、richtext-label-fix-regression-final.log 和 richtext-gpu-native-label-fix.log 位于忽略的 build 目录。
