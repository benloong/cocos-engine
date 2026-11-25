# 2D 渲染对象与依赖范围

日期：2026-11-19

## 1. 范围规则

只要求需要公开给脚本的 **Asset、Node、Component 及其子类**提供对应 JSB 薄壳。其他类继续使用现有 TS 实现或聚合 Native 绑定，不要求按类新增 `.jsb.ts`。

本期排除已废弃组件、兼容组件及别名，以及组件本身被标为实验性或专用于概念验证（PoC）的类。当前 2D 模块的 `NativeUITransformPoc` 和 `NativeSpritePoc` 属于 M0 验证组件，均排除在 C++ 迁移、JSB 薄壳和验收清单之外。正式的 `UITransform`、`Sprite` 按第 3 节实施。可选特性按组件自身的发布状态判断。[M0 组件定义](../cocos/2d/poc/native-2d-poc.ts) · [实验性 API 命名规范](contribution/experimental.zh-CN.md)

Native 实现的目标类直接适配绑定类型的原型并导出，例如 `Sprite = jsb.Sprite`；不再定义继承 JS Component 的独立 Sprite 包装类。C++ 不增加 NativeComponent 分类基类。脚本实现的组件通过 Component 薄壳对应 ScriptComponent，用户脚本无需各自生成引擎 `.jsb.ts`。

本文按当前 TS 源码继承关系识别依赖；它不意味着目标 C++ 必须逐层复制 TS 的所有渲染基类。生命周期方案仍以 [设计文档](native-component-lifecycle-design.md) 为准。

“已有文件”仅表示同源 `.jsb.ts` 存在，不表示其已采用直接导出绑定类型的目标方式。薄壳文件存在、C++ 实现存在、构建替换已接入和目标行为验收完成需要分别检查。

上述原生类的序列化与反序列化均由对应的 `.jsb.ts` 接入 TS 序列化系统。普通属性复用装饰器元数据，有自定义数据格式的类在薄壳中补齐读写钩子。C++ 组件和资源只暴露运行时字段与引用，不实现 `serialize` 或 `deserialize`。用户脚本组件的字段继续沿用 TS 装饰器。

## 2. 基础对象与渲染公共基类

| 类 | 当前继承 | 与 2D 的关系 | 薄壳范围 |
| --- | --- | --- | --- |
| Component | CCObject | 生命周期、enabled、Node 关联 | 必需；新增公共脚本入口 |
| ScriptComponent（目标 C++ 类） | Component | 运行用户脚本及过渡期 TS 组件回调 | 复用公共 Component 薄壳，不要求向用户导出 ScriptComponent 类型 |
| Node | CCObject | 层级、变换、组件集合、事件 | 必需；已有 node.jsb.ts |
| Scene | Node | 场景根和激活入口 | 必需；已有 scene.jsb.ts |
| Renderer | Component | 当前 TS UIRenderer 的公共基类，材质接口 | 需要公共 API/原型兼容；缺少同源薄壳 |

2026-11-23 按用户决定，`SpriteRenderer` 及其基类 `ModelRenderer` 的实现、JSB 薄壳和相关验收均移出本期。生成网格渲染、模型重绑、纹理描述符更新及其资源释放用例归入范围外历史记录。普通 `Sprite` 使用 `UIRenderer` 和 `Renderer` 的公共接口，按核心组件计划迁移。[Sprite](../cocos/2d/components/sprite.ts) · [UIRenderer](../cocos/2d/framework/ui-renderer.ts)

CCObject 是共同基础，需要适配对象状态和销毁。逐类薄壳的范围见第 1 节。[scene-graph](../cocos/scene-graph/index.ts) · [Renderer](../cocos/misc/renderer.ts)

## 3. 2D 核心组件

这些类均属于 Component 体系。表中的继承是当前 TS 实现，不是新 C++ 结构承诺。

| 类 | 当前 TS 基类 | 用途/依赖 | 同源薄壳 |
| --- | --- | --- | --- |
| UITransform | Component | 内容尺寸、锚点、坐标和裁剪区域 | 已有 |
| UIRenderer | Renderer | 材质、颜色、混合、渲染实体的公共接口 | 缺少 |
| RenderRoot2D | Component | 2D 渲染根节点 | 已有 |
| Canvas | RenderRoot2D | UI 根与屏幕适配，引用可空 Camera，组合 RenderRoot2D，按需调用 Widget | 新增 C++ Canvas 与 canvas.jsb.ts，直接导出 n2d.Canvas |
| Sprite | UIRenderer | 精灵；依赖 SpriteFrame、Material | 已有 |
| Label | UIRenderer | 文本；依赖 Font、BitmapFont、纹理和字形布局 | 已有 |
| RichText | Component | 富文本；当前 TS 使用 Label、Sprite 和子 Node | 已有 |
| Mask | Component | 遮罩；依赖 Graphics/Sprite、模板状态和材质 | 已有 |
| Graphics | UIRenderer | 路径绘制、几何生成和绘制提交 | 已有 |
| UIOpacity | Component | 层级透明度 | 已有 |
| UISkew | Component | UI 倾斜变换，独立可选特性 | 缺少 |

