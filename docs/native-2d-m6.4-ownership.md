# M6.4 组件与资产所有权核对

范围沿用 M6 的 17 类清单。下表记录宿主或资源由谁持有、哪一步解除借用，以及回归实际观察的结果。Windows 控制台用例在同一进程中运行 C++ 和真实 JSB，应用场景另外检查提交到 GPU 的输出。

在提交 `a4f5ce02a2` 的生产源码上，Windows Debug 和 Release 各通过六组真实 JSB 探针。两种配置及单独的 MSVC AddressSanitizer Debug 应用分别完成 1000 轮场景切换、4998 项场景断言和 88 张 Web 图像对照，每张 RGBA 的 SHA-256 均相同。ASan 启用 `halt_on_error=1`，本轮标准错误为 0 字节。千轮旧资产加载和字体句柄专项的原始运行记录在下表分别链接。[本轮场景与程序哈希](./native-2d-m6.4-ownership-results.json)

## 组件

节点析构通过当前组件列表解绑。组件挂载和迁移更新双向关联；派生组件各自负责材质、事件订阅及缓存的释放。[Node](../native/cocos/core/scene-graph/Node.cpp)、[Component](../native/cocos/core/component/Component.cpp)、[UIRendererManager](../native/cocos/2d/framework/UIRendererManager.cpp)

| 类 | 取得与解除引用 | 验证 |
|---|---|---|
| UITransform | 节点的组件槽借用布局对象。布局持有尺寸回调，显式解绑或宿主销毁时释放；迁移到存活节点时保留回调。 | `testComponentAttach`、`testLayoutAndMaterials` 检查两个销毁顺序、闭包引用和迁移后的通知次数。[JSB 尺寸推送](../native/tests/2d-poc/build-layout-probe.cjs) |
| UIOpacity | 节点保存 localOpacity，组件借用节点。换宿主、解绑或组件析构时先恢复旧节点的值。宿主先销毁时清空组件的反向指针。 | `testUIOpacity` 检查旧节点恢复到 1、新节点得到原值及析构后的槽位。[Prefab 回退](./native-2d-m6-ui-opacity-rollback.md) |
| UIRenderer | 原生基类持有材质及实例；manager 注册表和 dirty 队列借用 renderer。禁用、解绑、析构都清除队列引用。TS 基类在销毁时解绑 RenderEntity。 | `testDirtyRenderers`、`testLayoutAndMaterials` 检查队列回调期间增删、材质槽缩小和实例引用释放。[Manager 探针](../native/tests/2d-poc/build-renderer-manager-probe.cjs) |
| RenderRoot2D | Batcher 的注册项观察节点。节点销毁时注册失效，遍历期间保活本轮使用的根；组件换宿主或禁用时注销旧根。 | `testRootRegistrationLifecycle` 检查引用计数、排序、重复注册和销毁次序。[根节点与场景回归](./native-2d-m6.4-render-root-lifecycle.md) |
| Sprite | 组件持有帧、纹理和 RenderEntity，监听帧、纹理及借用的布局。更换依赖先解绑旧监听；解绑和析构时撤销静态 DrawInfo 对顶点区间的借用。 | `testSpriteApiAndMaterials`、`testRendererLayoutOwnership`、`testFrameConsumers` 检查换帧后的引用计数、共享纹理变化、布局替换及旧 Sprite 移走后当前 renderer 的槽位。 |
| Label | 内部 Sprite 负责提交。Label 持有字体、相关纹理和帧，订阅字体与位图图集变化；切换依赖时解除旧订阅。CHAR Label 持有共享字形图集的引用。 | `testFontAssets`、`testGraphicsMeshes`、`testFrameConsumers` 检查缓存切换、两个 Label 共享后的继续绘制、图集引用数和换帧后的采样。 |
| Graphics | 组件持有 RenderEntity 和网格块。动态 DrawInfo 借用块的顶点、索引；清除或重建时先从实体移除 DrawInfo。几何来源和消费者互相登记，来源销毁会通知消费者清空。 | `testGraphicsMeshes` 检查来源清空、重绘和先析构来源，宿主先析构时亦检查实体的节点链接。 |
| Mask | 内部 Graphics 或 Sprite 接管绘制。形状布局取自当前宿主；内部图像渲染器管理帧和纹理。透明度阈值写入各 Mask 的材质实例。 | `testFrameConsumers`、`testGraphicsMeshes`、`testMaskHitLifecycle` 检查共享帧、独立材质、布局晚挂载、换宿主和依赖析构。[图像与场景证据](./native-2d-m6.4-renderer-ownership.json) |
| RichText | 组件拥有测量 Label、活动段及两个段池；各段拥有子节点及内部布局和 renderer。解绑时清段并解除宿主监听，释放段时使已有 JSB 借用包装失效。字体、图集与段上的帧分别管理订阅。 | `testRichTextRuntime` 和真实 JSB 检查池内复用、溢出淘汰、旧包装失效与独立 Label 存活。[JSB 回归](../native/tests/2d-poc/build-richtext-runtime-probe.cjs) |
| LabelOutline、LabelShadow | 两个兼容组件在启停时通过宿主查询 Label 并更新描边或阴影开关；绘制资源归 Label。 | [兼容属性测试](../tests/ui/label.test.ts)、[组件实现](../cocos/2d/components/label-outline.ts)、[阴影实现](../cocos/2d/components/label-shadow.ts) |

