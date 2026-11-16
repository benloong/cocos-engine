# M6.2 RichText 原生运行时接入

更新：2026-11-16。已加入 native RichText 和 NATIVE `.jsb.ts` override，实际组件路径直接使用已验证的 RichTextParser/RichTextLayout。Windows Debug/Release 的原生组件与实际 JSB 壳定向验证通过；完整 native TS 构建仍失败，终态场景/视觉/平台门禁未通过，M6.2 不记为完成。

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
| Jest 3 套件 / 7 项 | Web 默认值/枚举/字段元数据、Details 回填与 instantiate、属性桥接、事件去重/解绑、Web 既有 RichText 回归、Node 构造共享内存保持 |
| TypeScript | 常规项目显式加入 RichText JSB：0 诊断；完整 native TS：失败，见下方 |

1000 次静止 prepare 保持布局 revision、段身份和尺寸推送次数不变。这是重建/通知检查，不是完整运行时 JSB trace、1000 次场景加载卸载或泄漏证明。V8 探针隔离 JS 基类/装饰器，Jest 补真实 Component/元数据覆盖；尚未验证 Creator 完整 Node wrapper、场景加载与 GPU golden。

## 未通过的构建与剩余门禁

`scripts/compile-native-ts.js` 已加入 rich-text feature，确保 CI 会检查新 override。执行 `node scripts/compile-native-ts.js --no-clean` 失败；对其生成产物按 Node 模块解析复核，共 30 项 2D 诊断，集中在：

- Web label assembler 引用当前 native Label 缺少的兼容属性（textStyle/textLayout/textLayoutData/textRenderData、spriteFrame/ttfSpriteFrame、assemblerData/contentWidth/_canvasPool）。
- SpriteFrame JSB 未重导出 IUV；Mask 从 native asset barrel 导入 SpriteFrame。
- 被类型别名带入的原始 UITransform 与 JSB UITransform 的类型身份、_native/_priority 和 Mask.isHit 边界。

这些错误没有被跳过或计为通过。需要修复原生类型/导入边界，同时防止为消除错误而重新引入 Web 渲染算法；完整构建与产物审计继续阻断 M6 收口。

还需完成真实字体/复杂文本与 italic 容差、shadow、完整布局/视觉和事件矩阵、旧场景/Prefab/资源生命周期、Node wrapper 的完整引擎联调，以及全平台/裁剪/线程、GPU、稳态调用与性能门禁。现有 parser/layout 的独立 Web 对照继续有效，不能替代上述运行时验收。