主要入口：[2d.ts](../exports/2d.ts)、[framework/index.ts](../cocos/2d/framework/index.ts)、[components/index.ts](../cocos/2d/components/index.ts)。RichText、Mask、Graphics、UISkew 还分别有独立特性入口，不能仅用 exports/2d.ts 是否直接导出来裁定范围。

逐类文件、Native 后端与分期验收见 [2D 渲染逐类实现清单与实施计划](native-2d-implementation-matrix.md)。

## 4. 2D 资源及相关 Asset

### 4.1 2D 自有资源

| 类 | 当前基类 | 作用 | 同源薄壳 |
| --- | --- | --- | --- |
| SpriteFrame | Asset | 精灵区域、UV、边框、纹理引用 | 已有 |
| SpriteAtlas | Asset | SpriteFrame 图集与名称查询 | 已有 |
| Font | Asset | 字体共同接口 | 已有 |
| TTFFont | Font | TTF 字体资源 | 已有 |
| BitmapFont | Font | 位图字体与字形数据 | 已有 |
| LabelAtlas | BitmapFont | 字符图集字体 | 已有 |

入口：[2d/assets/index.ts](../cocos/2d/assets/index.ts)。FontAtlas、FontLetterDefinition 是字体辅助数据类，不是 Asset，不要求独立薄壳。

### 4.2 直接使用的共享资源

| 类 | 当前基类 | 2D 使用点 | 同源薄壳 |
| --- | --- | --- | --- |
| Asset | CCObject（事件适配） | 所有资源公共基类 | 已有 |
| ImageAsset | Asset | 图像与纹理数据 | 已有 |
| TextureBase | Asset | 纹理公共属性、采样器 | 已有 |
| SimpleTexture | TextureBase | 普通纹理上传/存储基类 | 已有 |
| Texture2D | SimpleTexture | 精灵、字体、动态合图纹理 | 已有 |
| RenderTexture | TextureBase | UI 相机输出和离屏渲染 | 已有 |
| Material | Asset | 2D shader、混合与材质属性 | 已有 |
| MaterialInstance | Material | 组件级材质实例 | 已有 |
| EffectAsset | Asset | 内置与自定义 2D shader effect | 已有 |
| Mesh | Asset | SpriteFrame 创建并通过 mesh 属性提供的网格 | 已有 |

参考：[SpriteFrame 的依赖](../cocos/2d/assets/sprite-frame.ts)、[UIRenderer](../cocos/2d/framework/ui-renderer.ts)、[Batcher2D](../cocos/2d/renderer/batcher-2d.ts)、[MaterialInstance](../cocos/render-scene/core/material-instance.ts)。Mesh 不表示每个普通 Sprite 都使用完整 Mesh 资源。

场景/Prefab 加载链还有 `SceneAsset : Asset`、`Prefab : Asset`；它们是节点树恢复依赖，不是绘制算法本身。SceneAsset 已有同源薄壳，Prefab 当前没有。BufferAsset、TextAsset、JsonAsset 等按实际资源导入/自定义内容需求纳入，不因继承 Asset 就将所有资源类型视为基础 2D 绘制的直接依赖。

内部存在 `DynamicAtlasTexture : Texture2D` 和 `LetterRenderTexture : Texture2D`。它们属于资源继承体系，但不是新增用户 API 的理由：若保留为 TS 内部实现可继续继承纹理薄壳；若改为 C++ 且需要以具体类型暴露给 JS，则补对应内部绑定/薄壳并验证身份。仅以 Texture2D 接口使用时不要求额外导出新的公共类。

## 5. 场景、适配、排序和交互依赖

### 5.1 核心或按特性直接依赖

| 类 | 当前继承 | 纳入原因 | 薄壳范围 |
| --- | --- | --- | --- |
| Camera（组件） | Component | Canvas 视口、场景和 RenderTexture 输出 | 新增 C++ CameraComponent 和 camera-component.jsb.ts，直接导出 cc.Camera。已有 renderer.scene.Camera 继续提供渲染后端 |
| Widget | Component | Canvas 导入并用于布局适配 | 需要；属于 UI 模块 |
| Sorting2D | Component | 可选 2D 排序组件 | 启用该特性时需要 |
| Sorting | Component | 通用排序扩展 | 使用该特性时需要，不作为纯 2D 核心必选 |

Camera、Widget、Sorting2D、Sorting 当前缺少同源 `.jsb.ts`。`SortingLayers` 不继承上述三种基类，不要求独立薄壳。

参考：[Canvas](../cocos/2d/framework/canvas.ts)、[sorting-2d.ts](../cocos/sorting/sorting-2d.ts)、[sorting.ts](../cocos/sorting/sorting.ts)。

### 5.2 UI 控件扩展

这些都是 Component 子类，但通常由 UI 控件依赖渲染核心，不是渲染核心反向依赖所有控件：

