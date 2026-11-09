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

- texture / rect / originalSize / offset / rotated 字段；
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

## 5. 真实 Creator 探测

临时启用 override 后确认：

- native bundle 包含 `new n2d.Sprite()`；
- `Sprite::setNode`/`setFrame` 被调用；
- 换用 16×16 `default-texture` SpriteFrame 后 `setFrame rect 0 0 16 16`；
- `Batcher2d::walk` 到达 `M1TestNode` 并执行到 `callPrepare`；
- `RenderEntity` enabled、opacity 0.501961、listener 非空；
- `Sprite::prepare` 生成 drawInfo：`vb=4, ib=6`，material/texture 非空；
- `Batcher2d::fillBuffersAndMergeBatches` 结束时 `Batcher2d::batches 2`
  （Sprite + profiler）；
- native sprite shader 编译成功；
- `M1_SPRITE_FRAME {"hasFrame":true}`。

但窗口截图/PrintWindow 仍无法可靠捕获 GPU 内容，因此 **可见渲染和 Web/native
像素对照仍未通过**；验证后 Sprite override 保持 disabled。

## 6. 验证

```
native 2D PoC: PASS
jsb bindings result: OK
39 checks, 0 failures      # pure C++ math/geometry
18 checks, 0 failures      # M1 shell contract
Jest: 1 passed             # Sprite M2 shell mock
```

C++ 断言：

- `Sprite::getTypeId() == Sprite::TYPE_ID`；
- 继承的 `setColorRGBA/getColor`；
- 继承的 `setPriority/getPriority`；
- `getRenderMaterial() == 显式 material`。

Jest 覆盖：native 构造/Node 绑定、color、customMaterial、SpriteFrame 字段、
frame 转发、disable/destroy。

## 7. 尚未完成

1. 可见渲染与可靠 native 截图/像素对照；
2. RenderScene/camera/pipeline 对 batch 的最终消费验证；
3. UIRenderer shared material/material instance 解析；
4. Sprite sliced/tiled/filled/radial 模式；
5. SpriteFrame insets/native 资产化；
6. TS UIRenderer 继承链最终决策。

## 8. 下一步

在可靠的 native 截图 harness 下验证 SIMPLE 可见渲染；然后补 shared
material、其余 Sprite 模式，并决定是否默认启用 Sprite override。
