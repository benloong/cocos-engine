# M6.1 Mask 模板与现行 Prefab

两份 `cc.Mask` 夹具分别覆盖 Sprite stencil 与 Graphics stencil。Sprite stencil 的宿主包含 `cc.Sprite` 和 SpriteFrame 引用。用例检查字段恢复、宿主 Sprite 和帧复用、模板反转及退出场景后的销毁。

用例直接通过 Sprite 和 Graphics 模板组件设置材质。Sprite 用例清除自定义材质后更新阈值。Graphics 用例核对模板材质实例并重新绘制模板路径。原生回归直接检查 draw info 中的共享材质、材质实例、显式空槽、默认材质恢复和自动矩形模板。

[场景用例](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6SceneMatrix.ts) · [原生模板材质断言](../native/tests/2d-poc/native/main.cpp)
