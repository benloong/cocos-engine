# Cocos Engine 对外类与 JSB 薄壳盘点

日期：2026-11-19

## 范围与判断方式

- 从仓库 `exports/*.ts` 的全部特性入口出发，用 TypeScript 编译器解析重导出、别名及命名空间，按类声明位置去重。结果是所有可选特性的并集，不是单次构建的类数量。
- 运行时可达且该导出路径没有 `@internal`、`@engineInternal`、`@private` 的类列入公开候选；导出可达不等于全部获得稳定公共 API 承诺，需要结合模块和文档标签确认。
- 抽象类、废弃别名、命名空间下的类和具有构造签名的类别名保留；接口、普通类型别名、枚举、函数和单例变量不按类计数。
- 另外扫描导出图所加载的 cocos TS 文件中 `legacyCC.X = Class` / `cclegacy.X = Class` 的显式类赋值，补充全局 API；这类条件赋值只标记为静态候选，实际运行受构建条件控制。
- 第三方与 vendor 集成 API 单列，包含 Spine 库声明、DragonBones 依赖和 Google 平台绑定；这些类型仍是脚本可见 API，不能因单列就忽略其适配，但不应冒充全部为引擎自有类。Editor 扩展入口、任意深路径导入、动态计算属性、对象装配、工厂返回值隐式暴露的类不属于本次静态扫描范围。
- 使用当前 TS 图，未执行 Native 构建替换、特性裁剪或声明生成；所有计数是本工作区源码的静态盘点。无法解析的导出在 JSON 中记录，不将其当作已经完整审计。
- “已有同源薄壳文件”仅指类所在源文件有同路径 `.jsb.ts`；不代表已按目标设计改造、每个类各有独立薄壳或全部绑定可用。聚合 index.jsb.ts 覆盖也不等于拥有独立薄壳。
- 本表是通用 API 索引，不是全部类的薄壳任务清单。目标薄壳范围已限定为 Asset、Node、Component 及其公开子类，详见 [2D 对象范围](native-2d-class-scope.md)。其余类缺少同源文件不构成待办。

复现：`node scripts/audit-public-classes.cjs`。机器清单见 [native-public-class-inventory.json](native-public-class-inventory.json)。

## 统计

| 项目 | 数量 |
| --- | ---: |
| 扫描特性入口 | 50 |
| 全部可达类（含内部、仅类型、第三方） | 737 |
| 引擎自有公开运行时类候选（含 legacy 补充） | 535 |
| 公开候选中已有同源 JSB 文件 | 69 |
| 其中由特性入口导出的公开类候选 | 521 |
| 其中仅由 legacy 全局赋值补充的候选 | 14 |
| 公开候选中缺少同源 JSB 文件 | 466 |
| 引擎自有内部或仅类型类 | 15 |
| 第三方与 vendor 集成可达类 | 187 |
| 其中公开运行时类候选 | 144 |
| 显式 legacy 类赋值位置（含重复） | 182 |
| 未解析导出 | 0 |

## 按源码模块汇总

| 模块 | 公开类候选 | 已有同源 JSB 文件 | 缺少同源 JSB 文件 |
| --- | ---: | ---: | ---: |
| cocos/2d | 36 | 16 | 20 |
| cocos/3d | 22 | 3 | 19 |
| cocos/animation | 24 | 0 | 24 |
| cocos/asset | 30 | 14 | 16 |
| cocos/audio | 2 | 0 | 2 |
| cocos/core | 50 | 0 | 50 |
| cocos/dragon-bones | 12 | 0 | 12 |
| cocos/game | 3 | 0 | 3 |
| cocos/gfx | 87 | 6 | 81 |
| cocos/gi | 10 | 6 | 4 |
| cocos/input | 13 | 0 | 13 |
| cocos/misc | 7 | 0 | 7 |
| cocos/native-binding | 5 | 0 | 5 |
| cocos/particle | 7 | 0 | 7 |
| cocos/particle-2d | 3 | 0 | 3 |
| cocos/physics | 25 | 0 | 25 |
| cocos/physics-2d | 16 | 0 | 16 |
| cocos/primitive | 1 | 0 | 1 |
| cocos/profiler | 1 | 0 | 1 |
| cocos/render-scene | 23 | 8 | 15 |
| cocos/rendering | 74 | 3 | 71 |
| cocos/root.ts | 1 | 1 | 0 |
| cocos/scene-graph | 24 | 12 | 12 |
| cocos/serialization | 3 | 0 | 3 |
| cocos/sorting | 3 | 0 | 3 |
| cocos/spine | 5 | 0 | 5 |
| cocos/terrain | 9 | 0 | 9 |
| cocos/tiledmap | 6 | 0 | 6 |
| cocos/tween | 3 | 0 | 3 |
| cocos/ui | 20 | 0 | 20 |
| cocos/video | 4 | 0 | 4 |
| cocos/web-view | 3 | 0 | 3 |
| cocos/xr | 1 | 0 | 1 |
| extensions/ccpool | 1 | 0 | 1 |
| pal/audio | 1 | 0 | 1 |

## 按入口统计

同一类可由多个入口暴露，此表不能直接相加。

| 入口 | 可达类 | 本入口公开运行时类（引擎自有） |
| --- | ---: | ---: |
| exports/2d.ts | 34 | 33 |
| exports/3d.ts | 18 | 18 |
| exports/affine-transform.ts | 1 | 1 |
| exports/animation.ts | 24 | 24 |
| exports/audio.ts | 3 | 3 |
| exports/base.ts | 267 | 255 |
| exports/custom-pipeline-post-process.ts | 28 | 28 |
| exports/custom-pipeline.ts | 8 | 8 |
| exports/dragon-bones.ts | 83 | 11 |
| exports/geometry-renderer.ts | 1 | 1 |
| exports/gfx-empty.ts | 1 | 1 |
| exports/gfx-webgl.ts | 1 | 1 |
| exports/gfx-webgl2.ts | 1 | 1 |
| exports/gfx-webgpu.ts | 1 | 1 |
| exports/graphics.ts | 1 | 1 |
| exports/intersection-2d.ts | 1 | 1 |
| exports/legacy-pipeline.ts | 16 | 16 |
| exports/light-probe.ts | 10 | 10 |
| exports/mask.ts | 1 | 1 |
| exports/native-2d-poc.ts | 2 | 2 |
| exports/particle-2d.ts | 3 | 3 |
| exports/particle.ts | 7 | 7 |
| exports/physics-2d-box2d-jsb.ts | 0 | 0 |
| exports/physics-2d-box2d-wasm.ts | 0 | 0 |
| exports/physics-2d-box2d.ts | 0 | 0 |
| exports/physics-2d-builtin.ts | 0 | 0 |
| exports/physics-2d-framework.ts | 15 | 15 |
| exports/physics-ammo.ts | 0 | 0 |
| exports/physics-builtin.ts | 1 | 1 |
| exports/physics-cannon.ts | 0 | 0 |
| exports/physics-framework.ts | 25 | 25 |
| exports/physics-physx.ts | 0 | 0 |
| exports/primitive.ts | 1 | 1 |
| exports/profiler.ts | 1 | 1 |
| exports/rich-text.ts | 1 | 1 |
| exports/skeletal-animation.ts | 4 | 3 |
| exports/sorting-2d.ts | 2 | 2 |
| exports/sorting.ts | 2 | 2 |
| exports/spine.ts | 92 | 4 |
| exports/terrain.ts | 9 | 9 |
| exports/tiled-map.ts | 6 | 6 |
| exports/tween.ts | 3 | 3 |
| exports/ui-skew.ts | 1 | 1 |
| exports/ui.ts | 20 | 20 |
| exports/vendor-google.ts | 28 | 0 |
| exports/video.ts | 2 | 2 |
| exports/webview.ts | 1 | 1 |
| exports/worker-pool.ts | 1 | 1 |
| exports/worker.ts | 0 | 0 |
| exports/xr.ts | 1 | 1 |

## 引擎自有公开运行时类清单