## 资产

字体与 SpriteAtlas 在资产生命周期的不同阶段清理数据，组件渲染时仍可共享同一份帧或纹理。[字体资产](../native/cocos/2d/assets/Font.cpp)、[SpriteAtlas](../native/cocos/2d/assets/SpriteAtlas.cpp)、[SpriteFrame](../native/cocos/2d/assets/SpriteFrame.h)

| 类 | 持有者与释放路径 | 验证 |
|---|---|---|
| Font | 原生 FontAsset 管理释放状态，销毁时调用对应的原生数据清理。Label 和 RichText 持有当前字体，替换字体时解绑旧事件。 | `testFontAssets`、`testRichTextRuntime` 检查字体变化、销毁及迟到写入。[资产绑定回归](../native/tests/2d-poc/build-font-assets-probe.cjs) |
| TTFFont | 字节属于字体资产；Windows 别名按租约登记，更换字体或清理时归还。 | `testFontAliasOwnership`、JSB 清理后的别名计数、真实 HTTP 加载与释放。[句柄与所有权](./native-2d-m6.1-font-alias-ownership.md)、[HTTP 生命周期](./native-2d-m6.1-font-remote-lifecycle.md) |
| BitmapFont、LabelAtlas | BitmapFontAsset 持有帧、配置、字形与 kerning 表。LabelAtlas 继承同一实现。清理时释放帧和表，拒绝已销毁资产的迟到赋值。 | [JSB 探针](../native/tests/2d-poc/build-font-assets-probe.cjs)对两个构造函数分别运行配置更换和清理；`testFrameConsumers` 检查消费者对帧内纹理变化的响应。 |
| SpriteFrame | 活动纹理和打包前的原纹理独立持有，恢复或销毁时清理对应引用。克隆帧独立管理这些引用。 | `testSpriteFrameData`、`testFrameConsumers` 和旧图集的克隆、卸载、重载回归。[图集资产生命周期](./native-2d-m6.1-atlas-lifecycle.md) |
| SpriteAtlas | 每个命名槽持有一份帧引用。整表替换先取得新表，再释放旧表；延迟销毁时清空表并通知消费者。 | `testSpriteAtlas` 检查别名槽的计数、空槽、重复释放和迟到写入。[旧 Prefab 与图集千轮加载卸载](./native-2d-m6-asset-lifetime.md) |

## 从节点到 GPU 提交

节点的组件列表借用组件，RenderEntity 槽持有当前实体。宿主销毁按当前列表解绑，回调迁走的对象由新节点接管。实体解绑前核对槽位身份，旧 renderer 不会清除接替者。DrawInfo 对几何内存的借用止于对应几何块的有效期；已入队的 DrawBatch2D 单独持有输入装配器、顶点和索引缓冲区，以及采样视图和源纹理。`testUiBatchInputResources` 比较入队、重复设置和清理前后的实际引用计数。[原生测试入口](../native/tests/2d-poc/native/main.cpp)
