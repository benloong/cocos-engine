# Native 2D M1 UI 组件启用门槛

> 适用：`ui-transform.jsb.ts` / `ui-opacity.jsb.ts` 从候选壳切换为生产 override。
> 当前：`ui-opacity` 与 `ui-transform` 均已启用。
> 2026-11-25 已关闭 Windows M1 命中阻断。cocos-cli 重打的 Debug、Release 均通过屏幕正向断言以及默认窗口、错误窗口、离屏相机的负向对照。普通应用和公开接口运行器读取到相同结果。[双配置验收数据](./acceptance/native-2d-20261125/m1-window-hit.json) · [构建和应用日志](./acceptance/native-2d-20261125/m1-window-hit-logs.zip)

## 1. 当前证据

| 门槛 | 状态 | 证据 |
|---|---|---|
| native `UITransform`/`UIOpacity` 类 | 通过 | native CMake + JSB 构建，`jsb bindings result: OK` |
| 薄壳生命周期/转发 | 通过（mock + 实机） | `tests/ui/native-2d-m1-shell.test.ts`；Creator native 场景 onLoad |
| JSB Scene/Node attach | 通过 | `jsb.Scene` + `jsb.Node` + `n2d.UITransform` + `n2d.UIOpacity` |
| 场景 record 加载 | 通过（最小夹具） | 三层节点、clone、bbox/opacity，`jsb scene record: OK` |
| Web bbox/转换 parity | 通过 | `testUITransformParity` / `RotatedParity` / `ScaleParity` |
| 真实引擎 JS bundle onLoad | **通过** | native `cc.js` 含 `n2d.UITransform`/`n2d.UIOpacity`；场景加载成功 |
| 场景反序列化/prefab | **通过** | 真实场景 + `resources.load('M1Prefab', Prefab)` 的 prefab 加载/instantiate 均正确 |
| 依赖组件 umbrella（Label/Sprite） | **通过（attach）** | Label `M1UMBRELLA` 与 Sprite 组件均共享 native UITransform 100×50；Sprite 无 frame，未验证渲染 |
| `hitTest` 屏幕正向用例 | **通过** | 800×600 屏幕相机，活动窗口 ID 1，传入该 ID 时节点投影中心 `(400,300)` 命中，外点 `(10,10)` 未命中。 |
| `hitTest` 负向对照 | **通过** | 相同屏幕中心省略 ID、显式传 0、传错误 ID 2 均未命中。相机输出到 256×256 RenderTexture 时，传相机窗口 ID 1 查询纹理内投影中心 `(128,128)` 也未命中。 |
| `isHit` UI 空间 | **通过** | UI 点经相机/visibleRect 转 world 后调用 native `containsWorldPointXY`；`(640,480)` 命中，`(10,10)` 不命中 |
| 每帧 UITransform JSB getter 计数 | 基线 | 1000 次 `getBoundingBoxToWorld()` = 7 ms（Debug native） |
| override 开关清单 | 已同步 | `m1-components.json` 与 `cc.config.json` 均为 enabled |

## 1.1 测试工程

已在 workspace 根目录创建 `../cocos-m1-test`（相对本文件）：

- Creator 3.8.8 `empty-2d` 模板；
- 场景 `assets/scenes/m1-test.scene`：Canvas + Camera + `M1TestNode`（UITransform 100×50、UIOpacity 128）；
- 脚本 `assets/scripts/M1Test.ts` 输出 `M1_TEST_NODE`（contentSize/opacity/world bbox/convert）；
- 已用 Creator 3.8.8 成功构建 `web-desktop`（无 Missing class）；
- 已将 Engine Manager 的 JavaScript/native 路径都切到 v4，构建 Windows native（620/620 targets），并运行 `build/windows/proj/cocos-m1-test.exe`：
  - 场景加载成功：`Success to load scene: db://assets/scenes/m1-test.scene`；
  - 脚本输出：`M1_TEST_NODE {"contentSize":{"width":100,"height":50},"opacity":128,"box":{"x":590,"y":455,"width":100,"height":50},"world":{"x":640,"y":480,"z":0}}`；
  - native 引擎 bundle 中同时存在 `n2d.UITransform` 和 `n2d.UIOpacity` 壳。

构建过程中修复了两个真实问题：`ui-transform.jsb.ts` 从 `../../core` 导入了不存在的 `director`，改为从 `../../game/director` 导入；测试脚本在 `onLoad` 读取 bbox 时子节点的 UITransform 尚未 onLoad，改为在 `start()` 读取。

**限制**：Sprite 渲染与完整 umbrella scene 未覆盖；`isHit` 的 mask 语义未单独验证。

## 2. 启用步骤

1. 在真实 Creator 工程/native JS bundle 中加载包含 `cc.UITransform` 的场景；
2. 确认 `ui-transform.jsb.ts` 的 `onLoad` 创建 native 对象、`onDestroy` detach；
3. 跑场景反序列化、prefab/clone、属性覆盖回归；
4. 修 `isHit` 或确认 deprecated API 可回退；
5. 把 `m1-components.json` 的 `ui-transform.enabled` 改为 `true`；
6. 在 `cc.config.json` 的 NATIVE override 增加：
   `cocos/2d/framework/ui-transform.ts → ui-transform.jsb.ts`；
7. 运行 `run-m0-checks.ps1` 与 native Debug/Release；
8. 若出现问题，回滚上述两处并重新跑 checks。

## 3. 当前建议

`ui-transform` 已启用。命中门禁读取打包场景在两种相机状态下的实测输出。Prefab/clone 和每帧 getter 计数沿用各自的验收记录。
