# Native 2D M2 进展记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M2。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：M2 基础设施已开始；UIRenderer/Sprite 原生基座已合入，JS 薄壳和五种模式尚未开始。

## 1. 本轮完成：native UIRenderer 基座

新增 `native/cocos/2d/framework/UIRenderer.h/.cpp`：

- 继承 `Component`，进入 native Node 的 UI 组件槽位；
- `TYPE_ID = 3`；
- 持有 color、material、priority、src/dst blend factor；
- 提供 `setColor/setColorRGBA/getColor`、`setMaterial/getMaterial`、
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

## 3. 验证

```
native 2D PoC: PASS
39 checks, 0 failures      # pure C++ math/geometry
18 checks, 0 failures      # M1 shell contract
```

新增断言：

- `Sprite::getTypeId() == Sprite::TYPE_ID`；
- 继承的 `setColorRGBA/getColor`；
- 继承的 `setPriority/getPriority`。

原生 1000 Sprite 场景仍通过，未观察到 UIRenderer 继承导致的 ABI/生命周期问题。

## 4. 尚未完成

1. `cocos/2d/components/sprite.jsb.ts` 薄壳与 NATIVE override；
2. native UIRenderer 的材质解析：
   `getSharedMaterial/setSharedMaterial`、material instance、ui-sprite 系列；
3. Sprite 的 sliced/tiled/filled/radial 模式；
4. SpriteFrame 的 native 缓存（rect/offset/rotated/insets）；
5. 真实 Creator 场景中的 native Sprite shell 与像素对照；
6. TS `UIRenderer` 继承链的最终决策（extends Renderer vs extends Component）。

## 5. 下一步

先做 `sprite.jsb.ts` 的最小 SIMPLE 路径：

- `onLoad` 创建 `n2d.Sprite`、`setNode`、绑定 UITransform；
- `spriteFrame` setter 转发 texture/rect/originalSize/offset/rotated；
- `color`/`material`/`priority` 转发；
- 先在 Creator 场景中验证 SIMPLE Sprite 能显示，再扩展模式。
