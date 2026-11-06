# Native 2D M1 进展记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M1。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：进行中。

## 1. 本轮完成：RenderEntity prepare owner

M0 的 prepare 回调使用 `std::function<void(float)>`，会让每个 `RenderEntity` 携带函数对象。M1 首步改为轻量 typed owner：

- `RenderEntity` 新增 `IPrepareListener`：
  - 纯虚 `prepareRenderEntity(float opacity)`；
  - `RenderEntity` 只保存裸指针 `IPrepareListener*`；
  - `prepare()` 为空时 no-op，JS entity 行为不变。
- `Sprite` 直接实现 `RenderEntity::IPrepareListener`：
  - 构造时 `setPrepareListener(this)`；
  - 析构时 `setPrepareListener(nullptr)`；
  - `Batcher2d::walk()` 仍然调用 `entity->prepare(finalOpacity)`。
- `native/tools/swig-config/2d.i` 同步忽略 `setPrepareListener` / `prepare` / `IPrepareListener`。

### 验证

- Debug clean rebuild：602/602 targets，`native 2D PoC: PASS`；
- Release clean rebuild：603/603 targets，`native 2D PoC: PASS`；
- `run-m0-checks.ps1`：C++ 39/39、PNG 7/7、视觉 10/10、薄壳 12/12、quad parity 10/10、Jest 14/14；
- 1000 Sprite：Debug 约 971 ns/sprite；Release 216.7 ns/sprite（216.7 µs/1000）；
- 原生 working set：Release 约 5341 bytes/sprite。

> 注意：修改 `RenderEntity` / `Sprite` 头文件后，增量构建可能留下旧 ABI 对象；本轮通过 clean rebuild 修复了链接/运行时的析构符号不一致。

## 2. 本轮完成：轻量 Component 与 Node 槽位

- 新增 `native/cocos/core/component/Component.h/.cpp`：
  - `Node*` 弱引用、`enabled`、`getTypeId()`；
  - `setNode` 负责 attach/detach，调用 `onAttach/onDetach/onEnable/onDisable`；
  - 不引入 registry、scheduler、serialization。
- `Node` 新增非 owning 的 `Component *_uiComponent` 槽位与 `getUIComponent/setUIComponent`：
  - `Node` 析构时调用 `component->onNodeDestroyed()`，清空组件的 Node 指针；
  - 组件析构时清空 Node 槽位，避免悬空。
- `UITransform` 改为继承 `Component`，不再自带 `_node`；构造时 attach。
- `scene.i` 忽略 `Node::getUIComponent/setUIComponent`，避免生成无法转换的 `Component*` 绑定；
- `2d.i` 包含并绑定 `Component`，使 `UITransform` 的基类在 JSB 中可用。

### 验证

- `UITransform` attach/detach：`node.getUIComponent() == &transform`、析构后槽位为空；
- Node 先销毁时组件 `getNode() == nullptr`；
- JSB 仍可 `new n2d.UITransform()` 并通过；
- Debug 原生测试：`native 2D PoC: PASS`；
- `run-m0-checks.ps1` 全部通过。

## 3. 本轮完成：多组件槽位与 UIOpacity

- `Node` 的单 `Component*` 槽改为非 owning 的 `ccstd::vector<Component*>`：
  - `addUIComponent/removeUIComponent`；
  - `getUIComponent(typeId)` 按类型查找，`getUIComponent()` 返回第一个；
  - Node 析构时对所有组件调用 `onNodeDestroyed()`。
- `Component` 的 attach/detach 改为 add/remove 槽位，支持 `UITransform` 与 `UIOpacity` 并存。
- `UITransform::getBoundingBoxToWorld` 加入 active 子节点的并集（仅自包围盒，不递归子节点），与 Web 的直接子节点语义一致；零尺寸子节点跳过。
- 新增 `native/cocos/2d/framework/UIOpacity.h/.cpp`：
  - `TYPE_ID = 2`，0~255 opacity；
  - attach/onEnable 写入 `Node::_localOpacity`；
  - disable/detach 重置为 1；
  - 不包含序列化/registry。
- 绑定：
  - `2d.i` 生成 `UIOpacity`，并在生成头文件里显式 include；
  - JSB 测试新增 `new n2d.UIOpacity()` + `setOpacity(128)` + `getOpacity()`。

### 验证

