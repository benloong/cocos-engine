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
- Release clean rebuild：602/602 targets，`native 2D PoC: PASS`；
- `run-m0-checks.ps1`：C++ 39/39、PNG 7/7、视觉 10/10、薄壳 12/12、quad parity 10/10、Jest 14/14；
- 1000 Sprite：Debug 约 970 ns/sprite；Release 224.8 ns/sprite（224.8 µs/1000）；
- 原生 working set：Release 约 5317 bytes/sprite。

> 注意：修改 `RenderEntity` / `Sprite` 头文件后，增量构建可能留下旧 ABI 对象；本轮通过 clean rebuild 修复了链接/运行时的析构符号不一致。

## 2. M1 剩余工作

1. 轻量 native `Component` 基类（Node 指针、enabled、类型 id、attach/detach/onEnable/onDisable，不引入 registry/serializer）。
2. Node 上的 UI 组件槽位（`UITransform`、`UIOpacity` 等非渲染组件查找）。
3. 生产 `UITransform` 的 `.jsb.ts` 替换：
   - 保留序列化字段与编辑器元数据；
   - setter 在 attach 前缓存、attach 后 flush；
   - contentSize/anchor/boundingBox/convert/hitTest 走 native。
4. `UIOpacity` 与 Node opacity 联动。
5. 绑定/shim/override 模板化脚本与特性开关（按组件回退 JS）。
6. 场景加载/预制体回归。

## 3. 下一步

先实现 `Component` 轻量基类与 Node 组件槽位，再用 `UITransform` 做第一条 attach/detach + 序列化回归链路；暂不替换生产 `cc.UITransform`，先用独立 `n2d.M1UITransform` 验证挂载协议。
