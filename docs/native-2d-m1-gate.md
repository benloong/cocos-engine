# Native 2D M1 UI 组件启用门槛

> 适用：`ui-transform.jsb.ts` / `ui-opacity.jsb.ts` 从候选壳切换为生产 override。
> 当前：`ui-opacity` 已启用；`ui-transform` 仍 disabled。

## 1. 当前证据

| 门槛 | 状态 | 证据 |
|---|---|---|
| native `UITransform`/`UIOpacity` 类 | 通过 | native CMake + JSB 构建，`jsb bindings result: OK` |
| 薄壳生命周期/转发 | 通过（mock） | `tests/ui/native-2d-m1-shell.test.ts`，2 passed |
| JSB Scene/Node attach | 通过 | `jsb.Scene` + `jsb.Node` + `n2d.UITransform` + `n2d.UIOpacity` |
| 场景 record 加载 | 通过（最小夹具） | 三层节点、clone、bbox/opacity，`jsb scene record: OK` |
| Web bbox/转换 parity | 通过 | `testUITransformParity` / `RotatedParity` / `ScaleParity` |
| 真实引擎 JS bundle onLoad | **未跑** | v4 worktree 无 Creator JS bundle/场景资产 |
| 场景反序列化/prefab | **未跑** | 仅有手写 record 夹具，不是引擎 `deserialize()` |
| `hitTest` 相机正向用例 | 部分 | native 实现存在；无相机场景的正向断言 |
| `isHit` UI 空间 | 明确回退 | 壳返回 false，避免误用 |
| 每帧 UITransform JSB getter 计数 | 未测 | 需要完整引擎帧循环 |
| override 开关清单 | 已建立 | `native/tests/2d-poc/m1-components.json` + `check-m1-shells.js` |

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

**保持 `ui-transform` disabled**。已有 native 实现、标量/Mat4 绑定、Web parity、场景 record 和 mock 生命周期，但缺少真实引擎 JS bundle/场景反序列化验证；此时启用会把未验证的布局/输入路径带进 native 默认构建。
