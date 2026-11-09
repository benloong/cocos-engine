# Native 2D M2 进展记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M2。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：M2 基础设施 + Sprite SIMPLE 薄壳候选已完成；override 尚未启用，材质和其余模式未开始。

## 1. 本轮完成：native UIRenderer 基座

新增 `native/cocos/2d/framework/UIRenderer.h/.cpp`：

- 继承 `Component`，进入 native Node 的 UI 组件槽位；
- `TYPE_ID = 3`；
- 持有 color、material、priority、src/dst blend factor；
- 提供 `setColor/setColorRGBA/getColor`、`setMaterial/getMaterial`、
  `getRenderMaterial`（自定义 material 优先，否则 `ui-sprite-material`）、
  `setPriority/getPriority`、blend factor accessor；
- 不包含几何、文本、材质实例解析或逐帧逻辑。

`Sprite` 改为：

```cpp
class Sprite final : public UIRenderer, public RenderEntity::IPrepareListener
```

- `TYPE_ID = 4`；
- 复用 UIRenderer 的 color/material/priority；
- 继续持有 frame、RenderEntity 和 SIMPLE 几何；
- 通过 `Component::setNode` 注册到 Node UI 槽位；
- `prepare()` 仍由 `RenderEntity::IPrepareListener` 驱动。

## 2. 绑定与构建

- `native/CMakeLists.txt` 登记 `UIRenderer.h/.cpp`；
- `native/tools/swig-config/2d.i` 在 `Sprite.h` 前 include/`%include`
  `UIRenderer.h`；
- 生成绑定包含 `cc::UIRenderer` 与 `__jsb_cc_UIRenderer_proto`；
- Debug clean rebuild 605/605 targets。

## 3. 本轮完成：Sprite SIMPLE 薄壳候选

新增 `cocos/2d/components/sprite.jsb.ts`（168 行有效代码）：

- `@ccclass('cc.Sprite')` 和序列化字段；
- `onLoad` 创建 `n2d.Sprite`、`setNode`、绑定 native UITransform；
- `spriteFrame` 将 texture/rect/originalSize/offset/rotated 批量转发到
  native `setFrame`；
- `color`/`priority`/`enabled` 转发；
- `type`/`fillType`/`sizeMode` 保留序列化字段，但当前只声明 SIMPLE 路径；
- 不包含几何、assembler 或材质实例逻辑。

当前 **未启用**：`native/tests/2d-poc/m2-components.json` 中
`sprite.enabled = false`，`cc.config.json` 没有 Sprite override。

曾在 Creator 测试工程中临时启用验证：native bundle 包含 `new n2d.Sprite()`，
`spriteFrame = builtinResMgr.get('default-spriteframe')` 后：

- 原生 `Sprite::setNode`/`setFrame` 被调用；
- 重新编译含 UIRenderer 的 native exe 后，`Batcher2d::walk` 到达
  `M1TestNode`，并且实际执行到 `callPrepare`；`RenderEntity` enabled、
  opacity 0.501961、listener 非空；
- 换成 16×16 的 `default-texture` SpriteFrame 后 `setFrame rect 0 0 16 16`；
- native Sprite shader 编译成功；
- `Sprite::prepare` 确认生成 drawInfo：`vb=4, ib=6`，material/texture
  指针均非空；
- `Batcher2d::fillBuffersAndMergeBatches` 结束时 `Batcher2d::batches 2`，
  说明 Sprite batch 已生成并加入 RenderScene（另一条为 profiler）；
- `M1_SPRITE_FRAME {"hasFrame":true}`。

但窗口截图/PrintWindow 仍是黑屏或桌面内容，无法确认可见像素；因此本报告
不把“可见渲染/像素对照”计为通过。下一步需要检查 RenderScene 消费 batch 的
路径、camera/pipeline 过滤，并搭建可靠的 native 截图 harness。

### 验证

新增 Jest：

```text
PASS tests/ui/native-2d-m2-sprite-shell.test.ts
  √ Sprite M2 shell attaches and forwards SIMPLE frame data
```

覆盖：native 构造/Node 绑定、color 转发、frame 全字段转发、disable/destroy。

## 4. 验证

```
native 2D PoC: PASS
39 checks, 0 failures      # pure C++ math/geometry
18 checks, 0 failures      # M1 shell contract
Jest: 1 passed             # Sprite M2 shell mock
```

新增 C++ 断言：

- `Sprite::getTypeId() == Sprite::TYPE_ID`；
- 继承的 `setColorRGBA/getColor`；
- 继承的 `setPriority/getPriority`。

原生 1000 Sprite 场景仍通过，未观察到 UIRenderer 继承导致的 ABI/生命周期问题。

## 5. 尚未完成

1. Sprite override 尚未在 Creator 场景中启用和做像素对照；
2. native UIRenderer 的材质解析：
   `getSharedMaterial/setSharedMaterial`、material instance、ui-sprite 系列；
3. Sprite 的 sliced/tiled/filled/radial 模式；
4. SpriteFrame 的 native 缓存（rect/offset/rotated/insets）；
5. TS `UIRenderer` 继承链的最终决策（extends Renderer vs extends Component）。

## 6. 下一步

在 Creator 测试工程中给 Sprite 绑定真实 SpriteFrame，启用
`sprite.jsb.ts` override，验证 SIMPLE 渲染和像素对照；通过后再做材质解析和
其余四种模式。
