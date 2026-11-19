# M6.1 Sprite/Label 材质槽与所有权

更新：2026-11-16。本节点补材质数组整体赋值、单槽 API、加载与销毁桥接，并修复 Label 实际提交路径。完整场景/Prefab、数组原地修改、材质重编译回调和全平台验收仍待独立验证，不在此认定完整组件 parity。

## 实现与边界

- `native-ui-materials.ts` 为 Sprite/Label 安装共同的材质 API 桥接。JS 保存 Component 身份、序列化引用和兼容数组；native 持有运行时共享槽和 MaterialInstance。
- 加载前的 sharedMaterials、已绑定实例会传入 native。加载后，数组整体替换、缩短、清空与 `setSharedMaterial`、`setMaterialInstance` 都更新 native。数组 getter 只在用户调用时从 native 回读，MaterialInstance 按需创建，没有帧轮询。
- sharedMaterials 在 Editor 返回副本，materials 返回兼容实例数组。这里没有新增数组元素写入/删除的 Proxy；原地修改的 Web/native 行为继续列为待验收，不能用整体 setter 的测试替代。
- native 明确区分 `setSharedMaterial(null, 0)` 清空共享槽与 `setMaterial(null)` 恢复内置材质。前者不再意外恢复旧内置变体。forceUpdate 可清除同一共享材质上的缓存实例。
- native 数组 extent 与引用一起调整；缩短数组释放多余共享槽和实例。JS 缓存替换时解除该组件拥有的旧实例回调 owner，销毁时清空 native 槽、JS 数组和 owner。已有其他 owner 的输入实例不会被抢占。
- Label 原先只有 customMaterial 转发到内部 Sprite，其他基类槽/实例与实际提交脱节。现在 native 材质变更钩子同步内部 Sprite，包含按需实例化和数组清空；无 JS 逐帧驱动。
- 本轮没有改变 Web 实现。原生强引用释放与 JS Asset 延迟 destroy 的完整语义仍需结合资源/场景回归复核。

## 验证

使用当前源码构建 Windows Debug/Release harness 后运行：

```powershell
& native/tests/2d-poc/run-m6-sprite-api-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

- C++ 检查 Label DrawInfo 实际材质指针：custom、MaterialInstance、显式 null 清旧提交、恢复内置材质；数组缩短释放强引用，空数组清除渲染。
- 实际 V8/JSB 加载 Sprite、Label、MaterialInstance 和共同桥接源码，检查两类组件的数组替换、native 实例 parent/owner、截断解绑和销毁。
- Jest 使用实际 Web Sprite 对照共享数组替换、缩短、空槽和清空；另覆盖加载前赋值、forceUpdate、实例 owner 与 Label 生命周期，以及已有 SpriteFrame/MaterialInstance 回归。
- 常规 TypeScript 配置显式加入 Sprite/Label JSB 模块后无诊断。

V8 探针隔离装饰器和 JS 基类，Jest 使用实际 Component/UIRenderer 补 API/元数据覆盖。以上不替代真实资产加载、GPU 像素、线程或泄漏工具验证。

### Windows 材质状态回调与槽位生命周期

Windows Debug/Release 探针注册生产版 scene 手工绑定，在同一 Label 的两个槽中引用同一个原生 MaterialInstance，再替换和截短槽。调用原生 `onPassStateChange(false)`，经 JSB 送达组件的槽号依次为 1、0、1，每次回调参数与该槽的 `getRenderMaterial` 相同。静默更新和移除最后一个引用后的通知均未触发组件回调。此前截短数组会留下已失效的 owner，回调可能指向已删除的槽。

该探针从 pass 状态变化入口触发通知。实际 shader 重编译与 GPU 出图仍需场景验证。
