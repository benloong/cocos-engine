# M6.3 Graphics/Mask 原生网格运行时基础

更新：2026-11-16。已移除 Graphics 的固定 256×256 CPU RGBA、纹理上传和内部 Sprite。原生几何核心现经 mesh DrawInfo/IA/GPU buffer 接入生产 Batcher；Windows Debug/Release 的 C++ 和实际 JSB 定向回归通过。后续已补 Windows Debug 应用与 Web 的 40 项 GPU 像素对照，全部通道差值为 0，见 [GPU 报告及边界](./native-2d-m6.3-graphics-gpu.md)。完整混合场景、API、平台和性能门禁未关闭，M6.3 保持未收口。

## 提交与调用方

- Graphics 使用八浮点顶点（xyz/rgba/distance），RenderDrawInfo 按 stride 创建和上传 buffer；graphics IA 包含 a_position/a_color/a_dist，既有九浮点 Sprite 布局保持原路径。未增大 RenderDrawInfo 的固定结构。
- 几何索引保留 uint32；生产 Graphics 按三角形重映射成最多 65535 顶点的 uint16 mesh chunks。使用动态 DrawInfo 列表，不受静态四 draw 容量限制。核心点坐标不受旧画布边界限制。
- 网格顶点为 local 坐标，RenderEntity.useLocal/renderTransform 将完整世界矩阵交给既有 local UBO。prepare 仅在几何 revision 变化时重建 chunks。与 Web VERTEX 模式一致，样式 alpha 保存在顶点，不乘级联 opacity；entity 保存级联 opacity 供后代使用。不生成中间纹理。
- 默认材质由 native 获取 ui-graphics-material，JS 使用既有 native material-slot 桥接。lineJoin/lineCap/miterLimit 的序列化字段、枚举与 setter 以及 fillRect 单次桥接已补齐。完整组件 API 仍按审计欠项验收。
- Mask rect/ellipse 使用原生几何，跟踪 UITransform 大小/anchor；ellipse 跟随 segments。GRAPHICS_STENCIL 直接借用 Graphics 几何；SPRITE_STENCIL 保留 SpriteFrame。alphaThreshold 写入每个 Mask 的材质实例，避免修改共享父材质。
- Batcher 将非空 mask stencil 的 push/clear/enable 移到整个 renderer 范围；不再为每个 chunk 重复进入 stencil level。空几何不进入/退出 stencil；已通过嵌套、inverted、多 chunk 和空嵌套后兄弟裁剪的 GPU 对照。Web 也修复了空嵌套 renderer 误弹父层。
- JS Mask 移除 lateUpdate/getFrame 轮询。其 Graphics helper 隐藏且不保存、保持 disabled；native 后端就绪时绑定，销毁时解绑 helper 和 native mask。Graphics 不再导出旧纹理 getFrame/getTextureWidth/getOpaquePixels 探针接口。

## 明确所有权：禁止 shared_ptr

- Graphics 值成员独占路径与几何，unique_ptr 独占每个 chunk；chunk 独占 CPU vectors 和 RenderDrawInfo，后者以 IntrusivePtr 持有 GPU IA/buffers。RenderEntity 使用 IntrusivePtr，Graphics 与已附加的 Node::UserData 各持有明确强引用；entity 的 Node/renderTransform 是反向非 owning 指针。
- Mask 的两个 renderer 是值成员，材质与帧为 IntrusivePtr 强引用。借用几何时，内部 Graphics 保存非 owning source 指针，并登记到 source 的非 owning consumer 列表。consumer 解绑/销毁时注销；source 销毁前同步使所有 consumer 失效，不延长源组件寿命，也不持有 JS 对象。
- Graphics/Sprite 的 onDetach 解绑 RenderEntity，覆盖 Node 先于组件销毁的顺序。Mask 注册 native Component 槽位 7，由 Node 在销毁时同步通知；onDetach 清除 renderer/transform 借用，后续 setType/prepare 不再接触旧 Node。prepare 从有效 entity 取回 Node，并重新查询非 owning UITransform 槽位；失去 transform 时清除旧几何。
- Label CHAR cache 改为注册表条目中的 unique_ptr 独占图集；Label 保存借用指针和键，获取/释放一份显式计数租用，最后租用释放时删除注册表条目。所有切字体/布局/缓存模式/销毁路径对称释放。
- 当前 native/cocos/2d 的生产代码无 shared_ptr/weak_ptr/make_shared；Node 审计测试覆盖该约束。未据此宣告全引擎、全部线程或所有生命周期矩阵已经验收。

## 验证与复现

```powershell
& native/tests/2d-poc/run-m6-sprite-api-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
& native/tests/2d-poc/run-m6-font-assets-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
node scripts/compile-native-ts.js --no-clean
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

- MSVC Debug/Release 构建与真实 C++ harness：Graphics 无纹理 mesh、超出旧画布坐标、RGBA/opacity、距离属性和实际 GPU buffer 字节数；80000 顶点分块及全部索引有效、120000 索引保留；1000 次稳定 prepare 保持顶点/DrawInfo 地址。GPU upload 测试使用实际 GLES3 device，不执行最终 graphics shader 的帧像素验证。
- 同一 harness 覆盖 Mask rect/anchor/ellipse segments、custom source clear/replacement/destruction、Graphics Node 先销毁，以及两 Label 的 CHAR 租用和 1000 次最后租用释放/重建。
- 实际 JSB 源码 + SWIG 探针在 Debug/Release 通过：Graphics 描边参数、fillRect/native mesh、Mask 无纹理源绑定/清空/动态替换/销毁。探针隔离 JS Component/metadata，不能代替 Creator 场景与完整资源管线。
- 现有 Sprite/Label/SpriteFrame/MaterialInstance 4 套件/19 项、字体及反序列化 7 套件/48 项回归通过。Graphics/Mask 元数据、后端就绪绑定与销毁的 2 套件/4 项通过；审计/元数据/适配器 10 项通过，包含禁止 shared_ptr 的检查。新的 Graphics/Mask Jest 入口已接 CI，远端运行未验证。
- 完整 native TS 和常规 tsc 通过；远端 CI 未运行。本机日志位于忽略目录 native/tests/2d-poc/build/graphics-runtime-build.log、graphics-out-final.log、graphics-out-release2-final.log、font-runtime-tests.log、native-ts-build.log。

## 剩余证据

shader/local UBO/Camera、缩放/大尺寸/半透明描边、嵌套/inverted/空 Mask、alphaThreshold 的本轮 Windows Debug GPU 像素已由独立夹具验证，见 GPU 报告。复杂 Sprite/Label/Graphics 混合、事件、完整动态切换和跨平台/Release 应用 GPU 仍待验收。旧 M4 外部应用的 CPU opaque/Graphics.getFrame 探针已过时；历史 M4 日志不能作为本次实现通过证据。

逐 API 与批量命令的 CPU/JSB/内存/纹理上传量比较、完整组件 API、材质变更回调、全平台、线程边界与1000次真实加载卸载继续按 M6 计划验收。本节点只关闭网格运行时基础接入，未缩减最终门禁。