- 多槽位：`getUIComponent(UITransform::TYPE_ID)` 与 `getUIComponent(UIOpacity::TYPE_ID)` 同时命中；
- 子节点包围盒：父 100×100 @0、子 50×50 @(100,0)，world bbox 为 `(-50,-50,175,100)`；
- opacity：128 → `Node::_localOpacity = 128/255`，disable → 1，enable → 128/255；
- JSB：`jsb bindings result: OK`（含 UIOpacity）；
- Debug clean rebuild：604/604，`native 2D PoC: PASS`；
- Release clean rebuild：604/604，`native 2D PoC: PASS`；
- 1000 Sprite：Debug 约 987 ns/sprite；Release 218.4 ns/sprite；
- 原生 working set：Release 约 5267 bytes/sprite；
- `run-m0-checks.ps1` 全部通过。

## 4. 本轮完成：生产 UIOpacity `.jsb.ts` 替换

- 新增 `cocos/2d/components/ui-opacity.jsb.ts`：
  - 保留 `@ccclass('cc.UIOpacity')`、`@serializable _opacity`、执行顺序/菜单/编辑器元数据；
  - `onLoad` 创建 `new n2d.UIOpacity(this.node)`，并 flush 序列化后的 opacity；
  - `opacity` setter 同步 `n2d.UIOpacity.setOpacity`；
  - `onEnable/onDisable` 转发 `setActive`；
  - `onDestroy` 调 `detach`。
- `cc.config.json` 的 NATIVE override 增加：
  `cocos/2d/components/ui-opacity.ts → ui-opacity.jsb.ts`。
- 原生 `UIOpacity` 增加 `setActive/detach` 绑定，JSB 测试覆盖。

### 验证

- `tsc --noEmit` 通过（含 `.jsb.ts`）；
- JSB：`new n2d.UIOpacity()`、`setOpacity/getOpacity`、`setActive/detach` → `jsb bindings result: OK`；
- 原生 Debug：`native 2D PoC: PASS`；
- 薄壳：86 行（48 代码行），无 geometry/assembler/update。

> 尚未做原生 JS 运行时场景加载，因此“生产 shell 的 onLoad attach”尚未在完整引擎 JS 环境中执行；目前覆盖 Web 类型检查、JSB 类级调用和原生 C++ 生命周期。

## 5. 本轮完成：UITransform 标量绑定桥

为生产 `UITransform` 壳准备不依赖 `Vec2` 绑定的 native 标量 API：

- 包围盒：`getBoundingBoxX/Y/Width/Height`、`getBoundingBoxToWorldX/Y/Width/Height`；
- 坐标转换：`convertToNodeSpaceARX/Y`、`convertToWorldSpaceARX/Y`；
- 命中：`containsWorldPointXY`；
- detach：`detach()`。

JSB 运行时已验证：

- `setContentSizeXY(100,50)` + anchor 0.5 → bbox `(-50,-25,100,50)`；
- `convertToWorldSpaceARX/Y(3,4)` → `(3,4)`（无 Node 的 identity 情况）；
- `containsWorldPointXY` 为 false；
- `jsb.Mat4` identity 传入 `getBoundingBoxToX/Width` → `-50/100`；
- `jsb bindings result: OK`。

这些方法让后续 `ui-transform.jsb.ts` 不需要 Vec2 返回值即可驱动 bbox/convert。

## 6. 本轮完成：UITransform 候选壳（未启用）

新增 `cocos/2d/framework/ui-transform.jsb.ts`：

- 保留 `@ccclass('cc.UITransform')`、`@serializable _contentSize/_anchorPoint`、优先级、菜单元数据；
- `onLoad` 创建 `new n2d.UITransform(this.node)` 并 flush 尺寸/anchor/priority；
- contentSize/anchor/priority setter 走 native 标量 API；
- 包围盒/转换走 native 标量桥；
- native `getBoundingBoxTo(Mat4)` 已实现并测试（target-space 逆矩阵 + 直接子节点 + 自身）；
- Mat4 参数已通过 SWIG 绑定，壳的 `getBoundingBoxTo(targetMat)` 走 native 四个标量 getter；
- `hitTest` 走 native `UITransform::hitTestXY`（相机 `screenToWorld` + 可见性 + 节点空间命中）；
- `detach` 在 onDestroy；
- 198 代码行（271 行含 license）。

**尚未启用 `cc.config.json` override**：`getBoundingBoxTo` 的 Mat4 桥已打通，但完整原生 JS 场景回归仍未跑；`isHit` 是 deprecated UI 空间 API，壳现在明确返回 false，避免把 UI 点误当世界点。`hitTestXY`（screen 空间）已实现并在无场景时验证返回 false。

## 7. 本轮完成：UITransform Web 期望值对照

把 `tests/ui/ui-transform.test.ts` 的关键期望值搬到原生回归：

