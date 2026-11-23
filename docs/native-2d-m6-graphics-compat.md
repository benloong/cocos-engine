# M6.1 Graphics 样式与材质恢复

现行 `cc.Graphics` Prefab 覆盖线宽、线帽、线连接、斜接限制和颜色恢复。GPU 用例通过画面外的路径跨越多个网格块，核对首块材质切换、恢复内置材质以及退出场景后的组件释放。

壳用例检查 `onRestore` 将样式转发到原生后端。原生用例在调度器运行前读取显式更新产生的 draw info。壳用例也覆盖未加载和已销毁时的显式更新。

[场景用例](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6SceneMatrix.ts) · [壳用例](../tests/ui/native-2d-m6-layout-shell.test.ts) · [GPU 比对](../native/tests/2d-poc/compare-graphics-gpu.cjs)
