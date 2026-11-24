# M6.1 Mask 模板与现行 Prefab

两份 `cc.Mask` 夹具分别覆盖 Sprite stencil 与 Graphics stencil。Sprite stencil 的宿主包含 `cc.Sprite` 和 SpriteFrame 引用。用例检查字段恢复、宿主 Sprite 和帧复用、模板反转及退出场景后的销毁。

用例直接通过 Sprite 和 Graphics 模板组件设置材质。Sprite 用例清除自定义材质后更新阈值。Graphics 用例核对模板材质实例并重新绘制模板路径。原生回归直接检查 draw info 中的共享材质、材质实例、显式空槽、默认材质恢复和自动矩形模板。

[场景用例](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6SceneMatrix.ts) · [原生模板材质断言](../native/tests/2d-poc/native/main.cpp)

## 引擎内的旧渲染接口调用

Native 在 `75e7b85c62` 移除了 Mask 上的 19 个弃用渲染成员。需要改色或设置材质的调用方可通过 `mask.subComp` 取得当前模板组件，并在切换模板类型后重新取得该组件。Windows Debug 和 Release 已验证 Sprite 与 Graphics 模板切换时的组件身份和旧别名。[双配置应用记录](./native-2d-m6-mask-stencil-api.json)

在 `7501ce0ab9` 工作区执行 `node native/tests/2d-poc/audit-mask-renderer-callers.cjs`，检查了 `cocos/` 下 1277 个 TypeScript 实现文件。对 19 个成员的点访问和字符串字面量下标访问，类型检查器识别出 0 处直接调用。正对照检出了普通 Mask 的两个成员和 Native Mask 的一个成员，且正确放过了对模板组件的访问。Mask 壳的 Jest 用例通过 7/7。[调用点检查脚本](../native/tests/2d-poc/audit-mask-renderer-callers.cjs)

本项签收范围是引擎内可静态识别的上述访问。外部游戏脚本、类型擦除为 `any` 的接收者、解构和动态计算的属性名均在检查范围之外。外部代码若直接使用这 19 个成员，仍有兼容差异。