- 180×180、anchor 0.5 → bbox `(-90,-90,180,180)`；
- anchor 0.1/0.6 → bbox `(-18,-108,180,180)`；
- position 100.5/-10.5 → bbox `(82.5,-118.5,180,180)`；
- rotation 45° → bbox 约 `(36.86,-99.6,254.56,254.56)`；
- `getBoundingBoxToWorld` 父子场景（父 180×180 anchor 0.1/0.6，子 300×150@(50,58)）→ `(-50,-58,300,241)`；
- 父节点旋转 45° → 约 `(-114.76,-39.1,355.67,324.56)`；
- `getBoundingBoxTo` target 旋转 60°、位置 (100.5,-10.5) → 约 `(-109.46,23.98,136.6,136.6)`。

原生 Debug/Release 输出：`native 2D PoC: PASS`。

这验证了 native contentSize/anchor/SRT、父子世界包围盒和 target-space 旋转与 Web 测试期望一致。

## 8. 本轮完成：原生 JS 场景 attach 冒烟

在原生 smoke test 中注册 `register_all_engine` / `register_all_scene` / `register_all_native2d`，然后直接执行 JS：

- `new jsb.Node('jsb-node')`；
- `new n2d.UITransform(node)` → attach，`getWidth` 为默认 100；
- `new jsb.Scene('jsb-scene')` + `scene.addChild(node)`；
- 场景节点上 `setPositionJS(10,20,0)`，再 `new n2d.UITransform(sceneNode)` + `setContentSizeXY(100,50)`；
  bbox 为 `(-40,-5,100,50)`，验证位置进入 native 世界矩阵；
- 同一节点上再 `new n2d.UIOpacity(sceneNode)`，验证多组件槽位；
- 所有 native 组件 `detach()`。

JSB 输出：`jsb bindings result: OK`，原生 `native 2D PoC: PASS`。

这证明 **原生 JS 运行时可以创建 Scene/Node、设置位置并挂载 native UITransform/UIOpacity**，而不是只验证类级构造。仍未覆盖：场景资产反序列化、TS 薄壳在真实引擎 JS bundle 中的 onLoad。`Node.setPosition` 本身仍被 scene.i 忽略（供 TS Node 层使用），测试通过新增的 `setPositionJS` 绑定完成。

## 9. 本轮完成：薄壳生命周期 mock 测试

新增 `tests/ui/native-2d-m1-shell.test.ts`，用 mock 的 `n2d` 验证两个生产壳：

- `UITransform.onLoad` 以 node 构造 native 并 flush 100×100；
- contentSize/anchor setter 转发 `setContentSizeXY` / `setAnchorPointXY`；
- bbox / `getBoundingBoxTo(Mat4)` / `convertToWorldSpaceAR` 转发；
- `hitTest` 转发 `hitTestXY`；
- `onDestroy` 转发 `detach`；
- `UIOpacity.onLoad/set opacity/onEnable/onDisable/onDestroy` 转发各自 native API。

Jest：2 passed。这补上了“壳在 JS 侧的生命周期/转发”验证，仍不等价于真实引擎 JS bundle 中的场景反序列化。

## 10. 本轮完成：原生 JS 场景 record 加载

在原生 V8 中执行一段“最小场景加载器”：

- 输入 JSON record（root：position 10/20、size 100×50、anchor 0.5、opacity 128，child：position 50/0、size 20×20）；
- 递归创建 `jsb.Node`、`n2d.UITransform`、`n2d.UIOpacity`；
- `setPositionJS` 写入位置，组件 attach；
- 校验 root world bbox `(-40,-5,110,50)`、opacity 128、child width 20。

输出：

```
jsb bindings result: OK
jsb scene record: OK
native 2D PoC: PASS
```

这不是引擎的 `deserialize()`/预制体实现，而是 native JS 运行时对场景 record 的最小加载回归，覆盖了 record → Node/组件 attach → bbox/opacity 的链路。

## 11. M1 剩余工作

1. 启用 `ui-transform.jsb.ts` override 前的收尾：`isHit` UI 空间语义、完整引擎 JS bundle 中的 onLoad、场景资产反序列化。
2. 补齐原生 JSB 缺口（`setPositionJS` 已加；其余 Node/场景 API）和预制体 regression。
3. 绑定/shim/override 模板化脚本与特性开关（按组件回退 JS）。

## 12. 下一步

先用真实引擎 JS bundle/场景资产跑一次 `UITransform` 壳的 onLoad + 场景反序列化回归；同时修 `isHit` 或明确 deprecated 回退。通过后再打开 `cc.config.json` 的 `ui-transform.ts → ui-transform.jsb.ts` override。
