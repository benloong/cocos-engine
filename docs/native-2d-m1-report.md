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

## 5. M1 剩余工作

1. 生产 `UITransform` 的 `.jsb.ts` 替换：
   - 保留序列化字段与编辑器元数据；
   - setter 在 attach 前缓存、attach 后 flush；
   - contentSize/anchor/boundingBox/convert/hitTest 走 native。
2. 绑定/shim/override 模板化脚本与特性开关（按组件回退 JS）。
3. 场景加载/预制体回归。

## 6. 下一步

以 `UIOpacity` 壳为模板做 `UITransform` 生产壳：先保留 `cc.UITransform` 的序列化字段，在 `onLoad` attach native，内容尺寸/anchor/包围盒/转换/hitTest 走 native；随后补 Web 对照用例和特性开关。
