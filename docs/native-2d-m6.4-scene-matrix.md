# M6.4 Scene、多 Camera 与动态纹理循环

> 2026-11-16。Windows Debug 普通应用与 ASAN 应用，对照 Chrome Web 的定向验收。完整 M6 Gate 保持未关闭。

## 修复与所有权

Graphics 在 `onLoad` 前调用绘图 API 时，旧壳因 `_native` 尚未创建而丢弃命令。新的壳在首次绘图时创建未绑定 Node、禁用提交的原生 Graphics；路径、三角化和网格仍由 native 持有，没有 JS 命令队列或几何镜像。`onLoad` 绑定 Node 并复用该对象，不丢失已有几何。

Component 对从未执行 `onLoad` 的实例不调用 `onDestroy`。Graphics 因此在 `_onPreDestroy` 的 finally 中执行幂等清理，解除 Mask 借用、材质槽与 Node 绑定；显式 onDestroy 使用同一清理函数。销毁后绘图不重新创建 backend。Mask 的同步借用通知及 native unique_ptr/IntrusivePtr 所有权不变，不引入 shared_ptr。

此前 RenderRoot2D/RichText 槽位冲突及 ASAN 越界修复见 [注册报告](./native-2d-m6.4-render-root-lifecycle.md)。本报告的当前快照已包含编号修复。

## 夹具与证据

`M6SceneMatrix.ts` 使用真实 `director.runSceneImmediate`，在非激活 Scene 中预先创建 Graphics，覆盖双 Camera 的 layer、priority、clearFlags、启停、位置和目标 RenderTexture 切换。然后连续创建 1000 个新 Scene、Texture2D、SpriteFrame，保留一个 persistent root，释放上一轮资产，每 100 轮显式 GC，最后进入空场景并检查 root 注册归零。

- 同一快照 `a81b23d626f58590e94174f73d814bbb888ba8e21c4211e1403113a83a0abe56`：74 图像（此前 58 例加 10 个 Camera 用例、5 个循环采样、最终空场景），逐通道最大差值 0；19 个命中和 11 个注册检查一致。
- 两端各 1000 次场景切换、创建/销毁 1000 个动态纹理、4998 个循环断言、10 次 GC，以及 10 个场景状态检查通过。采样同时检查红/蓝 Sprite 与绿色 persistent root。
- ASAN 应用使用 MSVC `/fsanitize=address`，完成同样的 1000 次循环和全部图像捕获，stderr 为 0 字节。逐图 SHA256、环境与计数见 [结果](./native-2d-m6.4-scene-matrix-results.json)。未运行 LeakSanitizer，不声明无泄漏。
- Graphics 新增两项 Jest 回归先复现失败，修复后该 suite 4/4 通过；Debug/Release 实际 JSB 探针验证预加载绘图与 onLoad 复用。常规 TS、完整 native TS、夹具 TS（skipLibCheck）和 10 项静态审计测试通过。
- Sprite API 综合入口仍有工作区既有 `SpriteFrame.native` getter 对应的一项旧测试失败（其余 18 项通过），该文件未纳入本节点；快照包含这处工作区状态，不能作为最终候选 Gate。

## 复现

沿用 [GPU 构建步骤](./native-2d-m6.3-graphics-gpu.md#复现)。prepare 会生成独立的 `build-config-web.json`；Web 构建必须使用此配置，避免沿用 Windows outputName 覆盖其资源目录。普通 native 与 ASAN runner 共用输出目录，按顺序运行；ASAN runner 会额外保存副本。

在 x64 MSVC 环境中：

```powershell
& native/tests/2d-poc/run-graphics-gpu-native.ps1
node native/tests/2d-poc/run-graphics-gpu-web.cjs
node native/tests/2d-poc/compare-graphics-gpu.cjs
& native/tests/2d-poc/run-m6-scene-matrix-asan.ps1
node native/tests/2d-poc/compare-graphics-gpu.cjs native/tests/2d-poc/build/graphics-gpu-native-asan native/tests/2d-poc/build/graphics-gpu-web
```

原始本机日志在忽略目录 `native/tests/2d-poc/build/scene-matrix-preload-*`；ASAN 完整运行标记为 `M6_SCENE_ASAN_READY 1000`。平台注册表、真实资产文件异步加载卸载、复杂字体/事件、线程边界、Release GPU、其他平台及性能 KPI 仍待验收。这里的直接动态创建/销毁与 GC 不替代资源管线或堆增长测量。
