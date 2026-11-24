# M6 Graphics 加载前绘制的材质所有权

2026-11-24，基于 `78b3c7e4a1`。修复 Graphics 在 `onLoad` 前绘制时丢失预设材质槽的问题。首次绘制创建 Native 后端，旧代码此时未绑定 JS 已保存的材质；后续材质读取从 Native 同步默认值，覆盖尚未绑定的槽位。

## 修复

在 `_ensureNative()` 创建后端时立即调用现有材质槽绑定桥接。`onLoad()` 继续使用该后端，并只同步已经存在的槽位，不再次设置材质或重建加载前取得的实例。材质选择和实际槽位仍由 Native 管理；没有增加 JS 渲染算法或另一份材质权威状态。

## 验证

未修复的 Release 真实 JSB 探针在 `pre-load Graphics drawing retains staged native material slots` 断言失败，进程退出码 1。

修复后 Windows Debug、Release 的实际 JSB 探针与完整 Native 测试均通过，退出码 0。探针使用序列化 `_materials` 暂存字段，检查首次绘制后的两个原生材质槽、实例 parent/owner、`onLoad` 前后实例身份，以及实际 Native DrawInfo 的 `material` 与该实例相同。恢复内置材质后检查旧实例 owner 已解除，并继续执行原有几何提交与描边断言。

```text
jsb shell integration: OK
jsb scene record: OK
native 2D PoC: PASS
```

Graphics 与 Mask 的两个 Native 薄壳套件共 13 项通过。新增两项用公开 `sharedMaterials` 入口覆盖普通材质与自定义材质，检查绑定只发生一次、预加载实例在 onLoad 后保留、销毁清空 Native 槽位并解除 owner。其余用例覆盖已有 Mask 模板绑定/清理和 Graphics 未加载后端销毁。

Native TypeScript 编译通过，薄壳检查为 `43 checks, 0 failures`，审计基线校验通过。本轮 Native C++ 未改变，复用已构建的双配置程序；未重新打包或运行完整文档应用/GPU 捕获矩阵。

[结构化证据与源码、二进制、日志哈希](./native-2d-m6-graphics-preload-material.json)。原始记录位于 `native/tests/2d-poc/build/m6-graphics-preload-material/`，包括有效的修复前失败和最终双配置通过日志。两次探针编写错误另存为 fixture 日志：一次是简化基类没有预加载数组 setter，一次是将绑定属性 material 误写为方法；它们不作为引擎回归证据。

本节点只关闭 Graphics 预加载材质绑定与实例保留问题，不代表 Mask/Graphics 全部 API、资产场景或 M6 最终候选已完成签收。未修改 Web、SpriteRenderer、ModelRenderer 或用户已有改动。
