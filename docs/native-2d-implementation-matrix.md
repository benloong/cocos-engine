# 2D 渲染逐类实现清单与实施计划

本清单对应 [2D 对象范围](native-2d-class-scope.md) 和[生命周期设计第 10 节](native-component-lifecycle-design.md)。以下为 2026-11-19 工作区源码核查结果。TS 列链接到 Web 侧实现或共享实现，C++ 列链接到定义并注明后端关系，JSB 列记录当前入口。“新增”“改造”“复用”均指计划动作。列为“TS 实现”的类当前由 TS 承担该对象语义。阶段编号表示依赖批次。

公开的 Asset、Node、Component 体系使用逐类入口。脚本实现的引擎组件共用 ScriptComponent，每个用户脚本实例通过同一入口分配代理。薄壳复用 TS 逻辑时，应把共享实现提取到独立模块，由 Web 和 Native 入口导入，以免构建替换后薄壳导入自身。本表及各阶段验收排除已废弃组件、兼容组件及别名、实验性组件（含 M0 的 `NativeUITransformPoc`、`NativeSpritePoc`）。[范围规则](native-2d-class-scope.md#1-范围规则)

下表中“新增”或“改造”原生类薄壳均包含序列化与反序列化适配。薄壳复用现有 TS 序列化器，以类元数据描述普通字段，按需补齐自定义读写钩子。C++ 提供绑定属性、引用和挂载接口，不实现 `serialize` 或 `deserialize`。

## 基础对象与场景恢复

| 类 | TS 实现 | C++ 实现或后端 | 当前 JSB | 实施动作 |
| --- | --- | --- | --- | --- |
| CCObject | [object.ts](../cocos/core/data/object.ts) | [Object.h](../native/cocos/core/data/Object.h) / [Object.cpp](../native/cocos/core/data/Object.cpp) | 无逐类壳 | 复用标志和引用计数，改造混合销毁提交 |
| Component | [component.ts](../cocos/scene-graph/component.ts) | [Component.h](../native/cocos/core/component/Component.h) / [Component.cpp](../native/cocos/core/component/Component.cpp) | 无逐类壳 | 改造 C++ 状态与启停，新增 component.jsb.ts |
| ScriptComponent | 公共 Component 脚本实例 | 待新增 | 共用拟新增的 component.jsb.ts | 新增 C++ 代理，桥接 JS 实例、异常和 GC |
| Node | [node.ts](../cocos/scene-graph/node.ts) | [Node.h](../native/cocos/core/scene-graph/Node.h) / [Node.cpp](../native/cocos/core/scene-graph/Node.cpp) | [node.jsb.ts](../cocos/scene-graph/node.jsb.ts) | 改造 C++ 组件数组及 JSB 增删查、激活与销毁 |
| Scene | [scene.ts](../cocos/scene-graph/scene.ts) | [Scene.h](../native/cocos/core/scene-graph/Scene.h) / [Scene.cpp](../native/cocos/core/scene-graph/Scene.cpp) | [scene.jsb.ts](../cocos/scene-graph/scene.jsb.ts) | 改造场景激活入口并验证场景切换 |
| Prefab | [prefab.ts](../cocos/scene-graph/prefab/prefab.ts) | TS 实现 | 由 scene-graph/index.jsb.ts 重导出 TS | 新增薄壳，改造克隆和引用恢复后统一激活 |
| SceneAsset | [scene-asset.ts](../cocos/asset/assets/scene-asset.ts) | [SceneAsset.h](../native/cocos/core/assets/SceneAsset.h) / [SceneAsset.cpp](../native/cocos/core/assets/SceneAsset.cpp) | [scene-asset.jsb.ts](../cocos/asset/assets/scene-asset.jsb.ts) | 复用绑定，验证场景引用恢复 |

## 渲染组件、相机与排序

| 类 | TS 实现 | C++ 实现或后端 | 当前 JSB | 实施动作 |
| --- | --- | --- | --- | --- |
| Renderer | [renderer.ts](../cocos/misc/renderer.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用可派生 TS 基类与材质查询 |
| UIRenderer | [ui-renderer.ts](../cocos/2d/framework/ui-renderer.ts) | [UIRenderer.h](../native/cocos/2d/framework/UIRenderer.h) / [UIRenderer.cpp](../native/cocos/2d/framework/UIRenderer.cpp) 继承 Component，当前绑定在 n2d | 无逐类壳 | 新增公共薄壳，改造 C++ 共享绘制状态和类型查询 |
| Sprite | [sprite.ts](../cocos/2d/components/sprite.ts) | [Sprite.h](../native/cocos/2d/components/Sprite.h) / [Sprite.cpp](../native/cocos/2d/components/Sprite.cpp) 当前继承 UIRenderer | [sprite.jsb.ts](../cocos/2d/components/sprite.jsb.ts) | 改造现有壳为直接导出 n2d.Sprite，接入统一工厂及调度 |
| UITransform | [ui-transform.ts](../cocos/2d/framework/ui-transform.ts) | [UITransform.h](../native/cocos/2d/framework/UITransform.h) / [UITransform.cpp](../native/cocos/2d/framework/UITransform.cpp) 当前继承 Component | [ui-transform.jsb.ts](../cocos/2d/framework/ui-transform.jsb.ts) | 改造现有壳为直接导出 n2d.UITransform，接入统一工厂及调度 |
| UIOpacity | [ui-opacity.ts](../cocos/2d/components/ui-opacity.ts) | [UIOpacity.h](../native/cocos/2d/framework/UIOpacity.h) / [UIOpacity.cpp](../native/cocos/2d/framework/UIOpacity.cpp) 当前继承 Component | [ui-opacity.jsb.ts](../cocos/2d/components/ui-opacity.jsb.ts) | 改造现有壳为直接导出 n2d.UIOpacity，接入统一工厂及调度 |
| Label | [label.ts](../cocos/2d/components/label.ts) | [Label.h](../native/cocos/2d/components/Label.h) / [Label.cpp](../native/cocos/2d/components/Label.cpp) 当前继承 UIRenderer | [label.jsb.ts](../cocos/2d/components/label.jsb.ts) | 改造现有壳为直接导出 n2d.Label，接入统一工厂及调度 |
| Graphics | [graphics.ts](../cocos/2d/components/graphics.ts) | [Graphics.h](../native/cocos/2d/components/Graphics.h) / [Graphics.cpp](../native/cocos/2d/components/Graphics.cpp) 当前继承 UIRenderer | [graphics.jsb.ts](../cocos/2d/components/graphics.jsb.ts) | 改造现有壳为直接导出 n2d.Graphics，接入统一工厂及调度 |
| Mask | [mask.ts](../cocos/2d/components/mask.ts) | [Mask.h](../native/cocos/2d/components/Mask.h) / [Mask.cpp](../native/cocos/2d/components/Mask.cpp) 当前继承 UIRenderer | [mask.jsb.ts](../cocos/2d/components/mask.jsb.ts) | 改造现有壳为直接导出 n2d.Mask，接入统一工厂及调度 |
| RichText | [rich-text.ts](../cocos/2d/components/rich-text.ts) | [RichText.h](../native/cocos/2d/components/RichText.h) / [RichText.cpp](../native/cocos/2d/components/RichText.cpp) 当前继承 UIRenderer | [rich-text.jsb.ts](../cocos/2d/components/rich-text.jsb.ts) | 改造现有壳为直接导出 n2d.RichText，接入统一工厂及调度 |
| RenderRoot2D | [render-root-2d.ts](../cocos/2d/framework/render-root-2d.ts) | [RenderRoot2D.h](../native/cocos/2d/framework/RenderRoot2D.h) / [RenderRoot2D.cpp](../native/cocos/2d/framework/RenderRoot2D.cpp) 当前继承 Component | [render-root-2d.jsb.ts](../cocos/2d/framework/render-root-2d.jsb.ts) | 改造现有壳为直接导出 n2d.RenderRoot2D，接入统一工厂及调度 |
| Camera | [camera-component.ts](../cocos/misc/camera-component.ts) | 后端 [Camera.h](../native/cocos/scene/Camera.h) / [Camera.cpp](../native/cocos/scene/Camera.cpp) 场景相机 | 无逐类壳 | 新增 C++ CameraComponent、工厂、`jsb.CameraComponent` 绑定及 `cocos/misc/camera-component.jsb.ts`，直接导出为 `cc.Camera`。组件通过 C++ 生命周期管理渲染相机 |
| Widget | [widget.ts](../cocos/ui/widget.ts) | TS 实现 | 无逐类壳 | 新增薄壳，共用布局逻辑 |
| Canvas | [canvas.ts](../cocos/2d/framework/canvas.ts) 继承 RenderRoot2D | 现由 TS 实现。拟新增 `cc::Canvas : public Component` | 无逐类壳 | 新增 `Canvas.h/.cpp`、组件工厂与 `n2d.Canvas` 绑定。新增 `canvas.jsb.ts` 直接导出 `cc.Canvas`。C++ 持有可空 CameraComponent 引用并组合同节点 RenderRoot2D |
| UISkew | [ui-skew.ts](../cocos/2d/framework/ui-skew.ts) | TS 实现 | 无逐类壳 | 新增薄壳，共用 TS 组件并接入 ScriptComponent |
| Sorting2D | [sorting-2d.ts](../cocos/sorting/sorting-2d.ts) | TS 实现 | 无逐类壳 | 新增薄壳，共用 TS 组件并接入 ScriptComponent |
| Sorting | [sorting.ts](../cocos/sorting/sorting.ts) | TS 实现 | 无逐类壳 | 新增薄壳，共用 TS 组件并接入 ScriptComponent |

## 纹理、图集、字体与材质

2D 资源入口公开六个 Asset 类型。SpriteFrame、SpriteAtlas 和 Font 直接继承 Asset，TTFFont 与 BitmapFont 继承 Font，LabelAtlas 继承 BitmapFont。六者均已有 C++ 实现、逐类薄壳和 Native 构建替换项，可直接验证现有实现。[资源导出](../cocos/2d/assets/index.ts) · [构建替换](../cc.config.json)

| 类 | TS 实现 | C++ 实现或后端 | 当前 JSB | 实施动作 |
| --- | --- | --- | --- | --- |
| Asset | [asset.ts](../cocos/asset/assets/asset.ts) | [Asset.h](../native/cocos/core/assets/Asset.h) / [Asset.cpp](../native/cocos/core/assets/Asset.cpp) | [asset.jsb.ts](../cocos/asset/assets/asset.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| ImageAsset | [image-asset.ts](../cocos/asset/assets/image-asset.ts) | [ImageAsset.h](../native/cocos/core/assets/ImageAsset.h) / [ImageAsset.cpp](../native/cocos/core/assets/ImageAsset.cpp) | [image-asset.jsb.ts](../cocos/asset/assets/image-asset.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| TextureBase | [texture-base.ts](../cocos/asset/assets/texture-base.ts) | [TextureBase.h](../native/cocos/core/assets/TextureBase.h) / [TextureBase.cpp](../native/cocos/core/assets/TextureBase.cpp) | [texture-base.jsb.ts](../cocos/asset/assets/texture-base.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| SimpleTexture | [simple-texture.ts](../cocos/asset/assets/simple-texture.ts) | [SimpleTexture.h](../native/cocos/core/assets/SimpleTexture.h) / [SimpleTexture.cpp](../native/cocos/core/assets/SimpleTexture.cpp) | [simple-texture.jsb.ts](../cocos/asset/assets/simple-texture.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| Texture2D | [texture-2d.ts](../cocos/asset/assets/texture-2d.ts) | [Texture2D.h](../native/cocos/core/assets/Texture2D.h) / [Texture2D.cpp](../native/cocos/core/assets/Texture2D.cpp) | [texture-2d.jsb.ts](../cocos/asset/assets/texture-2d.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| RenderTexture | [render-texture.ts](../cocos/asset/assets/render-texture.ts) | [RenderTexture.h](../native/cocos/core/assets/RenderTexture.h) / [RenderTexture.cpp](../native/cocos/core/assets/RenderTexture.cpp) | [render-texture.jsb.ts](../cocos/asset/assets/render-texture.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| EffectAsset | [effect-asset.ts](../cocos/asset/assets/effect-asset.ts) | [EffectAsset.h](../native/cocos/core/assets/EffectAsset.h) / [EffectAsset.cpp](../native/cocos/core/assets/EffectAsset.cpp) | [effect-asset.jsb.ts](../cocos/asset/assets/effect-asset.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| Material | [material.ts](../cocos/asset/assets/material.ts) | [Material.h](../native/cocos/core/assets/Material.h) / [Material.cpp](../native/cocos/core/assets/Material.cpp) | [material.jsb.ts](../cocos/asset/assets/material.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| MaterialInstance | [material-instance.ts](../cocos/render-scene/core/material-instance.ts) | [MaterialInstance.h](../native/cocos/renderer/core/MaterialInstance.h) / [MaterialInstance.cpp](../native/cocos/renderer/core/MaterialInstance.cpp) | [material-instance.jsb.ts](../cocos/render-scene/core/material-instance.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| Mesh | [mesh.ts](../cocos/3d/assets/mesh.ts) | [Mesh.h](../native/cocos/3d/assets/Mesh.h) / [Mesh.cpp](../native/cocos/3d/assets/Mesh.cpp) | [mesh.jsb.ts](../cocos/3d/assets/mesh.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| SpriteFrame | [sprite-frame.ts](../cocos/2d/assets/sprite-frame.ts) | [SpriteFrame.h](../native/cocos/2d/assets/SpriteFrame.h) | [sprite-frame.jsb.ts](../cocos/2d/assets/sprite-frame.jsb.ts) | 复用绑定与薄壳的自定义读写钩子，验证裁剪区域、顶点和纹理引用往返 |
| SpriteAtlas | [sprite-atlas.ts](../cocos/2d/assets/sprite-atlas.ts) | [SpriteAtlas.h](../native/cocos/2d/assets/SpriteAtlas.h) / [SpriteAtlas.cpp](../native/cocos/2d/assets/SpriteAtlas.cpp) | [sprite-atlas.jsb.ts](../cocos/2d/assets/sprite-atlas.jsb.ts) | 复用绑定与薄壳的帧表读写，验证按名称查询和延迟恢复的帧引用指向同一 SpriteFrame |
| Font | [font.ts](../cocos/2d/assets/font.ts) | [Font.h](../native/cocos/2d/assets/Font.h) / [Font.cpp](../native/cocos/2d/assets/Font.cpp) FontAsset | [font.jsb.ts](../cocos/2d/assets/font.jsb.ts) | 复用 jsb.Font 和 Asset 原型初始化，验证各字体子类的类型查询 |
| TTFFont | [ttf-font.ts](../cocos/2d/assets/ttf-font.ts) | [TTFFont.h](../native/cocos/2d/assets/TTFFont.h) | [ttf-font.jsb.ts](../cocos/2d/assets/ttf-font.jsb.ts) | 复用 jsb.TTFFont，验证字体文件加载、字体族恢复及更换字体后的渲染 |
| BitmapFont | [bitmap-font.ts](../cocos/2d/assets/bitmap-font.ts) | [BitmapFont.h](../native/cocos/2d/assets/BitmapFont.h) BitmapFontAsset | [bitmap-font.jsb.ts](../cocos/2d/assets/bitmap-font.jsb.ts) | 复用 jsb.BitmapFont，验证 fntConfig、字形度量及 spriteFrame 引用恢复 |
| LabelAtlas | [label-atlas.ts](../cocos/2d/assets/label-atlas.ts) | [LabelAtlas.h](../native/cocos/2d/assets/LabelAtlas.h) | [label-atlas.jsb.ts](../cocos/2d/assets/label-atlas.jsb.ts) | 复用 jsb.LabelAtlas 与 BitmapFont 的属性映射，验证按具体类恢复、字形绘制和共享帧身份 |
| BufferAsset | [buffer-asset.ts](../cocos/asset/assets/buffer-asset.ts) | [BufferAsset.h](../native/cocos/core/assets/BufferAsset.h) / [BufferAsset.cpp](../native/cocos/core/assets/BufferAsset.cpp) | [buffer-asset.jsb.ts](../cocos/asset/assets/buffer-asset.jsb.ts) | 复用现有薄壳及 C++ 资源，验证引用、属性恢复和释放 |
| TextAsset | [text-asset.ts](../cocos/asset/assets/text-asset.ts) | [TextAsset.h](../native/cocos/core/assets/TextAsset.h) | [text-asset.jsb.ts](../cocos/asset/assets/text-asset.jsb.ts) 已有，配置未显式替换 | TiledMapAsset 引用外部 TSX 时接入。在 Native 构建验证实际导出为 jsb.TextAsset，必要时补替换规则 |
| JsonAsset | [json-asset.ts](../cocos/asset/assets/json-asset.ts) | TS 实现 | assets/index.jsb.ts 重导出 TS | 按导入需求新增 TS 复用薄壳 |

## UI 控件与按特性启用的组件

| 类 | TS 实现 | C++ 实现或后端 | 当前 JSB | 实施动作 |
| --- | --- | --- | --- | --- |
| Layout | [layout.ts](../cocos/ui/layout.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| SafeArea | [safe-area.ts](../cocos/ui/safe-area.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| UICoordinateTracker | [ui-coordinate-tracker.ts](../cocos/ui/ui-coordinate-tracker.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| Button | [button.ts](../cocos/ui/button.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| Toggle | [toggle.ts](../cocos/ui/toggle.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ToggleContainer | [toggle-container.ts](../cocos/ui/toggle-container.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| Slider | [slider.ts](../cocos/ui/slider.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ProgressBar | [progress-bar.ts](../cocos/ui/progress-bar.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| BlockInputEvents | [block-input-events.ts](../cocos/ui/block-input-events.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ViewGroup | [view-group.ts](../cocos/ui/view-group.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ScrollView | [scroll-view.ts](../cocos/ui/scroll-view.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ScrollBar | [scroll-bar.ts](../cocos/ui/scroll-bar.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| PageView | [page-view.ts](../cocos/ui/page-view.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| PageViewIndicator | [page-view-indicator.ts](../cocos/ui/page-view-indicator.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| EditBox | [edit-box.ts](../cocos/ui/editbox/edit-box.ts) | 后端 [EditBox.h](../native/cocos/ui/edit-box/EditBox.h) 平台输入服务 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| SubContextView | [sub-context-view.ts](../cocos/ui/sub-context-view.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ParticleSystem2D | [particle-system-2d.ts](../cocos/particle-2d/particle-system-2d.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| MotionStreak | [motion-streak-2d.ts](../cocos/particle-2d/motion-streak-2d.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| ParticleAsset | [particle-asset.ts](../cocos/particle-2d/particle-asset.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 资源恢复 |
| TiledMap | [tiled-map.ts](../cocos/tiledmap/tiled-map.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| TiledLayer | [tiled-layer.ts](../cocos/tiledmap/tiled-layer.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| TiledObjectGroup | [tiled-object-group.ts](../cocos/tiledmap/tiled-object-group.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| TiledTile | [tiled-tile.ts](../cocos/tiledmap/tiled-tile.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 行为及公共脚本代理 |
| TiledMapAsset | [tiled-map-asset.ts](../cocos/tiledmap/tiled-map-asset.ts) | TS 实现 | 无逐类壳 | 新增薄壳，复用 TS 资源恢复 |
| TiledUserNodeData | [tiled-layer.ts](../cocos/tiledmap/tiled-layer.ts) | TS 实现 | 无逐类壳 | 内部组件，共用脚本代理 |
| sp.Skeleton | [skeleton.ts](../cocos/spine/skeleton.ts) | 后端 [SkeletonRenderer.h](../native/cocos/editor-support/spine-creator-support/SkeletonRenderer.h) | [index.jsb.ts](../cocos/spine/index.jsb.ts) 聚合导出 | 新增逐类入口，保留现有运行库桥接，聚合入口重导出 |
| sp.SkeletonData | [skeleton-data.ts](../cocos/spine/skeleton-data.ts) | 后端 [SkeletonDataMgr.h](../native/cocos/editor-support/spine-creator-support/SkeletonDataMgr.h) | [index.jsb.ts](../cocos/spine/index.jsb.ts) 聚合导出 | 新增逐类入口，保留现有运行库桥接，聚合入口重导出 |
| dragonBones.ArmatureDisplay | [ArmatureDisplay.ts](../cocos/dragon-bones/ArmatureDisplay.ts) | 后端 [CCArmatureDisplay.h](../native/cocos/editor-support/dragonbones-creator-support/CCArmatureDisplay.h) | [index.jsb.ts](../cocos/dragon-bones/index.jsb.ts) 聚合导出 | 新增逐类入口，保留现有运行库桥接，聚合入口重导出 |
| DragonBonesAsset | [DragonBonesAsset.ts](../cocos/dragon-bones/DragonBonesAsset.ts) | 后端 [CCFactory.h](../native/cocos/editor-support/dragonbones-creator-support/CCFactory.h) | [index.jsb.ts](../cocos/dragon-bones/index.jsb.ts) 聚合导出 | 新增逐类入口，保留现有运行库桥接，聚合入口重导出 |
| DragonBonesAtlasAsset | [DragonBonesAtlasAsset.ts](../cocos/dragon-bones/DragonBonesAtlasAsset.ts) | 后端 [CCFactory.h](../native/cocos/editor-support/dragonbones-creator-support/CCFactory.h) | [index.jsb.ts](../cocos/dragon-bones/index.jsb.ts) 聚合导出 | 新增逐类入口，保留现有运行库桥接，聚合入口重导出 |

## 绘制与运行时依赖

表中“后端”表示该 C++ 实现承担相应功能。多个 TS 类可以共用一处 C++ 算法或数据结构。这些类的逐类薄壳范围沿用既有 API。两个内部纹理子类仅通过 Texture2D 的公开接口使用。

| 类或算法 | TS 实现 | C++ 对应或关联实现 | 当前 JSB | 实施动作 |
| --- | --- | --- | --- | --- |
| Batcher2D | [batcher-2d.ts](../cocos/2d/renderer/batcher-2d.ts) | [Batcher2d.h](../native/cocos/2d/renderer/Batcher2d.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 改造根登记与统一查询 |
| UIRendererManager | [ui-renderer-manager.ts](../cocos/2d/framework/ui-renderer-manager.ts) | [UIRendererManager.h](../native/cocos/2d/framework/UIRendererManager.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 复用并验证启停释放 |
| RenderEntity | [render-entity.ts](../cocos/2d/renderer/render-entity.ts) | [RenderEntity.h](../native/cocos/2d/renderer/RenderEntity.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 复用并验证启停释放 |
| RenderDrawInfo | [render-draw-info.ts](../cocos/2d/renderer/render-draw-info.ts) | [RenderDrawInfo.h](../native/cocos/2d/renderer/RenderDrawInfo.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 复用并验证启停释放 |
| MeshBuffer | [mesh-buffer.ts](../cocos/2d/renderer/mesh-buffer.ts) | [UIMeshBuffer.h](../native/cocos/2d/renderer/UIMeshBuffer.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 复用并验证启停释放 |
| StencilManager | [stencil-manager.ts](../cocos/2d/renderer/stencil-manager.ts) | [StencilManager.h](../native/cocos/2d/renderer/StencilManager.h) 后端 | 通过 [native-2d.jsb.ts](../cocos/2d/renderer/native-2d.jsb.ts) | 复用并验证启停释放 |
| DrawBatch2D | [draw-batch.ts](../cocos/2d/renderer/draw-batch.ts) | [DrawBatch2D.h](../native/cocos/scene/DrawBatch2D.h) 后端 | 无逐类壳 | 复用 |
| BaseRenderData | [render-data.ts](../cocos/2d/renderer/render-data.ts) | [RenderDrawInfo.h](../native/cocos/2d/renderer/RenderDrawInfo.h) 后端 | TS 内 JSB 分支 | 复用 |
| RenderData | [render-data.ts](../cocos/2d/renderer/render-data.ts) | [RenderDrawInfo.h](../native/cocos/2d/renderer/RenderDrawInfo.h) 后端 | TS 内 JSB 分支 | 复用 |
| MeshRenderData | [render-data.ts](../cocos/2d/renderer/render-data.ts) | [RenderDrawInfo.h](../native/cocos/2d/renderer/RenderDrawInfo.h) 后端 | TS 内 JSB 分支 | 复用 |
| BufferAccessor | [buffer-accessor.ts](../cocos/2d/renderer/buffer-accessor.ts) | [UIMeshBuffer.h](../native/cocos/2d/renderer/UIMeshBuffer.h) 后端 | 无逐类壳 | 复用 |
| StaticVBAccessor | [static-vb-accessor.ts](../cocos/2d/renderer/static-vb-accessor.ts) | [UIMeshBuffer.h](../native/cocos/2d/renderer/UIMeshBuffer.h) 后端 | 无逐类壳 | 复用 |
| LinearBufferAccessor | [linear-buffer-accessor.ts](../cocos/2d/renderer/linear-buffer-accessor.ts) | [UIMeshBuffer.h](../native/cocos/2d/renderer/UIMeshBuffer.h) 后端 | 无逐类壳 | 复用 |
| StaticVBChunk | [static-vb-accessor.ts](../cocos/2d/renderer/static-vb-accessor.ts) | [UIMeshBuffer.h](../native/cocos/2d/renderer/UIMeshBuffer.h) 后端 | 无逐类壳 | 复用 |
| DynamicAtlasManager | [atlas-manager.ts](../cocos/2d/utils/dynamic-atlas/atlas-manager.ts) | [DynamicAtlas.h](../native/cocos/2d/renderer/DynamicAtlas.h) 后端 | 无逐类壳 | 复用当前策略，Native 启用开关受限 |
| Atlas | [atlas.ts](../cocos/2d/utils/dynamic-atlas/atlas.ts) | [DynamicAtlas.h](../native/cocos/2d/renderer/DynamicAtlas.h) 后端 | 无逐类壳 | 复用 |
| DynamicAtlasTexture | [atlas.ts](../cocos/2d/utils/dynamic-atlas/atlas.ts) | [Texture2D.h](../native/cocos/core/assets/Texture2D.h) 后端 | 无逐类壳 | 复用 |
| LetterRenderTexture | [font-utils.ts](../cocos/2d/assembler/label/font-utils.ts) | [Texture2D.h](../native/cocos/core/assets/Texture2D.h) 后端 | 无逐类壳 | 复用 |
| LetterAtlas | [font-utils.ts](../cocos/2d/assembler/label/font-utils.ts) | [LetterAtlas.h](../native/cocos/2d/renderer/LetterAtlas.h) 后端 | 无逐类壳 | 复用 |
| CanvasPool | [font-utils.ts](../cocos/2d/assembler/label/font-utils.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| FontAtlas | [bitmap-font.ts](../cocos/2d/assets/bitmap-font.ts) | [BitmapFont.h](../native/cocos/2d/assets/BitmapFont.h) 后端 | [bitmap-font.jsb.ts](../cocos/2d/assets/bitmap-font.jsb.ts) | 复用 |
| FontLetterDefinition | [bitmap-font.ts](../cocos/2d/assets/bitmap-font.ts) | [BitmapFont.h](../native/cocos/2d/assets/BitmapFont.h) 后端 | [bitmap-font.jsb.ts](../cocos/2d/assets/bitmap-font.jsb.ts) | 复用 |
| TextStyle | [text-style.ts](../cocos/2d/assembler/label/text-style.ts) | [TextMetrics.h](../native/cocos/2d/renderer/TextMetrics.h) 后端 | 无逐类壳 | 复用 |
| TextLayout | [text-layout.ts](../cocos/2d/assembler/label/text-layout.ts) | [TextMetrics.h](../native/cocos/2d/renderer/TextMetrics.h) 后端 | 无逐类壳 | 复用 |
| TextProcessing | [text-processing.ts](../cocos/2d/assembler/label/text-processing.ts) | [BitmapFontLayout.h](../native/cocos/2d/renderer/BitmapFontLayout.h) 后端 | 无逐类壳 | 复用 |
| TextOutputLayoutData | [text-output-data.ts](../cocos/2d/assembler/label/text-output-data.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| TextOutputRenderData | [text-output-data.ts](../cocos/2d/assembler/label/text-output-data.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| HtmlTextParser | [html-text-parser.ts](../cocos/2d/utils/html-text-parser.ts) | [RichTextParser.h](../native/cocos/2d/renderer/RichTextParser.h) 后端 | 无逐类壳 | 复用 |
| LRUCache | [text-utils.ts](../cocos/2d/utils/text-utils.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| Simple | [simple.ts](../cocos/2d/assembler/sprite/simple.ts) | [SpriteGeometry.h](../native/cocos/2d/renderer/SpriteGeometry.h) 后端 | assembler/index.jsb.ts 聚合入口 | 复用 |
| Sliced | [sliced.ts](../cocos/2d/assembler/sprite/sliced.ts) | [SpriteGeometry.h](../native/cocos/2d/renderer/SpriteGeometry.h) 后端 | assembler/index.jsb.ts 聚合入口 | 复用 |
| Tiled | [tiled.ts](../cocos/2d/assembler/sprite/tiled.ts) | [SpriteGeometry.h](../native/cocos/2d/renderer/SpriteGeometry.h) 后端 | assembler/index.jsb.ts 聚合入口 | 复用 |
| BarFilled | [bar-filled.ts](../cocos/2d/assembler/sprite/bar-filled.ts) | [SpriteGeometry.h](../native/cocos/2d/renderer/SpriteGeometry.h) 后端 | assembler/index.jsb.ts 聚合入口 | 复用 |
| RadialFilled | [radial-filled.ts](../cocos/2d/assembler/sprite/radial-filled.ts) | [SpriteGeometry.h](../native/cocos/2d/renderer/SpriteGeometry.h) 后端 | assembler/index.jsb.ts 聚合入口 | 复用 |
| GraphicsAssembler | [graphics-assembler.ts](../cocos/2d/assembler/graphics/webgl/graphics-assembler.ts) | [GraphicsGeometry.h](../native/cocos/2d/geometry/GraphicsGeometry.h) 后端 | assembler/graphics/index.jsb.ts 聚合入口 | 复用 |
| Impl | [impl.ts](../cocos/2d/assembler/graphics/webgl/impl.ts) | [GraphicsGeometry.h](../native/cocos/2d/geometry/GraphicsGeometry.h) 后端 | assembler/graphics/index.jsb.ts 聚合入口 | 复用 |
| Path | [impl.ts](../cocos/2d/assembler/graphics/webgl/impl.ts) | [GraphicsGeometry.h](../native/cocos/2d/geometry/GraphicsGeometry.h) 后端 | assembler/graphics/index.jsb.ts 聚合入口 | 复用 |
| Point | [impl.ts](../cocos/2d/assembler/graphics/webgl/impl.ts) | [GraphicsGeometry.h](../native/cocos/2d/geometry/GraphicsGeometry.h) 后端 | assembler/graphics/index.jsb.ts 聚合入口 | 复用 |
| earcut | [earcut.ts](../cocos/2d/assembler/graphics/webgl/earcut.ts) | [GraphicsEarcut.h](../native/cocos/2d/geometry/GraphicsEarcut.h) 后端 | assembler/graphics/index.jsb.ts 聚合入口 | 复用 |
| Root | [root.ts](../cocos/root.ts) | [Root.h](../native/cocos/core/Root.h) 后端 | [root.jsb.ts](../cocos/root.jsb.ts) | 复用 |
| RenderScene | [render-scene.ts](../cocos/render-scene/core/render-scene.ts) | [RenderScene.h](../native/cocos/scene/RenderScene.h) 后端 | [render-scene.jsb.ts](../cocos/render-scene/core/render-scene.jsb.ts) | 复用 |
| RenderWindow | [render-window.ts](../cocos/render-scene/core/render-window.ts) | [RenderWindow.h](../native/cocos/scene/RenderWindow.h) 后端 | [render-window.jsb.ts](../cocos/render-scene/core/render-window.jsb.ts) | 复用 |
| Model | [model.ts](../cocos/render-scene/scene/model.ts) | [Model.h](../native/cocos/scene/Model.h) 后端 | [model.jsb.ts](../cocos/render-scene/scene/model.jsb.ts) | 复用 |
| Pass | [pass.ts](../cocos/render-scene/core/pass.ts) | [Pass.h](../native/cocos/scene/Pass.h) 后端 | [pass.jsb.ts](../cocos/render-scene/core/pass.jsb.ts) | 复用 |
| RenderingSubMesh | [rendering-sub-mesh.ts](../cocos/asset/assets/rendering-sub-mesh.ts) | [RenderingSubMesh.h](../native/cocos/core/assets/RenderingSubMesh.h) 后端 | [rendering-sub-mesh.jsb.ts](../cocos/asset/assets/rendering-sub-mesh.jsb.ts) | 复用 |
| renderer.scene.Camera | [camera.ts](../cocos/render-scene/scene/camera.ts) | [Camera.h](../native/cocos/scene/Camera.h) 后端 | [camera.jsb.ts](../cocos/render-scene/scene/camera.jsb.ts) | 复用 |
| Device | [device.ts](../cocos/gfx/base/device.ts) | [GFXDevice.h](../native/cocos/renderer/gfx-base/GFXDevice.h) 后端 | gfx/index.jsb.ts | 复用 |
| Texture | [texture.ts](../cocos/gfx/base/texture.ts) | [GFXTexture.h](../native/cocos/renderer/gfx-base/GFXTexture.h) 后端 | gfx/index.jsb.ts | 复用 |
| Sampler | [sampler.ts](../cocos/gfx/base/states/sampler.ts) | [GFXSampler.h](../native/cocos/renderer/gfx-base/states/GFXSampler.h) 后端 | gfx/index.jsb.ts | 复用 |
| Buffer | [buffer.ts](../cocos/gfx/base/buffer.ts) | [GFXBuffer.h](../native/cocos/renderer/gfx-base/GFXBuffer.h) 后端 | gfx/index.jsb.ts | 复用 |
| InputAssembler | [input-assembler.ts](../cocos/gfx/base/input-assembler.ts) | [GFXInputAssembler.h](../native/cocos/renderer/gfx-base/GFXInputAssembler.h) 后端 | gfx/index.jsb.ts | 复用 |
| DescriptorSet | [descriptor-set.ts](../cocos/gfx/base/descriptor-set.ts) | [GFXDescriptorSet.h](../native/cocos/renderer/gfx-base/GFXDescriptorSet.h) 后端 | gfx/index.jsb.ts | 复用 |
| Shader | [shader.ts](../cocos/gfx/base/shader.ts) | [GFXShader.h](../native/cocos/renderer/gfx-base/GFXShader.h) 后端 | gfx/index.jsb.ts | 复用 |
| DepthStencilState | [pipeline-sub-state.ts](../cocos/gfx/base/pipeline-sub-state.ts) | [GFXDef-common.h](../native/cocos/renderer/gfx-base/GFXDef-common.h) 后端 | pipeline-sub-state.jsb.ts | 复用 |
| Director | [director.ts](../cocos/game/director.ts) | [Root.h](../native/cocos/core/Root.h) 后端 | TS 帧入口 | 改造 start/update/lateUpdate 与销毁提交 |
| ComponentScheduler | [component-scheduler.ts](../cocos/scene-graph/component-scheduler.ts) | TS 逻辑 | TS 调度 | 新增 C++ 生命周期调度器 |
| NodeActivator | [node-activator.ts](../cocos/scene-graph/node-activator.ts) | TS 逻辑 | TS 激活 | 新增 C++ 激活器 |
| Scheduler | [scheduler.ts](../cocos/core/scheduler.ts) | [Scheduler.h](../native/cocos/base/Scheduler.h) 后端 | 无逐类壳 | 复用通用定时器，接入暂停、恢复、取消 |
| AssetManager | [asset-manager.ts](../cocos/asset/asset-manager/asset-manager.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| Bundle | [bundle.ts](../cocos/asset/asset-manager/bundle.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| BuiltinResMgr | [builtin-res-mgr.ts](../cocos/asset/asset-manager/builtin-res-mgr.ts) | [BuiltinResMgr.h](../native/cocos/core/builtin/BuiltinResMgr.h) 后端 | [builtin-res-mgr.jsb.ts](../cocos/asset/asset-manager/builtin-res-mgr.jsb.ts) | 复用 |
| Downloader | [downloader.ts](../cocos/asset/asset-manager/downloader.ts) | [Downloader.h](../native/cocos/network/Downloader.h) 后端 | 无逐类壳 | 复用 |
| Parser | [parser.ts](../cocos/asset/asset-manager/parser.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| Vec2 | [vec2.ts](../cocos/core/math/vec2.ts) | [Vec2.h](../native/cocos/math/Vec2.h) 后端 | 既有值类型转换 | 复用 |
| Vec3 | [vec3.ts](../cocos/core/math/vec3.ts) | [Vec3.h](../native/cocos/math/Vec3.h) 后端 | 既有值类型转换 | 复用 |
| Vec4 | [vec4.ts](../cocos/core/math/vec4.ts) | [Vec4.h](../native/cocos/math/Vec4.h) 后端 | 既有值类型转换 | 复用 |
| Mat4 | [mat4.ts](../cocos/core/math/mat4.ts) | [Mat4.h](../native/cocos/math/Mat4.h) 后端 | 既有值类型转换 | 复用 |
| Color | [color.ts](../cocos/core/math/color.ts) | [Color.h](../native/cocos/math/Color.h) 后端 | 既有值类型转换 | 复用 |
| Rect | [rect.ts](../cocos/core/math/rect.ts) | [Geometry.h](../native/cocos/math/Geometry.h) 后端 | 既有值类型转换 | 复用 |
| Size | [size.ts](../cocos/core/math/size.ts) | [Geometry.h](../native/cocos/math/Geometry.h) 后端 | 既有值类型转换 | 复用 |
| EventHandler | [component-event-handler.ts](../cocos/scene-graph/component-event-handler.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| EventTouch | [event-touch.ts](../cocos/input/types/event/event-touch.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| NodeEventProcessor | [node-event-processor.ts](../cocos/scene-graph/node-event-processor.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| Layers | [layers.ts](../cocos/scene-graph/layers.ts) | [Layers.h](../native/cocos/core/scene-graph/Layers.h) 后端 | [layers.jsb.ts](../cocos/scene-graph/layers.jsb.ts) 已有，配置未显式替换 | 复用现有层掩码，在 Camera/Canvas 验收时核对实际导出 |
| SortingLayers | [sorting-layers.ts](../cocos/sorting/sorting-layers.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| View | [view.ts](../cocos/ui/view.ts) | TS 逻辑 | 无逐类壳 | 复用 |
| ResolutionPolicy | [view.ts](../cocos/ui/view.ts) | TS 逻辑 | 无逐类壳 | 复用 |

下列 C++ 辅助实现由所属组件或聚合绑定调用。迁移时跟随使用它们的组件验证。

| Native 辅助实现 | TS 侧对应功能 | 现有调用入口 | 实施动作 |
| --- | --- | --- | --- |
| [UIModelProxy](../native/cocos/2d/renderer/UIModelProxy.h) | Graphics 的模型提交 | native-2d.jsb.ts 提供 NativeUIModelProxy | 复用 |
| [TextMetrics](../native/cocos/2d/renderer/TextMetrics.h) | Label 字形度量 | 由 Native 文本路径使用 | 复用，验证字号、换行与对齐 |
| [BitmapFontLayout](../native/cocos/2d/renderer/BitmapFontLayout.h) | 位图字体排版 | 由 Native 字体路径使用 | 复用 |
| [RichTextParser](../native/cocos/2d/renderer/RichTextParser.h) | HtmlTextParser | RichText 使用的 Native 实现 | 复用并检查标签解析 |
| [RichTextLayout](../native/cocos/2d/renderer/RichTextLayout.h) | rich-text.ts 的图文分段布局 | RichText 使用的 Native 实现 | 复用并检查段落、链接与图片位置 |
| [SpriteGeometry](../native/cocos/2d/renderer/SpriteGeometry.h) | 五种 Sprite assembler | Sprite 使用的 Native 实现 | 复用并覆盖各 Sprite 类型 |
| [GraphicsGeometry](../native/cocos/2d/geometry/GraphicsGeometry.h) | GraphicsAssembler、Impl、Path | Graphics 使用的 Native 实现 | 复用 |
| [GraphicsEarcut](../native/cocos/2d/geometry/GraphicsEarcut.h) | earcut.ts 三角剖分 | Graphics 几何路径 | 复用 |

## 实施顺序与验收

下列批次用于验收本期 2D 迁移。表中通过 ScriptComponent 执行 TS 行为的内置组件处于过渡期。最终每个受支持的内置组件都有 C++ 运行时实现，场景切换与组件帧阶段也由 C++ 推进。届时可用仅含内置组件的场景核对，激活、连续更新和切场景期间，内置组件的生命周期回调均在 C++ 执行。

| 批次 | 前置 | 实施内容 | 验收场景 |
| --- | --- | --- | --- |
| 0 · 记录现状 | — | 使用正式的 UITransform、Sprite 与用户脚本采集混合组件生命周期顺序、Prefab 引用与 2D 绘制基准。核对 [Native 替换](../cc.config.json) 和 [n2d 注册](../native/tools/swig-config/2d.i)。 | 同一场景可重复生成回调序列和渲染基准。 |
| 1 · 对象与脚本入口 | 0 | 改造 Component、Node 的所有权与统一组件数组，新增 ScriptComponent 和公共薄壳。由 JSB 接入 Scene、SceneAsset、Prefab 的 TS 读写流程，在恢复期间挂载组件并推迟激活。 | 旧场景及 Prefab 加载、保存、重载后，组件顺序、脚本字段和引用身份一致。add/get、事件参数和反序列化引用指向同一实例。首次激活能访问完整对象图。 |
| 2 · 生命周期 | 1 | 新增 C++ NodeActivator、ComponentScheduler，在 Director 既有阶段调用。接入定时器、延迟销毁、JS 异常处理和释放。 | C++ 与脚本按执行顺序交错，回调中增删组件、切场景和 GC 压力下的 trace 与基线一致。 |
| 3 · 首个 Sprite | 1、2 | 复用 Asset → ImageAsset/纹理、EffectAsset → Material → MaterialInstance、SpriteFrame/SpriteAtlas。准备 Renderer/UIRenderer 公共查询和可组合渲染逻辑。首个直接导出类型为 n2d.Sprite，UITransform 暂经统一查询取得旧 Native 数据。 | 旧场景 Sprite 可反序列化、设置材质与切帧。每个 Sprite 仅一个 C++ 组件，启停、绘制和释放各走一次。 |
| 4 · 变换、透明度与绘制 | 3 | 将 UITransform、UIOpacity 切换到直接绑定。先验证 Font，再验证 TTFFont 和 BitmapFont，最后验证派生自 BitmapFont 的 LabelAtlas。Label 和 Graphics 可分别迁移。 | 三种具体字体在场景重载后保留类型，位图字体的帧引用与字形度量正确。尺寸、锚点、层级透明度和路径几何与基线一致，启停后无重复提交。 |
| 5 · 复合组件 | 4 | Graphics/Sprite 就绪后接入 Mask。Label/Sprite 与图集资源就绪后接入 RichText。明确 Mask 内嵌绘制对象和 RichText 池化对象的所有权。 | 嵌套遮罩、图文混排、字体或图集切换、节点回收均正确，内部对象不会重复登记为 Node 组件。 |
| 6a · Camera 与渲染根 | 2、4 | 完成 CameraComponent 与组件薄壳，通过薄壳读写相机配置和目标纹理引用。完成 RenderRoot2D 直接绑定和根登记去重。 | 保存再加载后，相机配置及 RenderTexture 引用还原。相机创建幂等，可独立启停、切换目标。显式渲染根可独立登记和移除。 |
| 6b · Canvas | 6a | 新增 C++ Canvas 和 canvas.jsb.ts，由薄壳读写可空的 cameraComponent 引用。接入可选 Widget 对齐、view/screen 度量、相机通知与同节点根装配。和 RenderRoot2D 同批启用构建替换。 | Prefab 往返后，空引用保持为空，跨节点引用指向恢复后的 Camera。自动补齐的根不写入场景，显式根加载后复用，两种情形均只登记一次。对照 TS 验证屏幕与离屏正交半高、换相机、启停和销毁。 |
| 7 · 按使用特性接入 | 相应核心依赖 | UI 先接布局、Button、ViewGroup，再接 Toggle 和 ScrollView，最后 PageView 与指示器。粒子先接 ParticleAsset 和 SpriteFrame，地图先接 TiledMapAsset、外部 TSX 的 TextAsset 和图层帧。Spine 先接 SkeletonData 和纹理，DragonBones 先接 DragonBonesAsset、DragonBonesAtlasAsset 和纹理。 | 分别加载启用特性的场景，验证粒子帧、地图的外部图块与图层、骨骼纹理的引用恢复和绘制。共享资源须在单个使用者销毁后仍可供其他使用者访问。 |

第 7 批各启用特性还需在 Web 和 Native 验证组件查询、引用恢复和销毁。SpriteRenderer 与 ModelRenderer 暂缓，未列入上述批次。

十个直接绑定目标中，八个 2D 组件现均采用 TS 包装类持有原生对象。切换时复用已有绑定类型，移除对应的第二次创建和启停转发。Camera 与 Canvas 均需新增 C++ 组件和独立薄壳。Camera 复用 scene::Camera 后端，Canvas 引用 CameraComponent 并组合 RenderRoot2D。其余保留 TS 行为的引擎组件通过 ScriptComponent 执行。公开 UIRenderer 应保留这些 TS 派生类的查询和继承能力。基础资源的复用以实际 Native 构建的反序列化与引用身份验证为准。