- 布局与适配：Layout、SafeArea、UICoordinateTracker；Widget 已列入直接依赖。
- 基础交互：Button、Toggle、ToggleContainer、Slider、ProgressBar、BlockInputEvents。
- 滚动与分页：ViewGroup、ScrollView、ScrollBar、PageView、PageViewIndicator。
- 平台交互：EditBox、SubContextView。

上述控件当前缺少独立同源薄壳；可先保留 TS 逻辑并通过 ScriptComponent 接入统一生命周期，不要求与 Sprite 一起 Native 化。`View`、`ResolutionPolicy` 等屏幕适配对象不属于 Component 体系，不因位于 ui 目录就要求薄壳。

## 6. 其他 2D 可选模块

| 模块 | Component 子类 | Asset 子类 | 是否基础核心必选 |
| --- | --- | --- | --- |
| Particle2D | ParticleSystem2D、MotionStreak | ParticleAsset | 否 |
| TiledMap | TiledMap、TiledLayer、TiledObjectGroup、TiledTile | TiledMapAsset | 否 |
| Spine | sp.Skeleton | sp.SkeletonData | 否 |
| DragonBones | dragonBones.ArmatureDisplay | DragonBonesAsset、DragonBonesAtlasAsset | 否 |

这些类型启用后进入同一 Component/Asset 薄壳规则。Spine/DragonBones 当前存在聚合 index.jsb.ts，不应把缺少单类文件误判为没有 Native 支持。TiledUserNodeData 是 TiledMap 内部 Component 辅助类，需兼容其内部生命周期，不自动成为新增公共 API。

## 7. 依赖但不要求独立 JSB 薄壳的实现类

| 分组 | 相关类/对象 | 作用 |
| --- | --- | --- |
| 提交和管理 | Batcher2D、UIRendererManager、DrawBatch2D | 遍历、脏更新、合批和提交 |
| 渲染实体 | RenderEntity、RenderDrawInfo | Native 渲染数据和绘制指令 |
| 顶点和索引 | BaseRenderData、RenderData、MeshRenderData、MeshBuffer、BufferAccessor、StaticVBAccessor、LinearBufferAccessor、StaticVBChunk | 网格数据与缓存 |
| 遮罩 | StencilManager、模板状态 | 裁剪与模板阶段 |
| 动态合图 | DynamicAtlasManager、Atlas | 合图管理；内部纹理子类另见资源段 |
| 字体布局 | FontAtlas、FontLetterDefinition、LetterAtlas、CanvasPool、TextStyle、TextLayout、TextProcessing、TextOutputLayoutData、TextOutputRenderData | 字形、排版和缓存 |
| 富文本 | HtmlTextParser、LRUCache | 文本解析和缓存 |
| 几何/assembler | Sprite 各种 assembler、GraphicsAssembler、Impl、Path、Point、Earcut 相关类 | 顶点构建、曲线和三角剖分 |
| 渲染场景 | Root、RenderScene、RenderWindow、renderer.scene.Camera、Model、Pass、RenderingSubMesh | 对接渲染管线；RenderingSubMesh 名称虽含 Mesh，但不是 Asset |
| gfx | Device、Texture、Sampler、Buffer、InputAssembler、DescriptorSet、Shader、DepthStencilState 等 | GPU 资源与状态；保留现有绑定 |
| 生命周期服务 | Director、ComponentScheduler、NodeActivator、Scheduler | 帧执行和任务管理 |
| 资源服务 | AssetManager、Bundle、BuiltinResMgr、Downloader、Parser | 加载与资源查找；不是 Asset 子类 |
| 值和事件 | Vec2/3/4、Mat4、Color、Rect、Size、EventHandler、EventTouch、NodeEventProcessor、Layers、SortingLayers | 值类型、事件及查询辅助 |

这些类可能已经有 Native 绑定、聚合 `.jsb.ts` 或共享内存适配；本规则不要求删除它们，只是不新增“一类一薄壳”的覆盖义务。接口如 IAssembler、IBatcher、IVertices，以及枚举，不计为待迁移对象类。

Native 2D 已有对应或关联实现，例如 `Batcher2d`、`UIMeshBuffer`、`RenderEntity`、`RenderDrawInfo`、`StencilManager`、`UIModelProxy`、`DynamicAtlas`、`LetterAtlas`、`TextMetrics`、`RichTextParser`、`RichTextLayout`、`SpriteGeometry`、`GraphicsGeometry`。这不是 TS/C++ 类型完全一一对应的承诺，内部实现允许拆分、合并或替代。

## 8. 实施顺序

场景恢复先接入 Asset、SceneAsset、Prefab。Sprite 试点前验证纹理、材质、SpriteFrame 与 SpriteAtlas。Label 迁移前验证 Font、TTFFont、BitmapFont 及其派生类 LabelAtlas。Camera 和 RenderRoot2D 接入后，以 RenderTexture 完成 Canvas 离屏验收。可选模块按第 6 节随各自资源接入。[逐类实施计划](native-2d-implementation-matrix.md)