### cocos/2d（36）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| BitmapFont | BitmapFont, legacyCC.BitmapFont | [cocos/2d/assets/bitmap-font.ts:124](../cocos/2d/assets/bitmap-font.ts#L124) | [已有文件](../cocos/2d/assets/bitmap-font.jsb.ts) |
| Font | Font, legacyCC.Font | [cocos/2d/assets/font.ts:34](../cocos/2d/assets/font.ts#L34) | [已有文件](../cocos/2d/assets/font.jsb.ts) |
| LabelAtlas | LabelAtlas, legacyCC.LabelAtlas | [cocos/2d/assets/label-atlas.ts:34](../cocos/2d/assets/label-atlas.ts#L34) | [已有文件](../cocos/2d/assets/label-atlas.jsb.ts) |
| SpriteAtlas | SpriteAtlas, legacyCC.SpriteAtlas | [cocos/2d/assets/sprite-atlas.ts:48](../cocos/2d/assets/sprite-atlas.ts#L48) | [已有文件](../cocos/2d/assets/sprite-atlas.jsb.ts) |
| SpriteFrame | SpriteFrame, legacyCC.SpriteFrame | [cocos/2d/assets/sprite-frame.ts:233](../cocos/2d/assets/sprite-frame.ts#L233) | [已有文件](../cocos/2d/assets/sprite-frame.jsb.ts) |
| TTFFont | TTFFont, legacyCC.TTFFont | [cocos/2d/assets/ttf-font.ts:34](../cocos/2d/assets/ttf-font.ts#L34) | [已有文件](../cocos/2d/assets/ttf-font.jsb.ts) |
| Graphics | GraphicsComponent, Graphics, legacyCC.Graphics, legacyCC.GraphicsComponent | [cocos/2d/components/graphics.ts:70](../cocos/2d/components/graphics.ts#L70) | [已有文件](../cocos/2d/components/graphics.jsb.ts) |
| LabelOutline（废弃） | LabelOutline, LabelOutlineComponent, legacyCC.LabelOutline, legacyCC.LabelOutlineComponent | [cocos/2d/components/label-outline.ts:40](../cocos/2d/components/label-outline.ts#L40) | 缺少 |
| LabelShadow（废弃） | LabelShadow | [cocos/2d/components/label-shadow.ts:37](../cocos/2d/components/label-shadow.ts#L37) | 缺少 |
| Label | Label, LabelComponent, legacyCC.Label, legacyCC.LabelComponent | [cocos/2d/components/label.ts:176](../cocos/2d/components/label.ts#L176) | [已有文件](../cocos/2d/components/label.jsb.ts) |
| Mask | MaskComponent, Mask, legacyCC.Mask, legacyCC.MaskComponent | [cocos/2d/components/mask.ts:111](../cocos/2d/components/mask.ts#L111) | [已有文件](../cocos/2d/components/mask.jsb.ts) |
| RichText | RichTextComponent, RichText, legacyCC.RichText, legacyCC.RichTextComponent | [cocos/2d/components/rich-text.ts:151](../cocos/2d/components/rich-text.ts#L151) | [已有文件](../cocos/2d/components/rich-text.jsb.ts) |
| Sprite | Sprite, SpriteComponent, legacyCC.Sprite, legacyCC.SpriteComponent | [cocos/2d/components/sprite.ts:167](../cocos/2d/components/sprite.ts#L167) | [已有文件](../cocos/2d/components/sprite.jsb.ts) |
| UIMeshRenderer（废弃） | UIMeshRenderer, UIModelComponent, legacyCC.UIMeshRenderer, legacyCC.UIModelComponent | [cocos/2d/components/ui-mesh-renderer.ts:53](../cocos/2d/components/ui-mesh-renderer.ts#L53) | 缺少 |
| UIOpacity | UIOpacity, UIOpacityComponent | [cocos/2d/components/ui-opacity.ts:39](../cocos/2d/components/ui-opacity.ts#L39) | [已有文件](../cocos/2d/components/ui-opacity.jsb.ts) |
| UIStaticBatch（废弃） | UIStaticBatch, UIStaticBatchComponent | [cocos/2d/components/ui-static-batch.ts:53](../cocos/2d/components/ui-static-batch.ts#L53) | 缺少 |
| Canvas | Canvas, CanvasComponent, legacyCC.Canvas, legacyCC.CanvasComponent | [cocos/2d/framework/canvas.ts:53](../cocos/2d/framework/canvas.ts#L53) | 缺少 |
| RenderRoot2D | RenderRoot2D | [cocos/2d/framework/render-root-2d.ts:36](../cocos/2d/framework/render-root-2d.ts#L36) | [已有文件](../cocos/2d/framework/render-root-2d.jsb.ts) |
| SpriteRenderer | SpriteRenderer | [cocos/2d/framework/sprite-renderer.ts:46](../cocos/2d/framework/sprite-renderer.ts#L46) | 缺少 |
| UIComponent（废弃） | UIComponent | [cocos/2d/framework/ui-component.ts:40](../cocos/2d/framework/ui-component.ts#L40) | 缺少 |
| UIRenderer | Renderable2D, RenderComponent, UIRenderable, UIRenderer, legacyCC.internal.Renderable2D, legacyCC.internal.UIRenderer | [cocos/2d/framework/ui-renderer.ts:116](../cocos/2d/framework/ui-renderer.ts#L116) | 缺少 |
| UISkew | UISkew, legacyCC.UISkew | [cocos/2d/framework/ui-skew.ts:39](../cocos/2d/framework/ui-skew.ts#L39) | 缺少 |
| UITransform | UITransform, UITransformComponent, legacyCC.UITransformComponent | [cocos/2d/framework/ui-transform.ts:49](../cocos/2d/framework/ui-transform.ts#L49) | [已有文件](../cocos/2d/framework/ui-transform.jsb.ts) |
| NativeUITransformPoc | NativeUITransformPoc | [cocos/2d/poc/native-2d-poc.ts:37](../cocos/2d/poc/native-2d-poc.ts#L37) | [已有文件](../cocos/2d/poc/native-2d-poc.jsb.ts) |
| NativeSpritePoc | NativeSpritePoc | [cocos/2d/poc/native-2d-poc.ts:81](../cocos/2d/poc/native-2d-poc.ts#L81) | [已有文件](../cocos/2d/poc/native-2d-poc.jsb.ts) |
| Batcher2D | UI, legacyCC.internal.Batcher2D | [cocos/2d/renderer/batcher-2d.ts:88](../cocos/2d/renderer/batcher-2d.ts#L88) | 缺少 |
| QuadRenderData | QuadRenderData | [cocos/2d/renderer/deprecated.ts:106](../cocos/2d/renderer/deprecated.ts#L106) | 缺少 |
| MeshBuffer（废弃） | MeshBuffer | [cocos/2d/renderer/mesh-buffer.ts:52](../cocos/2d/renderer/mesh-buffer.ts#L52) | 缺少 |
| BaseRenderData（废弃） | BaseRenderData | [cocos/2d/renderer/render-data.ts:57](../cocos/2d/renderer/render-data.ts#L57) | 缺少 |
| RenderData（废弃） | RenderData | [cocos/2d/renderer/render-data.ts:223](../cocos/2d/renderer/render-data.ts#L223) | 缺少 |
| MeshRenderData（废弃） | MeshRenderData | [cocos/2d/renderer/render-data.ts:547](../cocos/2d/renderer/render-data.ts#L547) | 缺少 |
| StencilManager（废弃） | StencilManager | [cocos/2d/renderer/stencil-manager.ts:86](../cocos/2d/renderer/stencil-manager.ts#L86) | 缺少 |
| DynamicAtlasManager | DynamicAtlasManager | [cocos/2d/utils/dynamic-atlas/atlas-manager.ts:45](../cocos/2d/utils/dynamic-atlas/atlas-manager.ts#L45) | 缺少 |
| Atlas | Atlas | [cocos/2d/utils/dynamic-atlas/atlas.ts:38](../cocos/2d/utils/dynamic-atlas/atlas.ts#L38) | 缺少 |
| HtmlTextParser（废弃） | HtmlTextParser, legacyCC._Test.HtmlTextParser | [cocos/2d/utils/html-text-parser.ts:72](../cocos/2d/utils/html-text-parser.ts#L72) | 缺少 |
| LRUCache | LRUCache | [cocos/2d/utils/text-utils.ts:77](../cocos/2d/utils/text-utils.ts#L77) | 缺少 |

### cocos/3d（22）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Mesh | Mesh, legacyCC.Mesh | [cocos/3d/assets/mesh.ts:279](../cocos/3d/assets/mesh.ts#L279) | [已有文件](../cocos/3d/assets/mesh.jsb.ts) |
| Skeleton | Skeleton, legacyCC.Skeleton | [cocos/3d/assets/skeleton.ts:34](../cocos/3d/assets/skeleton.ts#L34) | [已有文件](../cocos/3d/assets/skeleton.jsb.ts) |
| MeshRenderer | MeshRenderer, ModelComponent, legacyCC.ModelComponent | [cocos/3d/framework/mesh-renderer.ts:308](../cocos/3d/framework/mesh-renderer.ts#L308) | 缺少 |
| DirectionalLight | DirectionalLight, DirectionalLightComponent, legacyCC.DirectionalLightComponent | [cocos/3d/lights/directional-light-component.ts:41](../cocos/3d/lights/directional-light-component.ts#L41) | 缺少 |
| Light | Light, LightComponent, legacyCC.LightComponent | [cocos/3d/lights/light-component.ts:106](../cocos/3d/lights/light-component.ts#L106) | 缺少 |
| PointLight | PointLight | [cocos/3d/lights/point-light-component.ts:37](../cocos/3d/lights/point-light-component.ts#L37) | 缺少 |
| RangedDirectionalLight | RangedDirectionalLight | [cocos/3d/lights/ranged-directional-light-component.ts:34](../cocos/3d/lights/ranged-directional-light-component.ts#L34) | 缺少 |
| SphereLight | SphereLight, SphereLightComponent, legacyCC.SphereLightComponent | [cocos/3d/lights/sphere-light-component.ts:38](../cocos/3d/lights/sphere-light-component.ts#L38) | 缺少 |
| SpotLight | SpotLight, SpotLightComponent, legacyCC.SpotLightComponent | [cocos/3d/lights/spot-light-component.ts:38](../cocos/3d/lights/spot-light-component.ts#L38) | 缺少 |
| LOD | LOD | [cocos/3d/lod/lodgroup-component.ts:39](../cocos/3d/lod/lodgroup-component.ts#L39) | 缺少 |
| LODGroup | LODGroup | [cocos/3d/lod/lodgroup-component.ts:216](../cocos/3d/lod/lodgroup-component.ts#L216) | 缺少 |
| BatchingUtility | BatchingUtility | [cocos/3d/misc/batch-utils.ts:47](../cocos/3d/misc/batch-utils.ts#L47) | 缺少 |
| MeshUtils | utils.MeshUtils | [cocos/3d/misc/create-mesh.ts:392](../cocos/3d/misc/create-mesh.ts#L392) | [已有文件](../cocos/3d/misc/create-mesh.jsb.ts) |
| ReflectionProbe | ReflectionProbe | [cocos/3d/reflection-probe/reflection-probe-component.ts:63](../cocos/3d/reflection-probe/reflection-probe-component.ts#L63) | 缺少 |
| ReflectionProbeManager | ReflectionProbeManager | [cocos/3d/reflection-probe/reflection-probe-manager.ts:40](../cocos/3d/reflection-probe/reflection-probe-manager.ts#L40) | 缺少 |
| DataPoolManager | legacyCC.internal.DataPoolManager | [cocos/3d/skeletal-animation/data-pool-manager.ts:31](../cocos/3d/skeletal-animation/data-pool-manager.ts#L31) | 缺少 |
| SkeletalAnimationState | SkeletalAnimationState | [cocos/3d/skeletal-animation/skeletal-animation-state.ts:52](../cocos/3d/skeletal-animation/skeletal-animation-state.ts#L52) | 缺少 |
| Socket | Socket | [cocos/3d/skeletal-animation/skeletal-animation.ts:47](../cocos/3d/skeletal-animation/skeletal-animation.ts#L47) | 缺少 |
| SkeletalAnimation | SkeletalAnimation, SkeletalAnimationComponent, legacyCC.SkeletalAnimationComponent | [cocos/3d/skeletal-animation/skeletal-animation.ts:97](../cocos/3d/skeletal-animation/skeletal-animation.ts#L97) | 缺少 |
| SkinnedMeshUnit | SkinnedMeshUnit, SkinningModelUnit, legacyCC.SkinningModelUnit | [cocos/3d/skinned-mesh-renderer/skinned-mesh-batch-renderer.ts:45](../cocos/3d/skinned-mesh-renderer/skinned-mesh-batch-renderer.ts#L45) | 缺少 |
| SkinnedMeshBatchRenderer | BatchedSkinningModelComponent, SkinnedMeshBatchRenderer, legacyCC.BatchedSkinningModelComponent | [cocos/3d/skinned-mesh-renderer/skinned-mesh-batch-renderer.ts:134](../cocos/3d/skinned-mesh-renderer/skinned-mesh-batch-renderer.ts#L134) | 缺少 |
| SkinnedMeshRenderer | SkinnedMeshRenderer, SkinningModelComponent, legacyCC.SkinningModelComponent | [cocos/3d/skinned-mesh-renderer/skinned-mesh-renderer.ts:44](../cocos/3d/skinned-mesh-renderer/skinned-mesh-renderer.ts#L44) | 缺少 |

### cocos/animation（24）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| AnimationClip | AnimationClip, legacyCC.AnimationClip | [cocos/animation/animation-clip.ts:102](../cocos/animation/animation-clip.ts#L102) | 缺少 |
| Animation | Animation, AnimationComponent, legacyCC.Animation, legacyCC.AnimationComponent | [cocos/animation/animation-component.ts:47](../cocos/animation/animation-component.ts#L47) | 缺少 |
| RatioSampler（废弃） | RatioSampler, legacyCC.RatioSampler | [cocos/animation/animation-curve.ts:32](../cocos/animation/animation-curve.ts#L32) | 缺少 |
| AnimCurve（废弃） | AnimCurve, legacyCC.AnimCurve | [cocos/animation/animation-curve.ts:69](../cocos/animation/animation-curve.ts#L69) | 缺少 |
| EventInfo | EventInfo | [cocos/animation/animation-curve.ts:214](../cocos/animation/animation-curve.ts#L214) | 缺少 |
| AnimationManager | AnimationManager, legacyCC.AnimationManager | [cocos/animation/animation-manager.ts:40](../cocos/animation/animation-manager.ts#L40) | 缺少 |
| AnimationState | AnimationState, legacyCC.AnimationState | [cocos/animation/animation-state.ts:85](../cocos/animation/animation-state.ts#L85) | 缺少 |
| CubicSplineNumberValue（废弃） | animation.CubicSplineNumberValue | [cocos/animation/cubic-spline-value.ts:152](../cocos/animation/cubic-spline-value.ts#L152) | 缺少 |
| AnimationController | animation.AnimationController | [cocos/animation/marionette/animation-controller.ts:56](../cocos/animation/marionette/animation-controller.ts#L56) | 缺少 |
| StateMachineComponent | animation.StateMachineComponent | [cocos/animation/marionette/state-machine/state-machine-component.ts:33](../cocos/animation/marionette/state-machine/state-machine-component.ts#L33) | 缺少 |
| HierarchyPath（废弃） | animation.HierarchyPath | [cocos/animation/target-path.ts:73](../cocos/animation/target-path.ts#L73) | 缺少 |
| ComponentPath（废弃） | animation.ComponentPath | [cocos/animation/target-path.ts:99](../cocos/animation/target-path.ts#L99) | 缺少 |
| ColorTrack | animation.ColorTrack | [cocos/animation/tracks/color-track.ts:39](../cocos/animation/tracks/color-track.ts#L39) | 缺少 |
| ObjectTrack | animation.ObjectTrack | [cocos/animation/tracks/object-track.ts:36](../cocos/animation/tracks/object-track.ts#L36) | 缺少 |
| QuatTrack | animation.QuatTrack | [cocos/animation/tracks/quat-track.ts:36](../cocos/animation/tracks/quat-track.ts#L36) | 缺少 |
| RealTrack | animation.RealTrack | [cocos/animation/tracks/real-track.ts:36](../cocos/animation/tracks/real-track.ts#L36) | 缺少 |
| SizeTrack | animation.SizeTrack | [cocos/animation/tracks/size-track.ts:39](../cocos/animation/tracks/size-track.ts#L39) | 缺少 |
| TrackPath | animation.TrackPath | [cocos/animation/tracks/track.ts:60](../cocos/animation/tracks/track.ts#L60) | 缺少 |
| Track（抽象） | animation.Track | [cocos/animation/tracks/track.ts:453](../cocos/animation/tracks/track.ts#L453) | 缺少 |
| VectorTrack | animation.VectorTrack | [cocos/animation/tracks/vector-track.ts:39](../cocos/animation/tracks/vector-track.ts#L39) | 缺少 |
| MorphWeightValueProxy | animation.MorphWeightValueProxy | [cocos/animation/value-proxy-factories/morph-weights.ts:35](../cocos/animation/value-proxy-factories/morph-weights.ts#L35) | 缺少 |
| MorphWeightsValueProxy | animation.MorphWeightsValueProxy | [cocos/animation/value-proxy-factories/morph-weights.ts:66](../cocos/animation/value-proxy-factories/morph-weights.ts#L66) | 缺少 |
| MorphWeightsAllValueProxy | animation.MorphWeightsAllValueProxy | [cocos/animation/value-proxy-factories/morph-weights.ts:90](../cocos/animation/value-proxy-factories/morph-weights.ts#L90) | 缺少 |
| UniformProxyFactory | animation.UniformProxyFactory | [cocos/animation/value-proxy-factories/uniform.ts:42](../cocos/animation/value-proxy-factories/uniform.ts#L42) | 缺少 |

### cocos/asset（30）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| AssetManager | AssetManager, legacyCC.AssetManager | [cocos/asset/asset-manager/asset-manager.ts:123](../cocos/asset/asset-manager/asset-manager.ts#L123) | 缺少 |
| BuiltinResMgr | BuiltinResMgr | [cocos/asset/asset-manager/builtin-res-mgr.ts:39](../cocos/asset/asset-manager/builtin-res-mgr.ts#L39) | [已有文件](../cocos/asset/asset-manager/builtin-res-mgr.jsb.ts) |
| Bundle | AssetManager.Bundle | [cocos/asset/asset-manager/bundle.ts:44](../cocos/asset/asset-manager/bundle.ts#L44) | 缺少 |
| CacheManager（抽象） | AssetManager.CacheManager | [cocos/asset/asset-manager/cache-manager.ts:36](../cocos/asset/asset-manager/cache-manager.ts#L36) | 缺少 |
| Cache | AssetManager.Cache | [cocos/asset/asset-manager/cache.ts:138](../cocos/asset/asset-manager/cache.ts#L138) | 缺少 |
| Config | legacyCC._Test.Config | [cocos/asset/asset-manager/config.ts:227](../cocos/asset/asset-manager/config.ts#L227) | 缺少 |
| DependUtil | AssetManager.DependUtil | [cocos/asset/asset-manager/depend-util.ts:51](../cocos/asset/asset-manager/depend-util.ts#L51) | 缺少 |
| CCLoader（废弃） | CCLoader | [cocos/asset/asset-manager/deprecated.ts:88](../cocos/asset/asset-manager/deprecated.ts#L88) | 缺少 |
| Downloader | AssetManager.Downloader | [cocos/asset/asset-manager/downloader.ts:142](../cocos/asset/asset-manager/downloader.ts#L142) | 缺少 |
| Parser | AssetManager.Parser | [cocos/asset/asset-manager/parser.ts:45](../cocos/asset/asset-manager/parser.ts#L45) | 缺少 |
| Pipeline | AssetManager.Pipeline | [cocos/asset/asset-manager/pipeline.ts:36](../cocos/asset/asset-manager/pipeline.ts#L36) | 缺少 |
| RequestItem | AssetManager.RequestItem | [cocos/asset/asset-manager/request-item.ts:35](../cocos/asset/asset-manager/request-item.ts#L35) | 缺少 |
| Task | AssetManager.Task | [cocos/asset/asset-manager/task.ts:43](../cocos/asset/asset-manager/task.ts#L43) | 缺少 |
| Asset | Asset, legacyCC.Asset | [cocos/asset/assets/asset.ts:55](../cocos/asset/assets/asset.ts#L55) | [已有文件](../cocos/asset/assets/asset.jsb.ts) |
| BufferAsset | BufferAsset, legacyCC.BufferAsset | [cocos/asset/assets/buffer-asset.ts:36](../cocos/asset/assets/buffer-asset.ts#L36) | [已有文件](../cocos/asset/assets/buffer-asset.jsb.ts) |
| EffectAsset | EffectAsset, legacyCC.EffectAsset | [cocos/asset/assets/effect-asset.ts:219](../cocos/asset/assets/effect-asset.ts#L219) | [已有文件](../cocos/asset/assets/effect-asset.jsb.ts) |
| ImageAsset | ImageAsset, legacyCC.ImageAsset | [cocos/asset/assets/image-asset.ts:181](../cocos/asset/assets/image-asset.ts#L181) | [已有文件](../cocos/asset/assets/image-asset.jsb.ts) |
| JsonAsset | JsonAsset, legacyCC.JsonAsset | [cocos/asset/assets/json-asset.ts:34](../cocos/asset/assets/json-asset.ts#L34) | 缺少 |
| Material | Material, legacyCC.Material | [cocos/asset/assets/material.ts:87](../cocos/asset/assets/material.ts#L87) | [已有文件](../cocos/asset/assets/material.jsb.ts) |
| RenderTexture | RenderTexture, legacyCC.RenderTexture | [cocos/asset/assets/render-texture.ts:74](../cocos/asset/assets/render-texture.ts#L74) | [已有文件](../cocos/asset/assets/render-texture.jsb.ts) |
| RenderingSubMesh | RenderingSubMesh | [cocos/asset/assets/rendering-sub-mesh.ts:90](../cocos/asset/assets/rendering-sub-mesh.ts#L90) | [已有文件](../cocos/asset/assets/rendering-sub-mesh.jsb.ts) |
| SceneAsset | SceneAsset, legacyCC.SceneAsset | [cocos/asset/assets/scene-asset.ts:36](../cocos/asset/assets/scene-asset.ts#L36) | [已有文件](../cocos/asset/assets/scene-asset.jsb.ts) |
| Script | Script, legacyCC._Script | [cocos/asset/assets/scripts.ts:34](../cocos/asset/assets/scripts.ts#L34) | 缺少 |
| JavaScript | JavaScript, legacyCC._JavaScript | [cocos/asset/assets/scripts.ts:46](../cocos/asset/assets/scripts.ts#L46) | 缺少 |
| TypeScript | TypeScript, legacyCC._TypeScript | [cocos/asset/assets/scripts.ts:58](../cocos/asset/assets/scripts.ts#L58) | 缺少 |
| SimpleTexture | legacyCC.SimpleTexture | [cocos/asset/assets/simple-texture.ts:60](../cocos/asset/assets/simple-texture.ts#L60) | [已有文件](../cocos/asset/assets/simple-texture.jsb.ts) |
| TextAsset | TextAsset, legacyCC.TextAsset | [cocos/asset/assets/text-asset.ts:34](../cocos/asset/assets/text-asset.ts#L34) | [已有文件](../cocos/asset/assets/text-asset.jsb.ts) |
| Texture2D | Texture2D, legacyCC.Texture2D | [cocos/asset/assets/texture-2d.ts:84](../cocos/asset/assets/texture-2d.ts#L84) | [已有文件](../cocos/asset/assets/texture-2d.jsb.ts) |
| TextureBase | legacyCC.TextureBase | [cocos/asset/assets/texture-base.ts:41](../cocos/asset/assets/texture-base.ts#L41) | [已有文件](../cocos/asset/assets/texture-base.jsb.ts) |
| TextureCube | TextureCube, legacyCC.TextureCube | [cocos/asset/assets/texture-cube.ts:118](../cocos/asset/assets/texture-cube.ts#L118) | [已有文件](../cocos/asset/assets/texture-cube.jsb.ts) |

### cocos/audio（2）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| AudioClip | AudioClip, legacyCC.AudioClip | [cocos/audio/audio-clip.ts:44](../cocos/audio/audio-clip.ts#L44) | 缺少 |
| AudioSource | AudioSource, AudioSourceComponent, legacyCC.AudioSourceComponent | [cocos/audio/audio-source.ts:60](../cocos/audio/audio-source.ts#L60) | 缺少 |

### cocos/core（50）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| RealCurve | RealCurve | [cocos/core/curves/curve.ts:320](../cocos/core/curves/curve.ts#L320) | 缺少 |
| ColorKey | ColorKey | [cocos/core/curves/gradient.ts:35](../cocos/core/curves/gradient.ts#L35) | 缺少 |
| AlphaKey | AlphaKey | [cocos/core/curves/gradient.ts:57](../cocos/core/curves/gradient.ts#L57) | 缺少 |
| Gradient | Gradient | [cocos/core/curves/gradient.ts:82](../cocos/core/curves/gradient.ts#L82) | 缺少 |
| ObjectCurve | ObjectCurve | [cocos/core/curves/object-curve.ts:31](../cocos/core/curves/object-curve.ts#L31) | 缺少 |
| QuatCurve | QuatCurve | [cocos/core/curves/quat-curve.ts:141](../cocos/core/curves/quat-curve.ts#L141) | 缺少 |
| CompactValueTypeArray（废弃） | CompactValueTypeArray | [cocos/core/data/utils/compact-value-type-array.ts:64](../cocos/core/data/utils/compact-value-type-array.ts#L64) | 缺少 |
| AsyncDelegate | AsyncDelegate | [cocos/core/event/async-delegate.ts:49](../cocos/core/event/async-delegate.ts#L49) | 缺少 |
| AABB | geometry.AABB | [cocos/core/geometry/aabb.ts:58](../cocos/core/geometry/aabb.ts#L58) | 缺少 |
| Capsule | geometry.Capsule | [cocos/core/geometry/capsule.ts:35](../cocos/core/geometry/capsule.ts#L35) | 缺少 |
| Keyframe | geometry.Keyframe | [cocos/core/geometry/curve.ts:37](../cocos/core/geometry/curve.ts#L37) | 缺少 |
| AnimationCurve | geometry.AnimationCurve | [cocos/core/geometry/curve.ts:104](../cocos/core/geometry/curve.ts#L104) | 缺少 |
| line（废弃） | geometry.line | [cocos/core/geometry/deprecated-3.0.0.ts:186](../cocos/core/geometry/deprecated-3.0.0.ts#L186) | 缺少 |
| plane（废弃） | geometry.plane | [cocos/core/geometry/deprecated-3.0.0.ts:202](../cocos/core/geometry/deprecated-3.0.0.ts#L202) | 缺少 |
| ray（废弃） | geometry.ray | [cocos/core/geometry/deprecated-3.0.0.ts:216](../cocos/core/geometry/deprecated-3.0.0.ts#L216) | 缺少 |
| triangle（废弃） | geometry.triangle | [cocos/core/geometry/deprecated-3.0.0.ts:231](../cocos/core/geometry/deprecated-3.0.0.ts#L231) | 缺少 |
| sphere（废弃） | geometry.sphere | [cocos/core/geometry/deprecated-3.0.0.ts:246](../cocos/core/geometry/deprecated-3.0.0.ts#L246) | 缺少 |
| aabb（废弃） | geometry.aabb | [cocos/core/geometry/deprecated-3.0.0.ts:261](../cocos/core/geometry/deprecated-3.0.0.ts#L261) | 缺少 |
| obb（废弃） | geometry.obb | [cocos/core/geometry/deprecated-3.0.0.ts:276](../cocos/core/geometry/deprecated-3.0.0.ts#L276) | 缺少 |
| capsule（废弃） | geometry.capsule | [cocos/core/geometry/deprecated-3.0.0.ts:291](../cocos/core/geometry/deprecated-3.0.0.ts#L291) | 缺少 |
| frustum（废弃） | geometry.frustum | [cocos/core/geometry/deprecated-3.0.0.ts:306](../cocos/core/geometry/deprecated-3.0.0.ts#L306) | 缺少 |
| Frustum | geometry.Frustum | [cocos/core/geometry/frustum.ts:53](../cocos/core/geometry/frustum.ts#L53) | 缺少 |
| Line | geometry.Line | [cocos/core/geometry/line.ts:34](../cocos/core/geometry/line.ts#L34) | 缺少 |
| OBB | geometry.OBB | [cocos/core/geometry/obb.ts:49](../cocos/core/geometry/obb.ts#L49) | 缺少 |
| Plane | geometry.Plane | [cocos/core/geometry/plane.ts:42](../cocos/core/geometry/plane.ts#L42) | 缺少 |
| Ray | geometry.Ray | [cocos/core/geometry/ray.ts:36](../cocos/core/geometry/ray.ts#L36) | 缺少 |
| Sphere | geometry.Sphere | [cocos/core/geometry/sphere.ts:42](../cocos/core/geometry/sphere.ts#L42) | 缺少 |
| Spline | geometry.Spline | [cocos/core/geometry/spline.ts:94](../cocos/core/geometry/spline.ts#L94) | 缺少 |
| Triangle | geometry.Triangle | [cocos/core/geometry/triangle.ts:35](../cocos/core/geometry/triangle.ts#L35) | 缺少 |
| AffineTransform | AffineTransform, legacyCC.AffineTransform | [cocos/core/math/affine-transform.ts:38](../cocos/core/math/affine-transform.ts#L38) | 缺少 |
| Color | Color, math.Color, legacyCC.Color | [cocos/core/math/color.ts:55](../cocos/core/math/color.ts#L55) | 缺少 |
| Mat3 | Mat3, math.Mat3, legacyCC.Mat3 | [cocos/core/math/mat3.ts:44](../cocos/core/math/mat3.ts#L44) | 缺少 |
| Mat4 | Mat4, math.Mat4, legacyCC.Mat4 | [cocos/core/math/mat4.ts:62](../cocos/core/math/mat4.ts#L62) | 缺少 |
| MathBase | math.MathBase, MathBase | [cocos/core/math/math-base.ts:31](../cocos/core/math/math-base.ts#L31) | 缺少 |
| Quat | math.Quat, Quat, legacyCC.Quat | [cocos/core/math/quat.ts:53](../cocos/core/math/quat.ts#L53) | 缺少 |
| Rect | math.Rect, Rect, legacyCC.Rect | [cocos/core/math/rect.ts:48](../cocos/core/math/rect.ts#L48) | 缺少 |
| Size | math.Size, Size, legacyCC.Size | [cocos/core/math/size.ts:35](../cocos/core/math/size.ts#L35) | 缺少 |
| Vec2 | math.Vec2, Vec2, legacyCC.Vec2 | [cocos/core/math/vec2.ts:58](../cocos/core/math/vec2.ts#L58) | 缺少 |
| Vec3 | math.Vec3, Vec3, legacyCC.Vec3 | [cocos/core/math/vec3.ts:56](../cocos/core/math/vec3.ts#L56) | 缺少 |
| Vec4 | math.Vec4, Vec4, legacyCC.Vec4 | [cocos/core/math/vec4.ts:54](../cocos/core/math/vec4.ts#L54) | 缺少 |
| CachedArray | CachedArray, memop.CachedArray | [cocos/core/memop/cached-array.ts:35](../cocos/core/memop/cached-array.ts#L35) | 缺少 |
| Pool | memop.Pool, Pool | [cocos/core/memop/pool.ts:35](../cocos/core/memop/pool.ts#L35) | 缺少 |
| RecyclePool | memop.RecyclePool, RecyclePool | [cocos/core/memop/recycle-pool.ts:38](../cocos/core/memop/recycle-pool.ts#L38) | 缺少 |
| Scheduler | Scheduler, legacyCC.Scheduler | [cocos/core/scheduler.ts:354](../cocos/core/scheduler.ts#L354) | 缺少 |
| Settings | Settings | [cocos/core/settings.ts:61](../cocos/core/settings.ts#L61) | 缺少 |
| System | System | [cocos/core/system.ts:39](../cocos/core/system.ts#L39) | 缺少 |
| MutableForwardIterator | js.array.MutableForwardIterator | [cocos/core/utils/array.ts:39](../cocos/core/utils/array.ts#L39) | 缺少 |
| IDGenerator | js.IDGenerator | [cocos/core/utils/id-generator.ts:36](../cocos/core/utils/id-generator.ts#L36) | 缺少 |
| Pool | js.Pool | [cocos/core/utils/pool.ts:79](../cocos/core/utils/pool.ts#L79) | 缺少 |
| ValueType | ValueType, legacyCC.ValueType | [cocos/core/value-types/value-type.ts:34](../cocos/core/value-types/value-type.ts#L34) | 缺少 |

### cocos/dragon-bones（12）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| ArmatureCache | dragonBones.ArmatureCache | [cocos/dragon-bones/ArmatureCache.ts:487](../cocos/dragon-bones/ArmatureCache.ts#L487) | 缺少 |
| DragonBoneSocket | dragonBones.DragonBoneSocket | [cocos/dragon-bones/ArmatureDisplay.ts:129](../cocos/dragon-bones/ArmatureDisplay.ts#L129) | 缺少 |
| ArmatureDisplay | dragonBones.ArmatureDisplay, legacyCC.internal.ArmatureDisplay | [cocos/dragon-bones/ArmatureDisplay.ts:182](../cocos/dragon-bones/ArmatureDisplay.ts#L182) | 缺少 |
| ArmatureSystem | legacyCC.internal.ArmatureSystem | [cocos/dragon-bones/ArmatureSystem.ts:32](../cocos/dragon-bones/ArmatureSystem.ts#L32) | 缺少 |
| AttachUtil | dragonBones.AttachUtil | [cocos/dragon-bones/AttachUtil.ts:44](../cocos/dragon-bones/AttachUtil.ts#L44) | 缺少 |
| CCArmatureDisplay | dragonBones.CCArmatureDisplay | [cocos/dragon-bones/CCArmatureDisplay.ts:39](../cocos/dragon-bones/CCArmatureDisplay.ts#L39) | 缺少 |
| CCFactory | dragonBones.CCFactory | [cocos/dragon-bones/CCFactory.ts:49](../cocos/dragon-bones/CCFactory.ts#L49) | 缺少 |
| CCSlot | dragonBones.CCSlot | [cocos/dragon-bones/CCSlot.ts:37](../cocos/dragon-bones/CCSlot.ts#L37) | 缺少 |
| CCTextureAtlasData | dragonBones.CCTextureAtlasData | [cocos/dragon-bones/CCTextureData.ts:36](../cocos/dragon-bones/CCTextureData.ts#L36) | 缺少 |
| CCTextureData | dragonBones.CCTextureData | [cocos/dragon-bones/CCTextureData.ts:104](../cocos/dragon-bones/CCTextureData.ts#L104) | 缺少 |
| DragonBonesAsset | dragonBones.DragonBonesAsset, legacyCC.internal.DragonBonesAsset | [cocos/dragon-bones/DragonBonesAsset.ts:40](../cocos/dragon-bones/DragonBonesAsset.ts#L40) | 缺少 |
| DragonBonesAtlasAsset | dragonBones.DragonBonesAtlasAsset, legacyCC.internal.DragonBonesAtlasAsset | [cocos/dragon-bones/DragonBonesAtlasAsset.ts:42](../cocos/dragon-bones/DragonBonesAtlasAsset.ts#L42) | 缺少 |

### cocos/game（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Director | Director, legacyCC.Director | [cocos/game/director.ts:178](../cocos/game/director.ts#L178) | 缺少 |
| Game | Game, legacyCC.Game | [cocos/game/game.ts:190](../cocos/game/game.ts#L190) | 缺少 |
| SplashScreen | legacyCC.internal.SplashScreen | [cocos/game/splash-screen.ts:73](../cocos/game/splash-screen.ts#L73) | 缺少 |

### cocos/gfx（87）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Buffer（抽象） | gfx.Buffer | [cocos/gfx/base/buffer.ts:43](../cocos/gfx/base/buffer.ts#L43) | 缺少 |
| CommandBuffer（抽象） | gfx.CommandBuffer | [cocos/gfx/base/command-buffer.ts:50](../cocos/gfx/base/command-buffer.ts#L50) | 缺少 |
| Size | gfx.Size | [cocos/gfx/base/define.ts:730](../cocos/gfx/base/define.ts#L730) | 缺少 |
| DeviceCaps | gfx.DeviceCaps | [cocos/gfx/base/define.ts:747](../cocos/gfx/base/define.ts#L747) | 缺少 |
| DeviceOptions | gfx.DeviceOptions | [cocos/gfx/base/define.ts:810](../cocos/gfx/base/define.ts#L810) | 缺少 |
| Offset | gfx.Offset | [cocos/gfx/base/define.ts:823](../cocos/gfx/base/define.ts#L823) | 缺少 |
| Rect | gfx.Rect | [cocos/gfx/base/define.ts:840](../cocos/gfx/base/define.ts#L840) | 缺少 |
| Extent | gfx.Extent | [cocos/gfx/base/define.ts:859](../cocos/gfx/base/define.ts#L859) | 缺少 |
| TextureSubresLayers | gfx.TextureSubresLayers | [cocos/gfx/base/define.ts:876](../cocos/gfx/base/define.ts#L876) | 缺少 |
| TextureSubresRange | gfx.TextureSubresRange | [cocos/gfx/base/define.ts:893](../cocos/gfx/base/define.ts#L893) | 缺少 |
| TextureCopy | gfx.TextureCopy | [cocos/gfx/base/define.ts:912](../cocos/gfx/base/define.ts#L912) | 缺少 |
| TextureBlit | gfx.TextureBlit | [cocos/gfx/base/define.ts:933](../cocos/gfx/base/define.ts#L933) | 缺少 |
| BufferTextureCopy | gfx.BufferTextureCopy | [cocos/gfx/base/define.ts:956](../cocos/gfx/base/define.ts#L956) | 缺少 |
| Viewport | gfx.Viewport | [cocos/gfx/base/define.ts:979](../cocos/gfx/base/define.ts#L979) | 缺少 |
| Color | gfx.Color | [cocos/gfx/base/define.ts:1011](../cocos/gfx/base/define.ts#L1011) | 缺少 |
| MarkerInfo | gfx.MarkerInfo | [cocos/gfx/base/define.ts:1045](../cocos/gfx/base/define.ts#L1045) | 缺少 |
| BindingMappingInfo | gfx.BindingMappingInfo | [cocos/gfx/base/define.ts:1060](../cocos/gfx/base/define.ts#L1060) | 缺少 |
| SwapchainInfo | gfx.SwapchainInfo | [cocos/gfx/base/define.ts:1087](../cocos/gfx/base/define.ts#L1087) | 缺少 |
| DeviceInfo | gfx.DeviceInfo | [cocos/gfx/base/define.ts:1108](../cocos/gfx/base/define.ts#L1108) | 缺少 |
| BufferInfo | gfx.BufferInfo | [cocos/gfx/base/define.ts:1121](../cocos/gfx/base/define.ts#L1121) | 缺少 |
| BufferViewInfo | gfx.BufferViewInfo | [cocos/gfx/base/define.ts:1142](../cocos/gfx/base/define.ts#L1142) | 缺少 |
| DrawInfo | gfx.DrawInfo | [cocos/gfx/base/define.ts:1159](../cocos/gfx/base/define.ts#L1159) | 缺少 |
| DispatchInfo | gfx.DispatchInfo | [cocos/gfx/base/define.ts:1184](../cocos/gfx/base/define.ts#L1184) | 缺少 |
| IndirectBuffer | gfx.IndirectBuffer | [cocos/gfx/base/define.ts:1205](../cocos/gfx/base/define.ts#L1205) | 缺少 |
| TextureInfo | gfx.TextureInfo | [cocos/gfx/base/define.ts:1218](../cocos/gfx/base/define.ts#L1218) | 缺少 |
| TextureViewInfo | gfx.TextureViewInfo | [cocos/gfx/base/define.ts:1251](../cocos/gfx/base/define.ts#L1251) | 缺少 |
| SamplerInfo | gfx.SamplerInfo | [cocos/gfx/base/define.ts:1280](../cocos/gfx/base/define.ts#L1280) | 缺少 |
| Uniform | gfx.Uniform | [cocos/gfx/base/define.ts:1307](../cocos/gfx/base/define.ts#L1307) | 缺少 |
| UniformBlock | gfx.UniformBlock | [cocos/gfx/base/define.ts:1324](../cocos/gfx/base/define.ts#L1324) | 缺少 |
| UniformSamplerTexture | gfx.UniformSamplerTexture | [cocos/gfx/base/define.ts:1347](../cocos/gfx/base/define.ts#L1347) | 缺少 |
| UniformSampler | gfx.UniformSampler | [cocos/gfx/base/define.ts:1370](../cocos/gfx/base/define.ts#L1370) | 缺少 |
| UniformTexture | gfx.UniformTexture | [cocos/gfx/base/define.ts:1391](../cocos/gfx/base/define.ts#L1391) | 缺少 |
| UniformStorageImage | gfx.UniformStorageImage | [cocos/gfx/base/define.ts:1414](../cocos/gfx/base/define.ts#L1414) | 缺少 |
| UniformStorageBuffer | gfx.UniformStorageBuffer | [cocos/gfx/base/define.ts:1439](../cocos/gfx/base/define.ts#L1439) | 缺少 |
| UniformInputAttachment | gfx.UniformInputAttachment | [cocos/gfx/base/define.ts:1462](../cocos/gfx/base/define.ts#L1462) | 缺少 |
| ShaderStage | gfx.ShaderStage | [cocos/gfx/base/define.ts:1483](../cocos/gfx/base/define.ts#L1483) | 缺少 |
| Attribute | gfx.Attribute | [cocos/gfx/base/define.ts:1498](../cocos/gfx/base/define.ts#L1498) | 缺少 |
| ShaderInfo | gfx.ShaderInfo | [cocos/gfx/base/define.ts:1521](../cocos/gfx/base/define.ts#L1521) | 缺少 |
| InputAssemblerInfo | gfx.InputAssemblerInfo | [cocos/gfx/base/define.ts:1554](../cocos/gfx/base/define.ts#L1554) | 缺少 |
| ColorAttachment | gfx.ColorAttachment | [cocos/gfx/base/define.ts:1573](../cocos/gfx/base/define.ts#L1573) | 缺少 |
| DepthStencilAttachment | gfx.DepthStencilAttachment | [cocos/gfx/base/define.ts:1594](../cocos/gfx/base/define.ts#L1594) | 缺少 |
| SubpassInfo | gfx.SubpassInfo | [cocos/gfx/base/define.ts:1619](../cocos/gfx/base/define.ts#L1619) | 缺少 |
| SubpassDependency | gfx.SubpassDependency | [cocos/gfx/base/define.ts:1648](../cocos/gfx/base/define.ts#L1648) | 缺少 |
| RenderPassInfo | gfx.RenderPassInfo | [cocos/gfx/base/define.ts:1669](../cocos/gfx/base/define.ts#L1669) | 缺少 |
| ResourceRange | gfx.ResourceRange | [cocos/gfx/base/define.ts:1690](../cocos/gfx/base/define.ts#L1690) | 缺少 |
| GeneralBarrierInfo | gfx.GeneralBarrierInfo | [cocos/gfx/base/define.ts:1719](../cocos/gfx/base/define.ts#L1719) | 缺少 |
| TextureBarrierInfo | gfx.TextureBarrierInfo | [cocos/gfx/base/define.ts:1736](../cocos/gfx/base/define.ts#L1736) | 缺少 |
| BufferBarrierInfo | gfx.BufferBarrierInfo | [cocos/gfx/base/define.ts:1761](../cocos/gfx/base/define.ts#L1761) | 缺少 |
| FramebufferInfo | gfx.FramebufferInfo | [cocos/gfx/base/define.ts:1788](../cocos/gfx/base/define.ts#L1788) | 缺少 |
| DescriptorSetLayoutBinding | gfx.DescriptorSetLayoutBinding | [cocos/gfx/base/define.ts:1807](../cocos/gfx/base/define.ts#L1807) | 缺少 |
| DescriptorSetLayoutInfo | gfx.DescriptorSetLayoutInfo | [cocos/gfx/base/define.ts:1836](../cocos/gfx/base/define.ts#L1836) | 缺少 |
| DescriptorSetInfo | gfx.DescriptorSetInfo | [cocos/gfx/base/define.ts:1849](../cocos/gfx/base/define.ts#L1849) | 缺少 |
| PipelineLayoutInfo | gfx.PipelineLayoutInfo | [cocos/gfx/base/define.ts:1862](../cocos/gfx/base/define.ts#L1862) | 缺少 |
| InputState | gfx.InputState | [cocos/gfx/base/define.ts:1875](../cocos/gfx/base/define.ts#L1875) | 缺少 |
| CommandBufferInfo | gfx.CommandBufferInfo | [cocos/gfx/base/define.ts:1888](../cocos/gfx/base/define.ts#L1888) | 缺少 |
| QueueInfo | gfx.QueueInfo | [cocos/gfx/base/define.ts:1903](../cocos/gfx/base/define.ts#L1903) | 缺少 |
| QueryPoolInfo | gfx.QueryPoolInfo | [cocos/gfx/base/define.ts:1916](../cocos/gfx/base/define.ts#L1916) | 缺少 |
| FormatInfo | gfx.FormatInfo | [cocos/gfx/base/define.ts:1933](../cocos/gfx/base/define.ts#L1933) | 缺少 |
| MemoryStatus | gfx.MemoryStatus | [cocos/gfx/base/define.ts:1960](../cocos/gfx/base/define.ts#L1960) | 缺少 |
| DynamicStencilStates | gfx.DynamicStencilStates | [cocos/gfx/base/define.ts:1975](../cocos/gfx/base/define.ts#L1975) | 缺少 |
| DynamicStates | gfx.DynamicStates | [cocos/gfx/base/define.ts:1992](../cocos/gfx/base/define.ts#L1992) | 缺少 |
| GFXObject | gfx.GFXObject | [cocos/gfx/base/define.ts:2037](../cocos/gfx/base/define.ts#L2037) | 缺少 |
| DescriptorSetLayout（抽象） | gfx.DescriptorSetLayout | [cocos/gfx/base/descriptor-set-layout.ts:31](../cocos/gfx/base/descriptor-set-layout.ts#L31) | 缺少 |
| DescriptorSet（抽象） | gfx.DescriptorSet | [cocos/gfx/base/descriptor-set.ts:35](../cocos/gfx/base/descriptor-set.ts#L35) | 缺少 |
| Device（抽象） | gfx.Device | [cocos/gfx/base/device.ts:55](../cocos/gfx/base/device.ts#L55) | 缺少 |
| DefaultResource | gfx.DefaultResource | [cocos/gfx/base/device.ts:418](../cocos/gfx/base/device.ts#L418) | 缺少 |
| Framebuffer（抽象） | gfx.Framebuffer | [cocos/gfx/base/framebuffer.ts:33](../cocos/gfx/base/framebuffer.ts#L33) | 缺少 |
| InputAssembler（抽象） | gfx.InputAssembler | [cocos/gfx/base/input-assembler.ts:33](../cocos/gfx/base/input-assembler.ts#L33) | 缺少 |
| PipelineLayout（抽象） | gfx.PipelineLayout | [cocos/gfx/base/pipeline-layout.ts:32](../cocos/gfx/base/pipeline-layout.ts#L32) | 缺少 |
| PipelineStateInfo | gfx.PipelineStateInfo | [cocos/gfx/base/pipeline-state.ts:41](../cocos/gfx/base/pipeline-state.ts#L41) | [已有文件](../cocos/gfx/base/pipeline-state.jsb.ts) |
| PipelineState（抽象） | gfx.PipelineState | [cocos/gfx/base/pipeline-state.ts:62](../cocos/gfx/base/pipeline-state.ts#L62) | [已有文件](../cocos/gfx/base/pipeline-state.jsb.ts) |
| RasterizerState | gfx.RasterizerState | [cocos/gfx/base/pipeline-sub-state.ts:42](../cocos/gfx/base/pipeline-sub-state.ts#L42) | [已有文件](../cocos/gfx/base/pipeline-sub-state.jsb.ts) |
| DepthStencilState | gfx.DepthStencilState | [cocos/gfx/base/pipeline-sub-state.ts:90](../cocos/gfx/base/pipeline-sub-state.ts#L90) | [已有文件](../cocos/gfx/base/pipeline-sub-state.jsb.ts) |
| BlendTarget | gfx.BlendTarget | [cocos/gfx/base/pipeline-sub-state.ts:151](../cocos/gfx/base/pipeline-sub-state.ts#L151) | [已有文件](../cocos/gfx/base/pipeline-sub-state.jsb.ts) |
| BlendState | gfx.BlendState | [cocos/gfx/base/pipeline-sub-state.ts:187](../cocos/gfx/base/pipeline-sub-state.ts#L187) | [已有文件](../cocos/gfx/base/pipeline-sub-state.jsb.ts) |
| Queue（抽象） | gfx.Queue | [cocos/gfx/base/queue.ts:32](../cocos/gfx/base/queue.ts#L32) | 缺少 |
| RenderPass（抽象） | gfx.RenderPass | [cocos/gfx/base/render-pass.ts:39](../cocos/gfx/base/render-pass.ts#L39) | 缺少 |
| Shader（抽象） | gfx.Shader | [cocos/gfx/base/shader.ts:31](../cocos/gfx/base/shader.ts#L31) | 缺少 |
| GeneralBarrier | gfx.GeneralBarrier | [cocos/gfx/base/states/general-barrier.ts:32](../cocos/gfx/base/states/general-barrier.ts#L32) | 缺少 |
| Sampler | gfx.Sampler | [cocos/gfx/base/states/sampler.ts:31](../cocos/gfx/base/states/sampler.ts#L31) | 缺少 |
| TextureBarrier | gfx.TextureBarrier | [cocos/gfx/base/states/texture-barrier.ts:32](../cocos/gfx/base/states/texture-barrier.ts#L32) | 缺少 |
| Swapchain（抽象） | gfx.Swapchain | [cocos/gfx/base/swapchain.ts:32](../cocos/gfx/base/swapchain.ts#L32) | 缺少 |
| Texture（抽象） | gfx.Texture | [cocos/gfx/base/texture.ts:43](../cocos/gfx/base/texture.ts#L43) | 缺少 |
| EmptyDevice | EmptyDevice, legacyCC.EmptyDevice | [cocos/gfx/empty/empty-device.ts:64](../cocos/gfx/empty/empty-device.ts#L64) | 缺少 |
| WebGLDevice | WebGLDevice | [cocos/gfx/webgl/webgl-device.ts:90](../cocos/gfx/webgl/webgl-device.ts#L90) | 缺少 |
| WebGL2Device | WebGL2Device | [cocos/gfx/webgl2/webgl2-device.ts:87](../cocos/gfx/webgl2/webgl2-device.ts#L87) | 缺少 |
| WebGPUDevice | WebGPUDevice | [cocos/gfx/webgpu/webgpu-device.ts:98](../cocos/gfx/webgpu/webgpu-device.ts#L98) | 缺少 |

### cocos/gi（10）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| AutoPlacement | AutoPlacement | [cocos/gi/light-probe/auto-placement.ts:41](../cocos/gi/light-probe/auto-placement.ts#L41) | 缺少 |
| Vertex | Vertex | [cocos/gi/light-probe/delaunay.ts:38](../cocos/gi/light-probe/delaunay.ts#L38) | [已有文件](../cocos/gi/light-probe/delaunay.jsb.ts) |
| CircumSphere | CircumSphere | [cocos/gi/light-probe/delaunay.ts:189](../cocos/gi/light-probe/delaunay.ts#L189) | [已有文件](../cocos/gi/light-probe/delaunay.jsb.ts) |
| Tetrahedron | Tetrahedron | [cocos/gi/light-probe/delaunay.ts:221](../cocos/gi/light-probe/delaunay.ts#L221) | [已有文件](../cocos/gi/light-probe/delaunay.jsb.ts) |
| Delaunay | Delaunay | [cocos/gi/light-probe/delaunay.ts:279](../cocos/gi/light-probe/delaunay.ts#L279) | [已有文件](../cocos/gi/light-probe/delaunay.jsb.ts) |
| LightProbeGroup | LightProbeGroup | [cocos/gi/light-probe/light-probe-group.ts:49](../cocos/gi/light-probe/light-probe-group.ts#L49) | 缺少 |
| LightProbesData | LightProbesData, legacyCC.internal.LightProbesData | [cocos/gi/light-probe/light-probe.ts:49](../cocos/gi/light-probe/light-probe.ts#L49) | [已有文件](../cocos/gi/light-probe/light-probe.jsb.ts) |
| LightProbes | LightProbes, legacyCC.internal.LightProbes | [cocos/gi/light-probe/light-probe.ts:258](../cocos/gi/light-probe/light-probe.ts#L258) | [已有文件](../cocos/gi/light-probe/light-probe.jsb.ts) |
| LightProbeSampler | LightProbeSampler | [cocos/gi/light-probe/sh.ts:29](../cocos/gi/light-probe/sh.ts#L29) | 缺少 |
| SH | SH, legacyCC.internal.SH | [cocos/gi/light-probe/sh.ts:79](../cocos/gi/light-probe/sh.ts#L79) | 缺少 |

### cocos/input（13）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Input | Input | [cocos/input/input.ts:130](../cocos/input/input.ts#L130) | 缺少 |
| SystemEvent（废弃） | SystemEvent, legacyCC.SystemEvent | [cocos/input/system-event.ts:71](../cocos/input/system-event.ts#L71) | 缺少 |
| Acceleration | Acceleration | [cocos/input/types/acceleration.ts:29](../cocos/input/types/acceleration.ts#L29) | 缺少 |
| EventAcceleration | EventAcceleration | [cocos/input/types/event/event-acceleration.ts:36](../cocos/input/types/event/event-acceleration.ts#L36) | 缺少 |
| EventGamepad | EventGamepad | [cocos/input/types/event/event-gamepad.ts:40](../cocos/input/types/event/event-gamepad.ts#L40) | 缺少 |
| EventHandheld | EventHandheld | [cocos/input/types/event/event-handheld.ts:36](../cocos/input/types/event/event-handheld.ts#L36) | 缺少 |
| EventHandle | EventHandle | [cocos/input/types/event/event-handle.ts:36](../cocos/input/types/event/event-handle.ts#L36) | 缺少 |
| EventHMD | EventHMD | [cocos/input/types/event/event-hmd.ts:36](../cocos/input/types/event/event-hmd.ts#L36) | 缺少 |
| EventKeyboard | EventKeyboard | [cocos/input/types/event/event-keyboard.ts:36](../cocos/input/types/event/event-keyboard.ts#L36) | 缺少 |
| EventMouse | EventMouse | [cocos/input/types/event/event-mouse.ts:35](../cocos/input/types/event/event-mouse.ts#L35) | 缺少 |
| EventTouch | EventTouch | [cocos/input/types/event/event-touch.ts:40](../cocos/input/types/event/event-touch.ts#L40) | 缺少 |
| Event | Event, legacyCC.Event | [cocos/input/types/event/event.ts:36](../cocos/input/types/event/event.ts#L36) | 缺少 |
| Touch | Touch, legacyCC.Touch | [cocos/input/types/touch.ts:34](../cocos/input/types/touch.ts#L34) | 缺少 |

### cocos/misc（7）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Camera | Camera, CameraComponent, legacyCC.Camera, legacyCC.CameraComponent | [cocos/misc/camera-component.ts:102](../cocos/misc/camera-component.ts#L102) | 缺少 |
| FeedStatusController | FeedStatusController | [cocos/misc/FeedStatusController.ts:42](../cocos/misc/FeedStatusController.ts#L42) | 缺少 |
| MissingScript | MissingScript, legacyCC._MissingScript | [cocos/misc/missing-script.ts:36](../cocos/misc/missing-script.ts#L36) | 缺少 |
| ModelRenderer | ModelRenderer, RenderableComponent, legacyCC.RenderableComponent | [cocos/misc/model-renderer.ts:54](../cocos/misc/model-renderer.ts#L54) | 缺少 |
| PrefabLink | PrefabLink | [cocos/misc/prefab-link.ts:42](../cocos/misc/prefab-link.ts#L42) | 缺少 |
| Renderer | Renderer | [cocos/misc/renderer.ts:55](../cocos/misc/renderer.ts#L55) | 缺少 |
| WorkerPool | WorkerPool | [cocos/misc/worker-pool.ts:202](../cocos/misc/worker-pool.ts#L202) | 缺少 |

### cocos/native-binding（5）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| EventAssetsManager | native.EventAssetsManager | [cocos/native-binding/index.ts:63](../cocos/native-binding/index.ts#L63) | 缺少 |
| Manifest | native.Manifest | [cocos/native-binding/index.ts:103](../cocos/native-binding/index.ts#L103) | 缺少 |
| AssetsManager | native.AssetsManager | [cocos/native-binding/index.ts:184](../cocos/native-binding/index.ts#L184) | 缺少 |
| Downloader | native.Downloader | [cocos/native-binding/index.ts:412](../cocos/native-binding/index.ts#L412) | 缺少 |
| DebugRenderer | native.DebugRenderer | [cocos/native-binding/index.ts:1241](../cocos/native-binding/index.ts#L1241) | 缺少 |

### cocos/particle-2d（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| MotionStreak | MotionStreak | [cocos/particle-2d/motion-streak-2d.ts:68](../cocos/particle-2d/motion-streak-2d.ts#L68) | 缺少 |
| ParticleAsset | ParticleAsset, legacyCC.ParticleAsset | [cocos/particle-2d/particle-asset.ts:38](../cocos/particle-2d/particle-asset.ts#L38) | 缺少 |
| ParticleSystem2D | ParticleSystem2D | [cocos/particle-2d/particle-system-2d.ts:172](../cocos/particle-2d/particle-system-2d.ts#L172) | 缺少 |

### cocos/particle（7）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| CurveRange | CurveRange | [cocos/particle/animator/curve-range.ts:73](../cocos/particle/animator/curve-range.ts#L73) | 缺少 |
| GradientRange | GradientRange | [cocos/particle/animator/gradient-range.ts:75](../cocos/particle/animator/gradient-range.ts#L75) | 缺少 |
| Billboard | Billboard, BillboardComponent, legacyCC.BillboardComponent | [cocos/particle/billboard.ts:36](../cocos/particle/billboard.ts#L36) | 缺少 |
| Burst | Burst | [cocos/particle/burst.ts:36](../cocos/particle/burst.ts#L36) | 缺少 |
| Line | Line, LineComponent, legacyCC.LineComponent | [cocos/particle/line.ts:39](../cocos/particle/line.ts#L39) | 缺少 |
| ParticleSystem | ParticleSystem, ParticleSystemComponent, legacyCC.ParticleSystemComponent | [cocos/particle/particle-system.ts:74](../cocos/particle/particle-system.ts#L74) | 缺少 |
| ParticleUtils | ParticleUtils, legacyCC.ParticleUtils | [cocos/particle/particle-utils.ts:35](../cocos/particle/particle-utils.ts#L35) | 缺少 |

### cocos/physics-2d（16）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Intersection2D | Intersection2D | [cocos/physics-2d/builtin/intersection-2d.ts:301](../cocos/physics-2d/builtin/intersection-2d.ts#L301) | 缺少 |
| BoxCollider2D | BoxCollider2D | [cocos/physics-2d/framework/components/colliders/box-collider-2d.ts:33](../cocos/physics-2d/framework/components/colliders/box-collider-2d.ts#L33) | 缺少 |
| CircleCollider2D | CircleCollider2D | [cocos/physics-2d/framework/components/colliders/circle-collider-2d.ts:33](../cocos/physics-2d/framework/components/colliders/circle-collider-2d.ts#L33) | 缺少 |
| Collider2D | Collider2D | [cocos/physics-2d/framework/components/colliders/collider-2d.ts:38](../cocos/physics-2d/framework/components/colliders/collider-2d.ts#L38) | 缺少 |
| PolygonCollider2D | PolygonCollider2D | [cocos/physics-2d/framework/components/colliders/polygon-collider-2d.ts:33](../cocos/physics-2d/framework/components/colliders/polygon-collider-2d.ts#L33) | 缺少 |
| DistanceJoint2D | DistanceJoint2D | [cocos/physics-2d/framework/components/joints/distance-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/distance-joint-2d.ts#L33) | 缺少 |
| FixedJoint2D | FixedJoint2D | [cocos/physics-2d/framework/components/joints/fixed-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/fixed-joint-2d.ts#L33) | 缺少 |
| HingeJoint2D | HingeJoint2D | [cocos/physics-2d/framework/components/joints/hinge-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/hinge-joint-2d.ts#L33) | 缺少 |
| Joint2D | Joint2D | [cocos/physics-2d/framework/components/joints/joint-2d.ts:35](../cocos/physics-2d/framework/components/joints/joint-2d.ts#L35) | 缺少 |
| MouseJoint2D | MouseJoint2D | [cocos/physics-2d/framework/components/joints/mouse-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/mouse-joint-2d.ts#L33) | 缺少 |
| RelativeJoint2D | RelativeJoint2D | [cocos/physics-2d/framework/components/joints/relative-joint-2d.ts:36](../cocos/physics-2d/framework/components/joints/relative-joint-2d.ts#L36) | 缺少 |
| SliderJoint2D | SliderJoint2D | [cocos/physics-2d/framework/components/joints/slider-joint-2d.ts:34](../cocos/physics-2d/framework/components/joints/slider-joint-2d.ts#L34) | 缺少 |
| SpringJoint2D | SpringJoint2D | [cocos/physics-2d/framework/components/joints/spring-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/spring-joint-2d.ts#L33) | 缺少 |
| WheelJoint2D | WheelJoint2D | [cocos/physics-2d/framework/components/joints/wheel-joint-2d.ts:33](../cocos/physics-2d/framework/components/joints/wheel-joint-2d.ts#L33) | 缺少 |
| RigidBody2D | RigidBody2D | [cocos/physics-2d/framework/components/rigid-body-2d.ts:36](../cocos/physics-2d/framework/components/rigid-body-2d.ts#L36) | 缺少 |
| PhysicsSystem2D | PhysicsSystem2D | [cocos/physics-2d/framework/physics-system.ts:40](../cocos/physics-2d/framework/physics-system.ts#L40) | 缺少 |

### cocos/physics（25）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| PhysicsMaterial | PhysicMaterial, physics.PhysicsMaterial, PhysicsMaterial, legacyCC.PhysicMaterial, legacyCC.PhysicsMaterial | [cocos/physics/framework/assets/physics-material.ts:37](../cocos/physics/framework/assets/physics-material.ts#L37) | 缺少 |
| BoxCharacterController | BoxCharacterController, physics.BoxCharacterController | [cocos/physics/framework/components/character-controllers/box-character-controller.ts:41](../cocos/physics/framework/components/character-controllers/box-character-controller.ts#L41) | 缺少 |
| CapsuleCharacterController | CapsuleCharacterController, physics.CapsuleCharacterController | [cocos/physics/framework/components/character-controllers/capsule-character-controller.ts:41](../cocos/physics/framework/components/character-controllers/capsule-character-controller.ts#L41) | 缺少 |
| CharacterController | CharacterController, physics.CharacterController | [cocos/physics/framework/components/character-controllers/character-controller.ts:45](../cocos/physics/framework/components/character-controllers/character-controller.ts#L45) | 缺少 |
| BoxCollider | BoxCollider, BoxColliderComponent, physics.BoxCollider, legacyCC.BoxColliderComponent | [cocos/physics/framework/components/colliders/box-collider.ts:46](../cocos/physics/framework/components/colliders/box-collider.ts#L46) | 缺少 |
| CapsuleCollider | CapsuleCollider, CapsuleColliderComponent, physics.CapsuleCollider | [cocos/physics/framework/components/colliders/capsule-collider.ts:45](../cocos/physics/framework/components/colliders/capsule-collider.ts#L45) | 缺少 |
| Collider | Collider, ColliderComponent, physics.Collider, legacyCC.ColliderComponent | [cocos/physics/framework/components/colliders/collider.ts:45](../cocos/physics/framework/components/colliders/collider.ts#L45) | 缺少 |
| ConeCollider | ConeCollider, physics.ConeCollider | [cocos/physics/framework/components/colliders/cone-collider.ts:44](../cocos/physics/framework/components/colliders/cone-collider.ts#L44) | 缺少 |
| CylinderCollider | CylinderCollider, CylinderColliderComponent, physics.CylinderCollider | [cocos/physics/framework/components/colliders/cylinder-collider.ts:44](../cocos/physics/framework/components/colliders/cylinder-collider.ts#L44) | 缺少 |
| MeshCollider | MeshCollider, MeshColliderComponent, physics.MeshCollider | [cocos/physics/framework/components/colliders/mesh-collider.ts:48](../cocos/physics/framework/components/colliders/mesh-collider.ts#L48) | 缺少 |
| PlaneCollider | physics.PlaneCollider, PlaneCollider | [cocos/physics/framework/components/colliders/plane-collider.ts:47](../cocos/physics/framework/components/colliders/plane-collider.ts#L47) | 缺少 |
| SimplexCollider | physics.SimplexCollider, SimplexCollider | [cocos/physics/framework/components/colliders/simplex-collider.ts:49](../cocos/physics/framework/components/colliders/simplex-collider.ts#L49) | 缺少 |
| SphereCollider | physics.SphereCollider, SphereCollider, SphereColliderComponent, legacyCC.SphereColliderComponent | [cocos/physics/framework/components/colliders/sphere-collider.ts:43](../cocos/physics/framework/components/colliders/sphere-collider.ts#L43) | 缺少 |
| TerrainCollider | physics.TerrainCollider, TerrainCollider | [cocos/physics/framework/components/colliders/terrain-collider.ts:48](../cocos/physics/framework/components/colliders/terrain-collider.ts#L48) | 缺少 |
| ConstantForce | ConstantForce, physics.ConstantForce, legacyCC.ConstantForce | [cocos/physics/framework/components/constant-force.ts:47](../cocos/physics/framework/components/constant-force.ts#L47) | 缺少 |
| ConfigurableConstraint | ConfigurableConstraint, physics.ConfigurableConstraint | [cocos/physics/framework/components/constraints/configurable-constraint.ts:638](../cocos/physics/framework/components/constraints/configurable-constraint.ts#L638) | 缺少 |
| Constraint | Constraint, physics.Constraint | [cocos/physics/framework/components/constraints/constraint.ts:41](../cocos/physics/framework/components/constraints/constraint.ts#L41) | 缺少 |
| FixedConstraint | FixedConstraint, physics.FixedConstraint | [cocos/physics/framework/components/constraints/fixed-constraint.ts:46](../cocos/physics/framework/components/constraints/fixed-constraint.ts#L46) | 缺少 |
| HingeConstraint | HingeConstraint, physics.HingeConstraint | [cocos/physics/framework/components/constraints/hinge-constraint.ts:173](../cocos/physics/framework/components/constraints/hinge-constraint.ts#L173) | 缺少 |
| PointToPointConstraint | physics.PointToPointConstraint, PointToPointConstraint | [cocos/physics/framework/components/constraints/point-to-point-constraint.ts:45](../cocos/physics/framework/components/constraints/point-to-point-constraint.ts#L45) | 缺少 |
| RigidBody | physics.RigidBody, RigidBody, RigidBodyComponent, legacyCC.RigidBodyComponent | [cocos/physics/framework/components/rigid-body.ts:54](../cocos/physics/framework/components/rigid-body.ts#L54) | 缺少 |
| CharacterControllerContact | CharacterControllerContact, physics.CharacterControllerContact | [cocos/physics/framework/physics-interface.ts:267](../cocos/physics/framework/physics-interface.ts#L267) | 缺少 |
| PhysicsRayResult | physics.PhysicsRayResult, PhysicsRayResult, legacyCC.PhysicsRayResult | [cocos/physics/framework/physics-ray-result.ts:34](../cocos/physics/framework/physics-ray-result.ts#L34) | 缺少 |
| PhysicsLineStripCastResult | physics.PhysicsLineStripCastResult, PhysicsLineStripCastResult | [cocos/physics/framework/physics-ray-result.ts:137](../cocos/physics/framework/physics-ray-result.ts#L137) | 缺少 |
| PhysicsSystem | physics.PhysicsSystem, PhysicsSystem, legacyCC.PhysicsSystem | [cocos/physics/framework/physics-system.ts:47](../cocos/physics/framework/physics-system.ts#L47) | 缺少 |

### cocos/primitive（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Primitive | Primitive, legacyCC.Primitive | [cocos/primitive/primitive.ts:49](../cocos/primitive/primitive.ts#L49) | 缺少 |

### cocos/profiler（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Profiler | Profiler | [cocos/profiler/profiler.ts:97](../cocos/profiler/profiler.ts#L97) | 缺少 |

### cocos/render-scene（23）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| MaterialInstance | renderer.MaterialInstance | [cocos/render-scene/core/material-instance.ts:41](../cocos/render-scene/core/material-instance.ts#L41) | [已有文件](../cocos/render-scene/core/material-instance.jsb.ts) |
| PassInstance | renderer.PassInstance | [cocos/render-scene/core/pass-instance.ts:34](../cocos/render-scene/core/pass-instance.ts#L34) | 缺少 |
| Pass | renderer.Pass | [cocos/render-scene/core/pass.ts:94](../cocos/render-scene/core/pass.ts#L94) | [已有文件](../cocos/render-scene/core/pass.jsb.ts) |
| RenderScene | renderer.RenderScene | [cocos/render-scene/core/render-scene.ts:67](../cocos/render-scene/core/render-scene.ts#L67) | [已有文件](../cocos/render-scene/core/render-scene.jsb.ts) |
| RenderWindow | renderer.RenderWindow | [cocos/render-scene/core/render-window.ts:64](../cocos/render-scene/core/render-window.ts#L64) | [已有文件](../cocos/render-scene/core/render-window.jsb.ts) |
| TextureBufferPool | renderer.TextureBufferPool | [cocos/render-scene/core/texture-buffer-pool.ts:65](../cocos/render-scene/core/texture-buffer-pool.ts#L65) | 缺少 |
| Ambient | renderer.scene.Ambient, legacyCC.Ambient | [cocos/render-scene/scene/ambient.ts:35](../cocos/render-scene/scene/ambient.ts#L35) | 缺少 |
| Camera | renderer.scene.Camera | [cocos/render-scene/scene/camera.ts:408](../cocos/render-scene/scene/camera.ts#L408) | [已有文件](../cocos/render-scene/scene/camera.jsb.ts) |
| DirectionalLight | renderer.scene.DirectionalLight | [cocos/render-scene/scene/directional-light.ts:39](../cocos/render-scene/scene/directional-light.ts#L39) | 缺少 |
| Fog | renderer.scene.Fog, legacyCC.Fog | [cocos/render-scene/scene/fog.ts:81](../cocos/render-scene/scene/fog.ts#L81) | 缺少 |
| Light | renderer.scene.Light | [cocos/render-scene/scene/light.ts:77](../cocos/render-scene/scene/light.ts#L77) | 缺少 |
| Model | renderer.scene.Model | [cocos/render-scene/scene/model.ts:117](../cocos/render-scene/scene/model.ts#L117) | [已有文件](../cocos/render-scene/scene/model.jsb.ts) |
| Octree | renderer.scene.Octree | [cocos/render-scene/scene/octree.ts:32](../cocos/render-scene/scene/octree.ts#L32) | 缺少 |
| PointLight | renderer.scene.PointLight | [cocos/render-scene/scene/point-light.ts:35](../cocos/render-scene/scene/point-light.ts#L35) | 缺少 |
| PostSettings | renderer.scene.PostSettings | [cocos/render-scene/scene/post-settings.ts:9](../cocos/render-scene/scene/post-settings.ts#L9) | 缺少 |
| RangedDirectionalLight | renderer.scene.RangedDirectionalLight | [cocos/render-scene/scene/ranged-directional-light.ts:35](../cocos/render-scene/scene/ranged-directional-light.ts#L35) | 缺少 |
| ReflectionProbe | renderer.scene.ReflectionProbe | [cocos/render-scene/scene/reflection-probe.ts:56](../cocos/render-scene/scene/reflection-probe.ts#L56) | [已有文件](../cocos/render-scene/scene/reflection-probe.jsb.ts) |
| Shadows | renderer.scene.Shadows, legacyCC.Shadows | [cocos/render-scene/scene/shadows.ts:196](../cocos/render-scene/scene/shadows.ts#L196) | 缺少 |
| Skin | renderer.scene.Skin | [cocos/render-scene/scene/skin.ts:33](../cocos/render-scene/scene/skin.ts#L33) | 缺少 |
| Skybox | renderer.scene.Skybox, legacyCC.Skybox | [cocos/render-scene/scene/skybox.ts:75](../cocos/render-scene/scene/skybox.ts#L75) | 缺少 |
| SphereLight | renderer.scene.SphereLight | [cocos/render-scene/scene/sphere-light.ts:34](../cocos/render-scene/scene/sphere-light.ts#L34) | 缺少 |
| SpotLight | renderer.scene.SpotLight | [cocos/render-scene/scene/spot-light.ts:42](../cocos/render-scene/scene/spot-light.ts#L42) | 缺少 |
| SubModel | renderer.scene.SubModel | [cocos/render-scene/scene/submodel.ts:51](../cocos/render-scene/scene/submodel.ts#L51) | [已有文件](../cocos/render-scene/scene/submodel.jsb.ts) |

### cocos/rendering（74）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| PipelineCapabilities | rendering.PipelineCapabilities | [cocos/rendering/custom/pipeline.ts:266](../cocos/rendering/custom/pipeline.ts#L266) | 缺少 |
| LightInfo | rendering.LightInfo | [cocos/rendering/custom/types.ts:162](../cocos/rendering/custom/types.ts#L162) | 缺少 |
| ResolvePair | rendering.ResolvePair | [cocos/rendering/custom/types.ts:188](../cocos/rendering/custom/types.ts#L188) | 缺少 |
| CopyPair | rendering.CopyPair | [cocos/rendering/custom/types.ts:222](../cocos/rendering/custom/types.ts#L222) | 缺少 |
| UploadPair | rendering.UploadPair | [cocos/rendering/custom/types.ts:281](../cocos/rendering/custom/types.ts#L281) | 缺少 |
| MovePair | rendering.MovePair | [cocos/rendering/custom/types.ts:324](../cocos/rendering/custom/types.ts#L324) | 缺少 |
| PipelineStatistics | rendering.PipelineStatistics | [cocos/rendering/custom/types.ts:368](../cocos/rendering/custom/types.ts#L368) | 缺少 |
| RenderCommonObjectPool | rendering.RenderCommonObjectPool | [cocos/rendering/custom/types.ts:399](../cocos/rendering/custom/types.ts#L399) | 缺少 |
| DebugView | DebugView | [cocos/rendering/debug-view.ts:127](../cocos/rendering/debug-view.ts#L127) | 缺少 |
| BloomStage | BloomStage | [cocos/rendering/deferred/bloom-stage.ts:60](../cocos/rendering/deferred/bloom-stage.ts#L60) | 缺少 |
| DeferredPipeline | DeferredPipeline | [cocos/rendering/deferred/deferred-pipeline.ts:64](../cocos/rendering/deferred/deferred-pipeline.ts#L64) | 缺少 |
| GbufferStage | GbufferStage | [cocos/rendering/deferred/gbuffer-stage.ts:51](../cocos/rendering/deferred/gbuffer-stage.ts#L51) | 缺少 |
| LightingStage | LightingStage | [cocos/rendering/deferred/lighting-stage.ts:63](../cocos/rendering/deferred/lighting-stage.ts#L63) | 缺少 |
| MainFlow | MainFlow | [cocos/rendering/deferred/main-flow.ts:45](../cocos/rendering/deferred/main-flow.ts#L45) | 缺少 |
| PostProcessStage | PostProcessStage | [cocos/rendering/deferred/postprocess-stage.ts:50](../cocos/rendering/deferred/postprocess-stage.ts#L50) | 缺少 |
| UBOGlobal | pipeline.UBOGlobal | [cocos/rendering/define.ts:198](../cocos/rendering/define.ts#L198) | 缺少 |
| UBOCamera | pipeline.UBOCamera | [cocos/rendering/define.ts:252](../cocos/rendering/define.ts#L252) | 缺少 |
| UBOShadow | pipeline.UBOShadow | [cocos/rendering/define.ts:322](../cocos/rendering/define.ts#L322) | 缺少 |
| UBOCSM | pipeline.UBOCSM | [cocos/rendering/define.ts:373](../cocos/rendering/define.ts#L373) | 缺少 |
| UBOLocal | pipeline.UBOLocal | [cocos/rendering/define.ts:459](../cocos/rendering/define.ts#L459) | 缺少 |
| UBOWorldBound | pipeline.UBOWorldBound | [cocos/rendering/define.ts:499](../cocos/rendering/define.ts#L499) | 缺少 |
| UBOLocalBatched | pipeline.UBOLocalBatched | [cocos/rendering/define.ts:526](../cocos/rendering/define.ts#L526) | 缺少 |
| UBOForwardLight | pipeline.UBOForwardLight | [cocos/rendering/define.ts:564](../cocos/rendering/define.ts#L564) | 缺少 |
| UBODeferredLight | pipeline.UBODeferredLight | [cocos/rendering/define.ts:596](../cocos/rendering/define.ts#L596) | 缺少 |
| UBOSkinningTexture | pipeline.UBOSkinningTexture | [cocos/rendering/define.ts:606](../cocos/rendering/define.ts#L606) | 缺少 |
| UBOSkinningAnimation | pipeline.UBOSkinningAnimation | [cocos/rendering/define.ts:628](../cocos/rendering/define.ts#L628) | 缺少 |
| UBOSkinning | pipeline.UBOSkinning | [cocos/rendering/define.ts:651](../cocos/rendering/define.ts#L651) | 缺少 |
| UBOMorph | pipeline.UBOMorph | [cocos/rendering/define.ts:708](../cocos/rendering/define.ts#L708) | 缺少 |
| UBOUILocal | pipeline.UBOUILocal | [cocos/rendering/define.ts:736](../cocos/rendering/define.ts#L736) | 缺少 |
| UBOSH | pipeline.UBOSH | [cocos/rendering/define.ts:772](../cocos/rendering/define.ts#L772) | 缺少 |
| ForwardFlow | ForwardFlow | [cocos/rendering/forward/forward-flow.ts:37](../cocos/rendering/forward/forward-flow.ts#L37) | 缺少 |
| ForwardPipeline | ForwardPipeline | [cocos/rendering/forward/forward-pipeline.ts:51](../cocos/rendering/forward/forward-pipeline.ts#L51) | 缺少 |
| ForwardStage | ForwardStage | [cocos/rendering/forward/forward-stage.ts:49](../cocos/rendering/forward/forward-stage.ts#L49) | 缺少 |
| GeometryRenderer | GeometryRenderer, legacyCC.internal.GeometryRenderer | [cocos/rendering/geometry-renderer.ts:148](../cocos/rendering/geometry-renderer.ts#L148) | [已有文件](../cocos/rendering/geometry-renderer.jsb.ts) |
| InstancedBuffer | InstancedBuffer | [cocos/rendering/instanced-buffer.ts:61](../cocos/rendering/instanced-buffer.ts#L61) | 缺少 |
| PipelineEventProcessor | PipelineEventProcessor | [cocos/rendering/pipeline-event.ts:75](../cocos/rendering/pipeline-event.ts#L75) | 缺少 |
| PipelineSceneData | PipelineSceneData | [cocos/rendering/pipeline-scene-data.ts:45](../cocos/rendering/pipeline-scene-data.ts#L45) | 缺少 |
| PipelineStateManager | PipelineStateManager | [cocos/rendering/pipeline-state-manager.ts:28](../cocos/rendering/pipeline-state-manager.ts#L28) | 缺少 |
| BlitScreen | postProcess.BlitScreen | [cocos/rendering/post-process/components/blit-screen.ts:27](../cocos/rendering/post-process/components/blit-screen.ts#L27) | 缺少 |
| Bloom | postProcess.Bloom | [cocos/rendering/post-process/components/bloom.ts:8](../cocos/rendering/post-process/components/bloom.ts#L8) | 缺少 |
| ColorGrading | postProcess.ColorGrading | [cocos/rendering/post-process/components/color-grading.ts:7](../cocos/rendering/post-process/components/color-grading.ts#L7) | 缺少 |
| DOF | postProcess.DOF | [cocos/rendering/post-process/components/dof.ts:5](../cocos/rendering/post-process/components/dof.ts#L5) | 缺少 |
| FSR | postProcess.FSR | [cocos/rendering/post-process/components/fsr.ts:6](../cocos/rendering/post-process/components/fsr.ts#L6) | 缺少 |
| HBAO | postProcess.HBAO | [cocos/rendering/post-process/components/hbao.ts:30](../cocos/rendering/post-process/components/hbao.ts#L30) | 缺少 |
| PostProcessSetting | postProcess.PostProcessSetting | [cocos/rendering/post-process/components/post-process-setting.ts:5](../cocos/rendering/post-process/components/post-process-setting.ts#L5) | 缺少 |
| PostProcess | postProcess.PostProcess | [cocos/rendering/post-process/components/post-process.ts:7](../cocos/rendering/post-process/components/post-process.ts#L7) | 缺少 |
| TAA | postProcess.TAA | [cocos/rendering/post-process/components/taa.ts:5](../cocos/rendering/post-process/components/taa.ts#L5) | 缺少 |
| BasePass（抽象） | postProcess.BasePass | [cocos/rendering/post-process/passes/base-pass.ts:54](../cocos/rendering/post-process/passes/base-pass.ts#L54) | 缺少 |
| BlitScreenPass | postProcess.BlitScreenPass | [cocos/rendering/post-process/passes/blit-screen-pass.ts:12](../cocos/rendering/post-process/passes/blit-screen-pass.ts#L12) | 缺少 |
| BloomPass | postProcess.BloomPass | [cocos/rendering/post-process/passes/bloom-pass.ts:16](../cocos/rendering/post-process/passes/bloom-pass.ts#L16) | 缺少 |
| ColorGradingPass | postProcess.ColorGradingPass | [cocos/rendering/post-process/passes/color-grading-pass.ts:12](../cocos/rendering/post-process/passes/color-grading-pass.ts#L12) | 缺少 |
| DofPass | postProcess.DofPass | [cocos/rendering/post-process/passes/dof-pass.ts:12](../cocos/rendering/post-process/passes/dof-pass.ts#L12) | 缺少 |
| FloatOutputProcessPass | postProcess.FloatOutputProcessPass | [cocos/rendering/post-process/passes/float-output-process-pass.ts:35](../cocos/rendering/post-process/passes/float-output-process-pass.ts#L35) | 缺少 |
| ForwardFinalPass | postProcess.ForwardFinalPass | [cocos/rendering/post-process/passes/forward-final-pass.ts:9](../cocos/rendering/post-process/passes/forward-final-pass.ts#L9) | 缺少 |
| ForwardPass | postProcess.ForwardPass | [cocos/rendering/post-process/passes/forward-pass.ts:12](../cocos/rendering/post-process/passes/forward-pass.ts#L12) | 缺少 |
| ForwardTransparencyPass | postProcess.ForwardTransparencyPass | [cocos/rendering/post-process/passes/forward-transparency-pass.ts:34](../cocos/rendering/post-process/passes/forward-transparency-pass.ts#L34) | 缺少 |
| ForwardTransparencySimplePass | postProcess.ForwardTransparencySimplePass | [cocos/rendering/post-process/passes/forward-transparency-simple-pass.ts:32](../cocos/rendering/post-process/passes/forward-transparency-simple-pass.ts#L32) | 缺少 |
| FSRPass | postProcess.FSRPass | [cocos/rendering/post-process/passes/fsr-pass.ts:14](../cocos/rendering/post-process/passes/fsr-pass.ts#L14) | 缺少 |
| FxaaPass | postProcess.FxaaPass | [cocos/rendering/post-process/passes/fxaa-pass.ts:11](../cocos/rendering/post-process/passes/fxaa-pass.ts#L11) | 缺少 |
| PostFinalPass | postProcess.PostFinalPass | [cocos/rendering/post-process/passes/post-final-pass.ts:9](../cocos/rendering/post-process/passes/post-final-pass.ts#L9) | 缺少 |
| SettingPass（抽象） | postProcess.SettingPass | [cocos/rendering/post-process/passes/setting-pass.ts:12](../cocos/rendering/post-process/passes/setting-pass.ts#L12) | 缺少 |
| ShadowPass | postProcess.ShadowPass | [cocos/rendering/post-process/passes/shadow-pass.ts:7](../cocos/rendering/post-process/passes/shadow-pass.ts#L7) | 缺少 |
| SSSSBlurData | postProcess.SSSSBlurData | [cocos/rendering/post-process/passes/skin-pass.ts:57](../cocos/rendering/post-process/passes/skin-pass.ts#L57) | 缺少 |
| SkinPass | postProcess.SkinPass | [cocos/rendering/post-process/passes/skin-pass.ts:187](../cocos/rendering/post-process/passes/skin-pass.ts#L187) | 缺少 |
| TAAPass | postProcess.TAAPass | [cocos/rendering/post-process/passes/taa-pass.ts:86](../cocos/rendering/post-process/passes/taa-pass.ts#L86) | 缺少 |
| PostProcessBuilder | postProcess.PostProcessBuilder | [cocos/rendering/post-process/post-process-builder.ts:26](../cocos/rendering/post-process/post-process-builder.ts#L26) | 缺少 |
| ReflectionProbeFlow | ReflectionProbeFlow | [cocos/rendering/reflection-probe/reflection-probe-flow.ts:38](../cocos/rendering/reflection-probe/reflection-probe-flow.ts#L38) | 缺少 |
| ReflectionProbeStage | ReflectionProbeStage | [cocos/rendering/reflection-probe/reflection-probe-stage.ts:43](../cocos/rendering/reflection-probe/reflection-probe-stage.ts#L43) | 缺少 |
| RenderFlow（抽象） | RenderFlow, legacyCC.RenderFlow | [cocos/rendering/render-flow.ts:46](../cocos/rendering/render-flow.ts#L46) | 缺少 |
| RenderPipeline（抽象） | RenderPipeline, legacyCC.RenderPipeline | [cocos/rendering/render-pipeline.ts:117](../cocos/rendering/render-pipeline.ts#L117) | [已有文件](../cocos/rendering/render-pipeline.jsb.ts) |
| RenderStage（抽象） | RenderStage, legacyCC.RenderStage | [cocos/rendering/render-stage.ts:50](../cocos/rendering/render-stage.ts#L50) | [已有文件](../cocos/rendering/render-stage.jsb.ts) |
| PipelineInputAssemblerData | PipelineInputAssemblerData | [cocos/rendering/render-types.ts:27](../cocos/rendering/render-types.ts#L27) | 缺少 |
| ShadowFlow | ShadowFlow | [cocos/rendering/shadow/shadow-flow.ts:48](../cocos/rendering/shadow/shadow-flow.ts#L48) | 缺少 |
| ShadowStage | ShadowStage | [cocos/rendering/shadow/shadow-stage.ts:44](../cocos/rendering/shadow/shadow-stage.ts#L44) | 缺少 |

### cocos/root.ts（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Root | Root, legacyCC.Root | [cocos/root.ts:67](../cocos/root.ts#L67) | [已有文件](../cocos/root.jsb.ts) |

### cocos/scene-graph（24）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| EventHandler | EventHandler | [cocos/scene-graph/component-event-handler.ts:58](../cocos/scene-graph/component-event-handler.ts#L58) | 缺少 |
| Component | Component, legacyCC.Component | [cocos/scene-graph/component.ts:57](../cocos/scene-graph/component.ts#L57) | 缺少 |
| Layers | Layers, legacyCC.Layers | [cocos/scene-graph/layers.ts:60](../cocos/scene-graph/layers.ts#L60) | [已有文件](../cocos/scene-graph/layers.jsb.ts) |
| NodeActivator | NodeActivator | [cocos/scene-graph/node-activator.ts:135](../cocos/scene-graph/node-activator.ts#L135) | 缺少 |
| NodeEventProcessor | legacyCC.NodeEventProcessor | [cocos/scene-graph/node-event-processor.ts:72](../cocos/scene-graph/node-event-processor.ts#L72) | 缺少 |
| Node | BaseNode, Node, legacyCC.Node | [cocos/scene-graph/node.ts:111](../cocos/scene-graph/node.ts#L111) | [已有文件](../cocos/scene-graph/node.jsb.ts) |
| TargetInfo | Prefab._utils.TargetInfo | [cocos/scene-graph/prefab/prefab-info.ts:45](../cocos/scene-graph/prefab/prefab-info.ts#L45) | 缺少 |
| TargetOverrideInfo | Prefab._utils.TargetOverrideInfo | [cocos/scene-graph/prefab/prefab-info.ts:53](../cocos/scene-graph/prefab/prefab-info.ts#L53) | 缺少 |
| CompPrefabInfo | Prefab._utils.CompPrefabInfo | [cocos/scene-graph/prefab/prefab-info.ts:76](../cocos/scene-graph/prefab/prefab-info.ts#L76) | 缺少 |
| PropertyOverrideInfo | Prefab._utils.PropertyOverrideInfo | [cocos/scene-graph/prefab/prefab-info.ts:86](../cocos/scene-graph/prefab/prefab-info.ts#L86) | 缺少 |
| MountedChildrenInfo | Prefab._utils.MountedChildrenInfo | [cocos/scene-graph/prefab/prefab-info.ts:107](../cocos/scene-graph/prefab/prefab-info.ts#L107) | 缺少 |
| MountedComponentsInfo | Prefab._utils.MountedComponentsInfo | [cocos/scene-graph/prefab/prefab-info.ts:126](../cocos/scene-graph/prefab/prefab-info.ts#L126) | 缺少 |
| PrefabInfo | Prefab._utils.PrefabInfo, legacyCC._PrefabInfo | [cocos/scene-graph/prefab/prefab-info.ts:218](../cocos/scene-graph/prefab/prefab-info.ts#L218) | 缺少 |
| Prefab | Prefab, legacyCC._Prefab, legacyCC.Prefab | [cocos/scene-graph/prefab/prefab.ts:74](../cocos/scene-graph/prefab/prefab.ts#L74) | 缺少 |
| AmbientInfo | AmbientInfo, legacyCC.AmbientInfo | [cocos/scene-graph/scene-globals.ts:69](../cocos/scene-graph/scene-globals.ts#L69) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| SkyboxInfo | SkyboxInfo, legacyCC.SkyboxInfo | [cocos/scene-graph/scene-globals.ts:265](../cocos/scene-graph/scene-globals.ts#L265) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| FogInfo | FogInfo | [cocos/scene-graph/scene-globals.ts:628](../cocos/scene-graph/scene-globals.ts#L628) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| ShadowsInfo | ShadowsInfo, legacyCC.ShadowsInfo | [cocos/scene-graph/scene-globals.ts:854](../cocos/scene-graph/scene-globals.ts#L854) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| OctreeInfo | OctreeInfo, legacyCC.OctreeInfo | [cocos/scene-graph/scene-globals.ts:1038](../cocos/scene-graph/scene-globals.ts#L1038) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| SkinInfo | SkinInfo, legacyCC.SkinInfo | [cocos/scene-graph/scene-globals.ts:1133](../cocos/scene-graph/scene-globals.ts#L1133) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| PostSettingsInfo | PostSettingsInfo, legacyCC.PostSettingsInfo | [cocos/scene-graph/scene-globals.ts:1209](../cocos/scene-graph/scene-globals.ts#L1209) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| LightProbeInfo | LightProbeInfo | [cocos/scene-graph/scene-globals.ts:1252](../cocos/scene-graph/scene-globals.ts#L1252) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| SceneGlobals | SceneGlobals, legacyCC.SceneGlobals | [cocos/scene-graph/scene-globals.ts:1604](../cocos/scene-graph/scene-globals.ts#L1604) | [已有文件](../cocos/scene-graph/scene-globals.jsb.ts) |
| Scene | Scene, legacyCC.Scene | [cocos/scene-graph/scene.ts:44](../cocos/scene-graph/scene.ts#L44) | [已有文件](../cocos/scene-graph/scene.jsb.ts) |

### cocos/serialization（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| CCON | legacyCC.internal.CCON | [cocos/serialization/ccon.ts:35](../cocos/serialization/ccon.ts#L35) | 缺少 |
| BufferBuilder | legacyCC.internal.BufferBuilder | [cocos/serialization/ccon.ts:176](../cocos/serialization/ccon.ts#L176) | 缺少 |
| Details | deserialize.Details, Details | [cocos/serialization/deserialize.ts:446](../cocos/serialization/deserialize.ts#L446) | 缺少 |

### cocos/sorting（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| Sorting2D | Sorting2D | [cocos/sorting/sorting-2d.ts:45](../cocos/sorting/sorting-2d.ts#L45) | 缺少 |
| SortingLayers | SortingLayers | [cocos/sorting/sorting-layers.ts:50](../cocos/sorting/sorting-layers.ts#L50) | 缺少 |
| Sorting | Sorting | [cocos/sorting/sorting.ts:42](../cocos/sorting/sorting.ts#L42) | 缺少 |

### cocos/spine（5）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| SkeletonData | sp.SkeletonData, legacyCC.internal.SpineSkeletonData | [cocos/spine/skeleton-data.ts:40](../cocos/spine/skeleton-data.ts#L40) | 缺少 |
| SkeletonSystem | legacyCC.internal.SpineSkeletonSystem | [cocos/spine/skeleton-system.ts:30](../cocos/spine/skeleton-system.ts#L30) | 缺少 |
| SpineSocket | sp.SpineSocket | [cocos/spine/skeleton.ts:161](../cocos/spine/skeleton.ts#L161) | 缺少 |
| Skeleton | sp.Skeleton, legacyCC.internal.SpineSkeleton | [cocos/spine/skeleton.ts:206](../cocos/spine/skeleton.ts#L206) | 缺少 |
| VertexEffectDelegate | sp.VertexEffectDelegate | [cocos/spine/vertex-effect-delegate.ts:34](../cocos/spine/vertex-effect-delegate.ts#L34) | 缺少 |

### cocos/terrain（9）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| HeightField | HeightField | [cocos/terrain/height-field.ts:27](../cocos/terrain/height-field.ts#L27) | 缺少 |
| TerrainLayerInfo | TerrainLayerInfo | [cocos/terrain/terrain-asset.ts:228](../cocos/terrain/terrain-asset.ts#L228) | 缺少 |
| TerrainLayerBinaryInfo | TerrainLayerBinaryInfo | [cocos/terrain/terrain-asset.ts:248](../cocos/terrain/terrain-asset.ts#L248) | 缺少 |
| TerrainAsset | TerrainAsset | [cocos/terrain/terrain-asset.ts:262](../cocos/terrain/terrain-asset.ts#L262) | 缺少 |
| TerrainInfo | TerrainInfo | [cocos/terrain/terrain.ts:59](../cocos/terrain/terrain.ts#L59) | 缺少 |
| TerrainLayer | TerrainLayer | [cocos/terrain/terrain.ts:133](../cocos/terrain/terrain.ts#L133) | 缺少 |
| TerrainBlockLightmapInfo | TerrainBlockLightmapInfo | [cocos/terrain/terrain.ts:378](../cocos/terrain/terrain.ts#L378) | 缺少 |
| TerrainBlock | TerrainBlock | [cocos/terrain/terrain.ts:401](../cocos/terrain/terrain.ts#L401) | 缺少 |
| Terrain | Terrain | [cocos/terrain/terrain.ts:1202](../cocos/terrain/terrain.ts#L1202) | 缺少 |

### cocos/tiledmap（6）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| TiledUserNodeData | TiledUserNodeData | [cocos/tiledmap/tiled-layer.ts:62](../cocos/tiledmap/tiled-layer.ts#L62) | 缺少 |
| TiledLayer | TiledLayer | [cocos/tiledmap/tiled-layer.ts:101](../cocos/tiledmap/tiled-layer.ts#L101) | 缺少 |
| TiledMapAsset | TiledMapAsset | [cocos/tiledmap/tiled-map-asset.ts:41](../cocos/tiledmap/tiled-map-asset.ts#L41) | 缺少 |
| TiledMap | TiledMap | [cocos/tiledmap/tiled-map.ts:53](../cocos/tiledmap/tiled-map.ts#L53) | 缺少 |
| TiledObjectGroup | TiledObjectGroup | [cocos/tiledmap/tiled-object-group.ts:45](../cocos/tiledmap/tiled-object-group.ts#L45) | 缺少 |
| TiledTile | TiledTile | [cocos/tiledmap/tiled-tile.ts:43](../cocos/tiledmap/tiled-tile.ts#L43) | 缺少 |

### cocos/tween（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| TweenAction | TweenAction | [cocos/tween/tween-action.ts:105](../cocos/tween/tween-action.ts#L105) | 缺少 |
| TweenSystem | TweenSystem | [cocos/tween/tween-system.ts:36](../cocos/tween/tween-system.ts#L36) | 缺少 |
| Tween | Tween, legacyCC.Tween | [cocos/tween/tween.ts:103](../cocos/tween/tween.ts#L103) | 缺少 |

### cocos/ui（20）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| BlockInputEvents | BlockInputEvents, BlockInputEventsComponent, legacyCC.BlockInputEventsComponent | [cocos/ui/block-input-events.ts:48](../cocos/ui/block-input-events.ts#L48) | 缺少 |
| Button | Button, ButtonComponent, legacyCC.Button, legacyCC.ButtonComponent | [cocos/ui/button.ts:171](../cocos/ui/button.ts#L171) | 缺少 |
| UIReorderComponent（废弃） | UIReorderComponent, legacyCC.UIReorderComponent | [cocos/ui/deprecated.ts:50](../cocos/ui/deprecated.ts#L50) | 缺少 |
| EditBox | EditBox, EditBoxComponent, legacyCC.EditBoxComponent, legacyCC.internal.EditBox | [cocos/ui/editbox/edit-box.ts:71](../cocos/ui/editbox/edit-box.ts#L71) | 缺少 |
| Layout | Layout, LayoutComponent, legacyCC.Layout, legacyCC.LayoutComponent | [cocos/ui/layout.ts:208](../cocos/ui/layout.ts#L208) | 缺少 |
| PageViewIndicator | PageViewIndicator, PageViewIndicatorComponent, legacyCC.PageViewIndicator, legacyCC.PageViewIndicatorComponent | [cocos/ui/page-view-indicator.ts:71](../cocos/ui/page-view-indicator.ts#L71) | 缺少 |
| PageView | PageView, PageViewComponent, legacyCC.PageView, legacyCC.PageViewComponent | [cocos/ui/page-view.ts:99](../cocos/ui/page-view.ts#L99) | 缺少 |
| ProgressBar | ProgressBar, ProgressBarComponent, legacyCC.ProgressBar, legacyCC.ProgressBarComponent | [cocos/ui/progress-bar.ts:96](../cocos/ui/progress-bar.ts#L96) | 缺少 |
| SafeArea | SafeArea, SafeAreaComponent, legacyCC.SafeArea, legacyCC.SafeAreaComponent | [cocos/ui/safe-area.ts:56](../cocos/ui/safe-area.ts#L56) | 缺少 |
| ScrollBar | ScrollBar, ScrollBarComponent, legacyCC.ScrollBar, legacyCC.ScrollBarComponent | [cocos/ui/scroll-bar.ts:81](../cocos/ui/scroll-bar.ts#L81) | 缺少 |
| ScrollView | ScrollView, ScrollViewComponent, legacyCC.ScrollView, legacyCC.ScrollViewComponent | [cocos/ui/scroll-view.ts:231](../cocos/ui/scroll-view.ts#L231) | 缺少 |
| Slider | Slider, SliderComponent, legacyCC.Slider, legacyCC.SliderComponent | [cocos/ui/slider.ts:75](../cocos/ui/slider.ts#L75) | 缺少 |
| SubContextView | SubContextView, legacyCC.SubContextView | [cocos/ui/sub-context-view.ts:65](../cocos/ui/sub-context-view.ts#L65) | 缺少 |
| ToggleContainer | ToggleContainer, ToggleContainerComponent, legacyCC.ToggleContainer, legacyCC.ToggleContainerComponent | [cocos/ui/toggle-container.ts:43](../cocos/ui/toggle-container.ts#L43) | 缺少 |
| Toggle | Toggle, ToggleComponent, legacyCC.Toggle, legacyCC.ToggleComponent | [cocos/ui/toggle.ts:48](../cocos/ui/toggle.ts#L48) | 缺少 |
| UICoordinateTracker | UICoordinateTracker, UICoordinateTrackerComponent | [cocos/ui/ui-coordinate-tracker.ts:39](../cocos/ui/ui-coordinate-tracker.ts#L39) | 缺少 |
| ViewGroup | ViewGroup, legacyCC.ViewGroup | [cocos/ui/view-group.ts:44](../cocos/ui/view-group.ts#L44) | 缺少 |
| View | View | [cocos/ui/view.ts:65](../cocos/ui/view.ts#L65) | 缺少 |
| ResolutionPolicy | ResolutionPolicy, legacyCC.ResolutionPolicy | [cocos/ui/view.ts:945](../cocos/ui/view.ts#L945) | 缺少 |
| Widget | Widget, WidgetComponent, legacyCC.Widget, legacyCC.WidgetComponent | [cocos/ui/widget.ts:221](../cocos/ui/widget.ts#L221) | 缺少 |

### cocos/video（4）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| VideoClip | VideoClip | [cocos/video/assets/video-clip.ts:34](../cocos/video/assets/video-clip.ts#L34) | 缺少 |
| VideoPlayerImplManager | legacyCC.internal.VideoPlayerImplManager | [cocos/video/video-player-impl-manager.ts:29](../cocos/video/video-player-impl-manager.ts#L29) | 缺少 |
| VideoPlayerImpl（抽象） | legacyCC.internal.VideoPlayerImpl | [cocos/video/video-player-impl.ts:35](../cocos/video/video-player-impl.ts#L35) | 缺少 |
| VideoPlayer | VideoPlayer, legacyCC.internal.VideoPlayer | [cocos/video/video-player.ts:46](../cocos/video/video-player.ts#L46) | 缺少 |

### cocos/web-view（3）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| WebViewImplManager | legacyCC.internal.WebViewImplManager | [cocos/web-view/web-view-impl-manager.ts:29](../cocos/web-view/web-view-impl-manager.ts#L29) | 缺少 |
| WebViewImpl（抽象） | legacyCC.internal.WebViewImpl | [cocos/web-view/web-view-impl.ts:33](../cocos/web-view/web-view-impl.ts#L33) | 缺少 |
| WebView | WebView, legacyCC.internal.WebView | [cocos/web-view/web-view.ts:43](../cocos/web-view/web-view.ts#L43) | 缺少 |

### cocos/xr（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| XrUIPressEvent | XrUIPressEvent | [cocos/xr/event/xr-event-handle.ts:111](../cocos/xr/event/xr-event-handle.ts#L111) | 缺少 |

### extensions（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| NodePool | NodePool | [extensions/ccpool/node-pool.ts:64](../extensions/ccpool/node-pool.ts#L64) | 缺少 |

### pal（1）

| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |
| --- | --- | --- | --- |
| AudioPCMDataView | AudioPCMDataView | [pal/audio/type.d.ts:29](../pal/audio/type.d.ts#L29) | 缺少 |

## 内部、仅类型和外部依赖

以下不直接进入引擎自有公开类的薄壳数量；保留在机器清单中供人工确认。

| 类 | 分类 | 对外名称 | 源文件 |
| --- | --- | --- | --- |
| UIDrawBatch | 内部或仅类型导出（内部/仅类型） | UIDrawBatch | cocos/2d/renderer/deprecated.ts:43 |
| SkelAnimDataHub | 内部或仅类型导出（内部/仅类型） | SkelAnimDataHub | cocos/3d/skeletal-animation/skeletal-animation-data-hub.ts:39 |
| RealKeyframeValue | 内部或仅类型导出（内部/仅类型） | RealKeyframeValue | cocos/core/curves/curve.ts:68 |
| QuatKeyframeValue | 内部或仅类型导出（内部/仅类型） | QuatKeyframeValue | cocos/core/curves/quat-curve.ts:73 |
| GCObject | 内部或仅类型导出（内部/仅类型） | GCObject | cocos/core/data/gc-object.ts:27 |
| CCObject | 内部或仅类型导出（内部/仅类型） | CCObject, legacyCC.Object | cocos/core/data/object.ts:172 |
| CallbacksInvoker | 内部或仅类型导出（内部/仅类型） | CallbacksInvoker, legacyCC._Test.CallbacksInvoker | cocos/core/event/callbacks-invoker.ts:186 |
| OptimizedKey | 内部或仅类型导出（内部/仅类型） | geometry.OptimizedKey | cocos/core/geometry/curve.ts:73 |
| Screen | 内部或仅类型导出（内部/仅类型） | Screen | cocos/core/platform/screen.ts:60 |
| AnimationCache | 内部或仅类型导出（内部/仅类型） | dragonBones.AnimationCache | cocos/dragon-bones/ArmatureCache.ts:104 |
| DeviceManager | 内部或仅类型导出（内部/仅类型） | gfx.DeviceManager | cocos/gfx/device-manager.ts:96 |
| LODData | 内部或仅类型导出（内部/仅类型） | renderer.scene.LODData | cocos/render-scene/scene/lod-group.ts:35 |
| LODGroup | 内部或仅类型导出（内部/仅类型） | renderer.scene.LODGroup | cocos/render-scene/scene/lod-group.ts:65 |
| PrivateNode | 内部或仅类型导出（内部/仅类型） | PrivateNode, legacyCC.PrivateNode | cocos/scene-graph/deprecated.ts:308 |
| PrefabInstance | 内部或仅类型导出（内部/仅类型） | Prefab._utils.PrefabInstance | cocos/scene-graph/prefab/prefab-info.ts:149 |
| String | 外部依赖（公开候选） | sp.spine.String | cocos/spine/lib/spine-core.d.ts:28 |
| SPVectorFloat | 外部依赖（公开候选） | sp.spine.SPVectorFloat | cocos/spine/lib/spine-core.d.ts:37 |
| SPVectorPhysicsConstraintPtr | 外部依赖（公开候选） | sp.spine.SPVectorPhysicsConstraintPtr | cocos/spine/lib/spine-core.d.ts:48 |
| SPVectorPhysicsConstraintDataPtr | 外部依赖（公开候选） | sp.spine.SPVectorPhysicsConstraintDataPtr | cocos/spine/lib/spine-core.d.ts:57 |
| Animation | 外部依赖（公开候选） | sp.spine.Animation | cocos/spine/lib/spine-core.d.ts:63 |
| Timeline | 外部依赖（公开候选） | sp.spine.Timeline | cocos/spine/lib/spine-core.d.ts:72 |
| CurveTimeline | 外部依赖（公开候选） | sp.spine.CurveTimeline | cocos/spine/lib/spine-core.d.ts:127 |
| RotateTimeline | 外部依赖（公开候选） | sp.spine.RotateTimeline | cocos/spine/lib/spine-core.d.ts:161 |
| TranslateTimeline | 外部依赖（公开候选） | sp.spine.TranslateTimeline | cocos/spine/lib/spine-core.d.ts:179 |
| ScaleTimeline | 外部依赖（公开候选） | sp.spine.ScaleTimeline | cocos/spine/lib/spine-core.d.ts:193 |
| ShearTimeline | 外部依赖（公开候选） | sp.spine.ShearTimeline | cocos/spine/lib/spine-core.d.ts:198 |
| ColorTimeline | 外部依赖（公开候选） | sp.spine.ColorTimeline | cocos/spine/lib/spine-core.d.ts:210 |
| TwoColorTimeline | 外部依赖（公开候选） | sp.spine.TwoColorTimeline | cocos/spine/lib/spine-core.d.ts:225 |
| RGBATimeline | 外部依赖（公开候选） | sp.spine.RGBATimeline | cocos/spine/lib/spine-core.d.ts:240 |
| AttachmentTimeline | 外部依赖（公开候选） | sp.spine.AttachmentTimeline | cocos/spine/lib/spine-core.d.ts:251 |
| DeformTimeline | 外部依赖（公开候选） | sp.spine.DeformTimeline | cocos/spine/lib/spine-core.d.ts:276 |
| EventTimeline | 外部依赖（公开候选） | sp.spine.EventTimeline | cocos/spine/lib/spine-core.d.ts:286 |
| DrawOrderTimeline | 外部依赖（公开候选） | sp.spine.DrawOrderTimeline | cocos/spine/lib/spine-core.d.ts:307 |
| IkConstraintTimeline | 外部依赖（公开候选） | sp.spine.IkConstraintTimeline | cocos/spine/lib/spine-core.d.ts:328 |
| TransformConstraintTimeline | 外部依赖（公开候选） | sp.spine.TransformConstraintTimeline | cocos/spine/lib/spine-core.d.ts:336 |
| PathConstraintPositionTimeline | 外部依赖（公开候选） | sp.spine.PathConstraintPositionTimeline | cocos/spine/lib/spine-core.d.ts:343 |
| PathConstraintSpacingTimeline | 外部依赖（公开候选） | sp.spine.PathConstraintSpacingTimeline | cocos/spine/lib/spine-core.d.ts:350 |
| PathConstraintMixTimeline | 外部依赖（公开候选） | sp.spine.PathConstraintMixTimeline | cocos/spine/lib/spine-core.d.ts:355 |
| AnimationState | 外部依赖（公开候选） | sp.spine.AnimationState | cocos/spine/lib/spine-core.d.ts:363 |
| TrackEntry | 外部依赖（公开候选） | sp.spine.TrackEntry | cocos/spine/lib/spine-core.d.ts:387 |
| EventQueue | 外部依赖（公开候选） | sp.spine.EventQueue | cocos/spine/lib/spine-core.d.ts:424 |
| AnimationStateAdapter | 外部依赖（公开候选） | sp.spine.AnimationStateAdapter | cocos/spine/lib/spine-core.d.ts:454 |
| AnimationStateData | 外部依赖（公开候选） | sp.spine.AnimationStateData | cocos/spine/lib/spine-core.d.ts:462 |
| AssetManager | 外部依赖（公开候选） | sp.spine.AssetManager | cocos/spine/lib/spine-core.d.ts:471 |
| AtlasAttachmentLoader | 外部依赖（公开候选） | sp.spine.AtlasAttachmentLoader | cocos/spine/lib/spine-core.d.ts:497 |
| Bone | 外部依赖（公开候选） | sp.spine.Bone | cocos/spine/lib/spine-core.d.ts:513 |
| BoneData | 外部依赖（公开候选） | sp.spine.BoneData | cocos/spine/lib/spine-core.d.ts:557 |
| ConstraintData | 外部依赖（公开候选） | sp.spine.ConstraintData | cocos/spine/lib/spine-core.d.ts:580 |
| Event | 外部依赖（公开候选） | sp.spine.Event | cocos/spine/lib/spine-core.d.ts:586 |
| EventData | 外部依赖（公开候选） | sp.spine.EventData | cocos/spine/lib/spine-core.d.ts:596 |
| IkConstraint | 外部依赖（公开候选） | sp.spine.IkConstraint | cocos/spine/lib/spine-core.d.ts:606 |
| IkConstraintData | 外部依赖（公开候选） | sp.spine.IkConstraintData | cocos/spine/lib/spine-core.d.ts:623 |
| PathConstraint | 外部依赖（公开候选） | sp.spine.PathConstraint | cocos/spine/lib/spine-core.d.ts:634 |
| PathConstraintData | 外部依赖（公开候选） | sp.spine.PathConstraintData | cocos/spine/lib/spine-core.d.ts:658 |
| SharedAssetManager | 外部依赖（公开候选） | sp.spine.SharedAssetManager | cocos/spine/lib/spine-core.d.ts:703 |
| Skeleton | 外部依赖（公开候选） | sp.spine.Skeleton | cocos/spine/lib/spine-core.d.ts:721 |
| SkeletonBinary | 外部依赖（公开候选） | sp.spine.SkeletonBinary | cocos/spine/lib/spine-core.d.ts:779 |
| SkeletonBounds | 外部依赖（公开候选） | sp.spine.SkeletonBounds | cocos/spine/lib/spine-core.d.ts:813 |
| SkeletonClipping | 外部依赖（公开候选） | sp.spine.SkeletonClipping | cocos/spine/lib/spine-core.d.ts:826 |
| SkeletonData | 外部依赖（公开候选） | sp.spine.SkeletonData | cocos/spine/lib/spine-core.d.ts:842 |
| SkeletonJson | 外部依赖（公开候选） | sp.spine.SkeletonJson | cocos/spine/lib/spine-core.d.ts:889 |
| SkinEntry | 外部依赖（公开候选） | sp.spine.SkinEntry | cocos/spine/lib/spine-core.d.ts:906 |
| Skin | 外部依赖（公开候选） | sp.spine.Skin | cocos/spine/lib/spine-core.d.ts:912 |
| Slot | 外部依赖（公开候选） | sp.spine.Slot | cocos/spine/lib/spine-core.d.ts:929 |
| SlotData | 外部依赖（公开候选） | sp.spine.SlotData | cocos/spine/lib/spine-core.d.ts:946 |
| Texture | 外部依赖（公开候选） | sp.spine.Texture | cocos/spine/lib/spine-core.d.ts:956 |
| TextureRegion | 外部依赖（公开候选） | sp.spine.TextureRegion | cocos/spine/lib/spine-core.d.ts:980 |
| FakeTexture | 外部依赖（公开候选） | sp.spine.FakeTexture | cocos/spine/lib/spine-core.d.ts:994 |
| TextureAtlas | 外部依赖（公开候选） | sp.spine.TextureAtlas | cocos/spine/lib/spine-core.d.ts:999 |
| TextureAtlasPage | 外部依赖（公开候选） | sp.spine.TextureAtlasPage | cocos/spine/lib/spine-core.d.ts:1007 |
| TextureAtlasRegion | 外部依赖（公开候选） | sp.spine.TextureAtlasRegion | cocos/spine/lib/spine-core.d.ts:1017 |
| TransformConstraint | 外部依赖（公开候选） | sp.spine.TransformConstraint | cocos/spine/lib/spine-core.d.ts:1027 |
| TransformConstraintData | 外部依赖（公开候选） | sp.spine.TransformConstraintData | cocos/spine/lib/spine-core.d.ts:1041 |
| PhysicsConstraint | 外部依赖（公开候选） | sp.spine.PhysicsConstraint | cocos/spine/lib/spine-core.d.ts:1070 |
| PhysicsConstraintData | 外部依赖（公开候选） | sp.spine.PhysicsConstraintData | cocos/spine/lib/spine-core.d.ts:1109 |
| Triangulator | 外部依赖（公开候选） | sp.spine.Triangulator | cocos/spine/lib/spine-core.d.ts:1134 |
| Updatable | 外部依赖（公开候选） | sp.spine.Updatable | cocos/spine/lib/spine-core.d.ts:1148 |
| IntSet | 外部依赖（公开候选） | sp.spine.IntSet | cocos/spine/lib/spine-core.d.ts:1152 |
| Color | 外部依赖（公开候选） | sp.spine.Color | cocos/spine/lib/spine-core.d.ts:1165 |
| MathUtils | 外部依赖（公开候选） | sp.spine.MathUtils | cocos/spine/lib/spine-core.d.ts:1184 |
| Interpolation | 外部依赖（公开候选） | sp.spine.Interpolation | cocos/spine/lib/spine-core.d.ts:1208 |
| Pow | 外部依赖（公开候选） | sp.spine.Pow | cocos/spine/lib/spine-core.d.ts:1212 |
| PowOut | 外部依赖（公开候选） | sp.spine.PowOut | cocos/spine/lib/spine-core.d.ts:1217 |
| Utils | 外部依赖（公开候选） | sp.spine.Utils | cocos/spine/lib/spine-core.d.ts:1221 |
| DebugUtils | 外部依赖（公开候选） | sp.spine.DebugUtils | cocos/spine/lib/spine-core.d.ts:1234 |
| Pool | 外部依赖（公开候选） | sp.spine.Pool | cocos/spine/lib/spine-core.d.ts:1237 |
| Vector2 | 外部依赖（公开候选） | sp.spine.Vector2 | cocos/spine/lib/spine-core.d.ts:1246 |
| TimeKeeper | 外部依赖（公开候选） | sp.spine.TimeKeeper | cocos/spine/lib/spine-core.d.ts:1254 |
| WindowedMean | 外部依赖（公开候选） | sp.spine.WindowedMean | cocos/spine/lib/spine-core.d.ts:1268 |
| VertexEffect | 外部依赖（公开候选） | sp.spine.VertexEffect | cocos/spine/lib/spine-core.d.ts:1279 |
| Attachment | 外部依赖（公开候选） | sp.spine.Attachment | cocos/spine/lib/spine-core.d.ts:1287 |
| VertexAttachment | 外部依赖（公开候选） | sp.spine.VertexAttachment | cocos/spine/lib/spine-core.d.ts:1292 |
| BoundingBoxAttachment | 外部依赖（公开候选） | sp.spine.BoundingBoxAttachment | cocos/spine/lib/spine-core.d.ts:1320 |
| ClippingAttachment | 外部依赖（公开候选） | sp.spine.ClippingAttachment | cocos/spine/lib/spine-core.d.ts:1324 |
| MeshAttachment | 外部依赖（公开候选） | sp.spine.MeshAttachment | cocos/spine/lib/spine-core.d.ts:1329 |
| PathAttachment | 外部依赖（公开候选） | sp.spine.PathAttachment | cocos/spine/lib/spine-core.d.ts:1347 |
| PointAttachment | 外部依赖（公开候选） | sp.spine.PointAttachment | cocos/spine/lib/spine-core.d.ts:1354 |
| RegionAttachment | 外部依赖（公开候选） | sp.spine.RegionAttachment | cocos/spine/lib/spine-core.d.ts:1363 |
| JitterEffect | 外部依赖（公开候选） | sp.spine.JitterEffect | cocos/spine/lib/spine-core.d.ts:1423 |
| SwirlEffect | 外部依赖（公开候选） | sp.spine.SwirlEffect | cocos/spine/lib/spine-core.d.ts:1431 |
| SkeletonSystem | 外部依赖（公开候选） | sp.spine.SkeletonSystem | cocos/spine/lib/spine-core.d.ts:1445 |
| SkeletonInstance | 外部依赖（公开候选） | sp.spine.SkeletonInstance | cocos/spine/lib/spine-core.d.ts:1452 |
| wasmUtil | 外部依赖（公开候选） | sp.spine.wasmUtil | cocos/spine/lib/spine-core.d.ts:1479 |
| DragonBones | 外部依赖（内部/仅类型） | dragonBones.DragonBones | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:261 |
| BaseObject | 外部依赖（公开候选） | dragonBones.BaseObject | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:291 |
| Matrix | 外部依赖（公开候选） | dragonBones.Matrix | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:380 |
| Transform | 外部依赖（公开候选） | dragonBones.Transform | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:552 |
| ColorTransform | 外部依赖（内部/仅类型） | dragonBones.ColorTransform | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:682 |
| Point | 外部依赖（公开候选） | dragonBones.Point | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:706 |
| Rectangle | 外部依赖（公开候选） | dragonBones.Rectangle | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:776 |
| UserData | 外部依赖（公开候选） | dragonBones.UserData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:853 |
| ActionData | 外部依赖（内部/仅类型） | dragonBones.ActionData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:945 |
| DragonBonesData | 外部依赖（公开候选） | dragonBones.DragonBonesData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:969 |
| ArmatureData | 外部依赖（公开候选） | dragonBones.ArmatureData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1123 |
| BoneData | 外部依赖（公开候选） | dragonBones.BoneData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1370 |
| SurfaceData | 外部依赖（内部/仅类型） | dragonBones.SurfaceData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1442 |
| SlotData | 外部依赖（公开候选） | dragonBones.SlotData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1462 |
| ConstraintData | 外部依赖（内部/仅类型） | dragonBones.ConstraintData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1526 |
| IKConstraintData | 外部依赖（内部/仅类型） | dragonBones.IKConstraintData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1538 |
| CanvasData | 外部依赖（内部/仅类型） | dragonBones.CanvasData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1550 |
| SkinData | 外部依赖（公开候选） | dragonBones.SkinData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1571 |
| DisplayData | 外部依赖（内部/仅类型） | dragonBones.DisplayData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1615 |
| ImageDisplayData | 外部依赖（内部/仅类型） | dragonBones.ImageDisplayData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1627 |
| ArmatureDisplayData | 外部依赖（内部/仅类型） | dragonBones.ArmatureDisplayData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1637 |
| MeshDisplayData | 外部依赖（内部/仅类型） | dragonBones.MeshDisplayData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1652 |
| BoundingBoxDisplayData | 外部依赖（内部/仅类型） | dragonBones.BoundingBoxDisplayData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1665 |
| WeightData | 外部依赖（内部/仅类型） | dragonBones.WeightData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1674 |
| GlueData | 外部依赖（内部/仅类型） | dragonBones.GlueData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1686 |
| BoundingBoxData | 外部依赖（公开候选） | dragonBones.BoundingBoxData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1710 |
| RectangleBoundingBoxData | 外部依赖（公开候选） | dragonBones.RectangleBoundingBoxData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1780 |
| EllipseBoundingBoxData | 外部依赖（公开候选） | dragonBones.EllipseBoundingBoxData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1832 |
| PolygonBoundingBoxData | 外部依赖（公开候选） | dragonBones.PolygonBoundingBoxData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1880 |
| AnimationData | 外部依赖（公开候选） | dragonBones.AnimationData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:1952 |
| TimelineData | 外部依赖（内部/仅类型） | dragonBones.TimelineData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:2141 |
| AnimationConfig | 外部依赖（公开候选） | dragonBones.AnimationConfig | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:2165 |
| TextureAtlasData | 外部依赖（公开候选） | dragonBones.TextureAtlasData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:2435 |
| TextureData | 外部依赖（内部/仅类型） | dragonBones.TextureData | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:2505 |
| Armature | 外部依赖（公开候选） | dragonBones.Armature | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:2607 |
| TransformObject | 外部依赖（公开候选） | dragonBones.TransformObject | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:3144 |
| Bone | 外部依赖（公开候选） | dragonBones.Bone | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:3297 |
| Surface | 外部依赖（内部/仅类型） | dragonBones.Surface | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:3498 |
| Slot | 外部依赖（公开候选） | dragonBones.Slot | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:3568 |
| Constraint | 外部依赖（内部/仅类型） | dragonBones.Constraint | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:4094 |
| IKConstraint | 外部依赖（内部/仅类型） | dragonBones.IKConstraint | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:4125 |
| WorldClock | 外部依赖（公开候选） | dragonBones.WorldClock | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:4213 |
| Animation | 外部依赖（公开候选） | dragonBones.Animation | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:4349 |
| AnimationState | 外部依赖（公开候选） | dragonBones.AnimationState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:4803 |
| BonePose | 外部依赖（内部/仅类型） | dragonBones.BonePose | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5235 |
| BlendState | 外部依赖（内部/仅类型） | dragonBones.BlendState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5246 |
| TimelineState | 外部依赖（内部/仅类型） | dragonBones.TimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5269 |
| TweenTimelineState | 外部依赖（内部/仅类型） | dragonBones.TweenTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5307 |
| BoneTimelineState | 外部依赖（内部/仅类型） | dragonBones.BoneTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5324 |
| SlotTimelineState | 外部依赖（内部/仅类型） | dragonBones.SlotTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5334 |
| ConstraintTimelineState | 外部依赖（内部/仅类型） | dragonBones.ConstraintTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5342 |
| ActionTimelineState | 外部依赖（内部/仅类型） | dragonBones.ActionTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5351 |
| ZOrderTimelineState | 外部依赖（内部/仅类型） | dragonBones.ZOrderTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5363 |
| BoneAllTimelineState | 外部依赖（内部/仅类型） | dragonBones.BoneAllTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5372 |
| BoneTranslateTimelineState | 外部依赖（内部/仅类型） | dragonBones.BoneTranslateTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5382 |
| BoneRotateTimelineState | 外部依赖（内部/仅类型） | dragonBones.BoneRotateTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5391 |
| BoneScaleTimelineState | 外部依赖（内部/仅类型） | dragonBones.BoneScaleTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5401 |
| SurfaceTimelineState | 外部依赖（内部/仅类型） | dragonBones.SurfaceTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5410 |
| SlotDislayTimelineState | 外部依赖（内部/仅类型） | dragonBones.SlotDislayTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5430 |
| SlotColorTimelineState | 外部依赖（内部/仅类型） | dragonBones.SlotColorTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5438 |
| SlotFFDTimelineState | 外部依赖（内部/仅类型） | dragonBones.SlotFFDTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5454 |
| IKConstraintTimelineState | 外部依赖（内部/仅类型） | dragonBones.IKConstraintTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5476 |
| AnimationTimelineState | 外部依赖（内部/仅类型） | dragonBones.AnimationTimelineState | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5488 |
| EventObject | 外部依赖（公开候选） | dragonBones.EventObject | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5509 |
| DataParser | 外部依赖（内部/仅类型） | dragonBones.DataParser | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5834 |
| ObjectDataParser | 外部依赖（内部/仅类型） | dragonBones.ObjectDataParser | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:5986 |
| ActionFrame | 外部依赖（内部/仅类型） | dragonBones.ActionFrame | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:6081 |
| BinaryDataParser | 外部依赖（内部/仅类型） | dragonBones.BinaryDataParser | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:6090 |
| BaseFactory | 外部依赖（公开候选） | dragonBones.BaseFactory | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:6143 |
| BuildArmaturePackage | 外部依赖（内部/仅类型） | dragonBones.BuildArmaturePackage | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:6655 |
| DeformVertices | 外部依赖（公开候选） | dragonBones.DeformVertices | node_modules/@cocos/dragonbones-js/out/dragonBones.d.ts:6663 |
| UserChoiceDetails | 外部依赖（公开候选） | google.billing.UserChoiceDetails | vendor/google/index.ts:67 |
| ProductDetails | 外部依赖（公开候选） | google.billing.ProductDetails | vendor/google/index.ts:223 |
| Purchase | 外部依赖（公开候选） | google.billing.Purchase | vendor/google/index.ts:351 |
| InAppMessageResult | 外部依赖（公开候选） | google.billing.InAppMessageResult | vendor/google/index.ts:481 |
| BillingResult | 外部依赖（公开候选） | google.billing.BillingResult | vendor/google/index.ts:519 |
| PendingPurchasesParams | 外部依赖（公开候选） | google.billing.PendingPurchasesParams | vendor/google/index.ts:612 |
| QueryProductDetailsParamsProduct | 外部依赖（公开候选） | google.billing.QueryProductDetailsParams.Product, google.billing.QueryProductDetailsParamsProduct | vendor/google/index.ts:621 |
| QueryProductDetailsParams | 外部依赖（公开候选） | google.billing.QueryProductDetailsParams | vendor/google/index.ts:671 |
| ProductDetailsParams | 外部依赖（公开候选） | google.billing.BillingFlowParams.ProductDetailsParams, google.billing.ProductDetailsParams | vendor/google/index.ts:1261 |
| SubscriptionUpdateParams | 外部依赖（公开候选） | google.billing.BillingFlowParams.SubscriptionUpdateParams, google.billing.SubscriptionUpdateParams | vendor/google/index.ts:1297 |
| BillingFlowParams | 外部依赖（公开候选） | google.billing.BillingFlowParams | vendor/google/index.ts:1336 |
| ConsumeParams | 外部依赖（公开候选） | google.billing.ConsumeParams | vendor/google/index.ts:1398 |
| AcknowledgePurchaseParams | 外部依赖（公开候选） | google.billing.AcknowledgePurchaseParams | vendor/google/index.ts:1421 |
| QueryPurchasesParams | 外部依赖（公开候选） | google.billing.QueryPurchasesParams | vendor/google/index.ts:1448 |
| InAppMessageParams | 外部依赖（公开候选） | google.billing.InAppMessageParams | vendor/google/index.ts:1482 |
| GetBillingConfigParams | 外部依赖（公开候选） | google.billing.GetBillingConfigParams | vendor/google/index.ts:1505 |
| BillingClient | 外部依赖（公开候选） | google.billing.BillingClient | vendor/google/index.ts:1524 |
| AuthenticationResult | 外部依赖（公开候选） | google.play.AuthenticationResult | vendor/google/index.ts:1635 |
| RecallAccess | 外部依赖（公开候选） | google.play.RecallAccess | vendor/google/index.ts:1647 |
| PlayException | 外部依赖（公开候选） | google.play.PlayException | vendor/google/index.ts:1665 |
| Achievement | 外部依赖（公开候选） | google.play.Achievement | vendor/google/index.ts:1691 |
| AchievementBuffer | 外部依赖（公开候选） | google.play.AchievementBuffer | vendor/google/index.ts:1790 |
| AnnotatedData | 外部依赖（公开候选） | google.play.AnnotatedData | vendor/google/index.ts:1816 |
| PlayGamesSdk | 外部依赖（公开候选） | google.play.PlayGamesSdk | vendor/google/index.ts:1832 |
| PlayGames | 外部依赖（公开候选） | google.play.PlayGames | vendor/google/index.ts:1843 |
| GamesSignInClient | 外部依赖（公开候选） | google.play.GamesSignInClient | vendor/google/index.ts:1864 |
| AchievementsClient | 外部依赖（公开候选） | google.play.AchievementsClient | vendor/google/index.ts:1885 |
| RecallClientHelper | 外部依赖（公开候选） | google.play.RecallClientHelper | vendor/google/index.ts:1942 |

## 目标薄壳规则与迁移建议

1. 仅对确认需要公开的 Asset、Node、Component 及其子类建立对应 `XXX.jsb.ts`；有 C++ 实现时直接导出绑定类型，适配原型、幂等 `_ctor` 和序列化元数据，不创建第二个 Native 实例。
2. 上述范围内仍为 TS 实现的引擎类可在过渡薄壳中显式复用 TS 实现；用户脚本统一通过 Component/ScriptComponent 桥接，不为每个用户类生成引擎薄壳。
3. 优先 Node/Scene/Component、2D 渲染组件和依赖的 Asset 子类；布局与交互组件属于扩展范围。数学、几何、事件、管理器、gfx 等不要求独立薄壳。
4. Component 体系遵循 [生命周期设计](native-component-lifecycle-design.md)：Native 组件直接继承 C++ Component，脚本类对应 ScriptComponent，Node 持有统一数组；Native 组件脚本不可继承。其他公开类是否可脚本继承需按该类型契约单独定义。
5. gfx、renderer、rendering、sp、dragonBones 等现有聚合绑定可以保留；只有其中属于 Asset/Node/Component 体系的目标公开类需要逐类薄壳适配。不要因为缺少同源文件就认定没有 Native 绑定。
6. 继续审计 legacyCC 动态 API、工厂返回对象及公开实例属性中的类型，再结合生成声明/API 文档进行人工确认。检查 Native 替换目标存在、特性条件、导出身份、序列化、生命周期和 GC，才能将候选标记为完成。

此盘点仅新增审计脚本与文档，不自动生成薄壳或修改引擎实现。
