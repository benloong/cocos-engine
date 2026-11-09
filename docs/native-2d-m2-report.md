# Native 2D M2 进展记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M2。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：M2 基础设施、Sprite SIMPLE 薄壳候选、SpriteFrame native 缓存已完成；override 未启用，可见渲染/像素对照和其余模式未完成。

## 1. native UIRenderer 基座

新增 `native/cocos/2d/framework/UIRenderer.h/.cpp`：

- 继承 `Component`，进入 native Node 的 UI 组件槽位；
- `TYPE_ID = 3`；
- color、material、priority、src/dst blend factor；
- `setColor/setColorRGBA/getColor`；
- `setMaterial/getMaterial/getRenderMaterial`（显式 material 优先，否则
  `ui-sprite-material`）；
- `setSharedMaterial/getSharedMaterial`（按 index 保存材质数组）；
- `setPriority/getPriority`。

`Sprite` 改为：

```cpp
class Sprite final : public UIRenderer, public RenderEntity::IPrepareListener
```

- `TYPE_ID = 4`；
- 复用 UIRenderer 的 color/material/priority；
- 继续持有 frame、RenderEntity 和 SIMPLE 几何；
- 通过 `Component::setNode` 注册到 Node UI 槽位。

## 2. 绑定与构建

- `native/CMakeLists.txt` 登记 `UIRenderer.h/.cpp`、`SpriteFrame.h`；
- `native/tools/swig-config/2d.i` 在 `Sprite.h` 前 include/`%include`
  `UIRenderer.h`、`SpriteFrame.h`；
- 生成绑定包含 `cc::UIRenderer`、`cc::SpriteFrame`；
- V8 冒烟：`new n2d.UIRenderer()`、`new n2d.SpriteFrame()` 及 setter 通过；
- Debug clean rebuild 605/605（M2 基座阶段）。

## 3. SpriteFrame native 缓存

新增 `native/cocos/2d/assets/SpriteFrame.h`：

- texture / rect / originalSize / offset / rotated / 九宫格 insets 字段；
- `Sprite::setFrame(SpriteFrame*)` 重载，一次 JSB 调用复制全部字段；
- texture 尺寸从 `TextureBase::getWidth/getHeight` 获取；
- JS 壳构造 `n2d.SpriteFrame` 后调用单参数 `setFrame`。

## 4. Sprite SIMPLE 薄壳

`cocos/2d/components/sprite.jsb.ts`（约 182 行有效代码）：

- `@ccclass('cc.Sprite')` 和序列化字段；
- `onLoad` 创建 `n2d.Sprite`、`setNode`、绑定 native UITransform；
- `spriteFrame` 构造 native SpriteFrame 并转发；
- `color`/`priority`/`enabled` 转发；
- `customMaterial` 转发到 native `setMaterial`；
- `type`/`fillType`/`sizeMode` 保留序列化字段，但当前只声明 SIMPLE 路径；
- 不包含几何、assembler 或材质实例逻辑。

当前 **未启用**：`native/tests/2d-poc/m2-components.json` 中
`sprite.enabled = false`，`cc.config.json` 没有 Sprite override。

## 4.1 Sliced 几何（builder 阶段）

`SpriteGeometry` 新增：

- `SpriteMesh { vertices, indices, valid }`；
- `SlicedSpriteGeometryParams`（contentSize/anchor/frameRect/textureSize/insets）；
- `buildSlicedSpriteMesh()`：4×4 顶点网格、9 个 quad、54 个索引；
- insets 会 clamp 到 contentSize，避免反向 quad；
- `transformSpriteMesh()` 支持世界矩阵。

纯 C++ 测试新增 `testSlicedMesh`：

```text
54 checks, 0 failures
```

`Sprite::prepare` 已接入 `_type == 1`（SLICED）分支：使用
`buildSlicedSpriteMesh`、`transformSpriteMesh`，并生成 16 顶点/54 索引的
drawInfo。`sprite.jsb.ts` 的 `type` setter 转发到 native `setType`。

C++ 测试覆盖 SLICED drawInfo 顶点/索引数。

尚未接入 Tiled/Filled/Radial。

## 5. 真实 Creator 探测

临时启用 override 后确认：

- native bundle 包含 `new n2d.Sprite()`；
- `Sprite::setNode`/`setFrame` 被调用；
- 换用 16×16 `default-texture` SpriteFrame 后 `setFrame rect 0 0 16 16`；
- 用真实 `assets/resources/M2Sprite.png`（64×64 红色贴图）加载
  `resources.load('M2Sprite/spriteFrame')` 成功，`M1_SPRITE_TEXTURE
  {"hasFrame":true}`；
- `Batcher2d::walk` 到达 `M1TestNode` 并执行到 `callPrepare`；
- `RenderEntity` enabled、opacity 0.501961、listener 非空；
- `Sprite::prepare` 生成 drawInfo：`vb=4, ib=6`，material/texture 非空；
- `Batcher2d::fillBuffersAndMergeBatches` 结束时 `Batcher2d::batches 2`
  （Sprite + profiler）；
- 项目 custom pipeline 实际进入 `NativeExecutor::draw2D`；
- `submitUICommands` 收到 `batches=2`、`phase=1`、cameraVis=1108344832，
  两个 batch 的 `vis=33554432` 均通过 camera 过滤；
- batch pass phase=1，与 phaseLayoutID=1 匹配，最终执行到 `cmdBuff->draw`；
- native sprite shader 编译成功；
- `M1_SPRITE_FRAME {"hasFrame":true}`。

因此 native 侧的 Sprite batch 已经完成提交；当前无法确认可见像素是
截图 harness 的问题，而不是渲染链缺失。验证后 Sprite override 保持
disabled，等待可靠像素对照。

## 6. 验证

```
native 2D PoC: PASS
jsb bindings result: OK
39 checks, 0 failures      # 旧 pure C++ 基线
54 checks, 0 failures      # 含 sliced mesh
18 checks, 0 failures      # M1 shell contract
Jest: 1 passed             # Sprite M2 shell mock
```

C++ 断言：

- `Sprite::getTypeId() == Sprite::TYPE_ID`；
- 继承的 `setColorRGBA/getColor`；
- 继承的 `setPriority/getPriority`；
- `getRenderMaterial() == 显式 material`；
- `getSharedMaterial(0/1)` 分别返回主材质和第二个 shared material。

Jest 覆盖：native 构造/Node 绑定、color、customMaterial、SpriteFrame 字段
（含 insets）、frame 转发、disable/destroy。

## 7. 尚未完成

1. 可靠的 native 截图与 Web/native 像素对照；
2. UIRenderer shared material/material instance 解析；
3. Sprite Tiled/Filled/Radial 模式；
4. SpriteFrame insets/native 资产化；
5. TS UIRenderer 继承链最终决策。

## 8. 下一步

native Sprite 已经走通 drawInfo → batch → custom pipeline `draw2D` →
`submitUICommands` → draw。下一步集中解决可靠截图/像素对照，再在此基础上
补 shared material、其余 Sprite 模式和默认启用决策。
