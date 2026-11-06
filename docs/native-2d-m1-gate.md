# Native 2D M1 UI 组件启用门槛

> 适用：`ui-transform.jsb.ts` / `ui-opacity.jsb.ts` 从候选壳切换为生产 override。
> 当前：`ui-opacity` 与 `ui-transform` 均已启用。

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
| `hitTest` 相机正向用例 | **通过** | physical window center `(400,300)` 命中，`(10,10)` 不命中；native camera 800×600 |
| `isHit` UI 空间 | 明确回退 | 壳返回 false，避免误用 |
| 每帧 UITransform JSB getter 计数 | 未测 | 需要完整引擎帧循环 |
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

**限制**：每帧 getter 计数和 `isHit` UI 空间语义仍未覆盖。

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

`ui-transform` 已启用。真实 native 场景回归通过，但 prefab/clone、每帧 getter 计数和 `hitTest` 相机正向用例仍是 M1 收尾项；出现回归时按第 2 节回滚。
