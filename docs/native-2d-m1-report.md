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

## 3. M1 剩余工作

1. 单槽位 `Component` 已接入；后续把单槽扩展为多组件槽位（`UITransform` + `UIOpacity` 并存）或按类型细分槽位。
2. 生产 `UITransform` 的 `.jsb.ts` 替换：
   - 保留序列化字段与编辑器元数据；
   - setter 在 attach 前缓存、attach 后 flush；
   - contentSize/anchor/boundingBox/convert/hitTest 走 native。
3. `UIOpacity` 与 Node opacity 联动。
4. 绑定/shim/override 模板化脚本与特性开关（按组件回退 JS）。
5. 场景加载/预制体回归。

## 4. 下一步

用现有 `UITransform` + `Component` 槽位做第一条 attach/detach + 序列化回归链路；暂不替换生产 `cc.UITransform`，先用独立 `n2d.M1UITransform` 验证挂载协议和多组件槽位。
