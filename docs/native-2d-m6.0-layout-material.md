# M6.0 Label 尺寸联动与材质壳残留

更新：2026-11-16。关闭计划中已观察到的 Label lateUpdate 高度轮询、Label/Graphics 获取内置材质两个残留。本节点不关闭 M6.0 的全模块 API/间接导入审计，也不替代 M6.5 的完整稳态调用计数与性能门禁。

## 实现

- 删除 Label lateUpdate。原生 Label 负责 NONE 的宽高、RESIZE_HEIGHT 的高度，以及 CLAMP/SHRINK 的既有约束；检测原生 UITransform 宽高变化后重建文本，保持外部 Widget/API 修改尺寸后的换行联动。
- Label 内部 Sprite 使用 CUSTOM size mode，避免带 padding 的纹理覆盖文本布局尺寸。各文本路径共用尺寸同步入口，尺寸一致时不更新 UITransform。
- UITransform 在实际尺寸变化时推送 width/height，JS 壳更新序列化/API 缓存并分发 size-changed。没有逐帧 getter 或 JS 尺寸算法；现有主线程 mutation/prepare 路径调用此桥接，未新增渲染线程 JS 调用。
- SWIG 的专用 callback typemap 使用具有 root/unroot 生命周期的 se::Value 持有函数。替换回调、设 null、detach 或原生组件析构释放旧回调。UITransform onDestroy 调用 detach，解除回调闭包到 JS Component 的持有。
- 用户显式 Label.updateRenderData 只调用原生 measureContent；原生完成测量和尺寸提交，不由 JS 读取宽高后逐项回写。
- 删除 Label/Graphics 的 builtinResMgr.get。内部原生 Sprite 沿既有 UIRenderer.getRenderMaterial 解析 ui-sprite-material，Label 的显式 customMaterial 仍优先。
- 显式 JSB 类型检查发现并修复 UITransform.getComputeAABB 原有无效实例 set 调用，改为 AABB.set(center, halfExtents)，有数值回归。Web 代码不变。

## 验证

- Windows Debug/Release：当前原生构建及全部 cc2d_native_poc 检查通过。
- 实际 UITransform .jsb.ts + V8/native Label 探针：JS setter、原生文本布局修改、宽度改变后重新换行、显式测量、缓存更新、size-changed 和 detach 后无回调。1000 次未改变状态的 prepare 不产生尺寸通知。
- C++：回调仅变化时执行、closure 所有权及 detach 释放；Label 内置/自定义材质选择；Graphics 实际 RenderDrawInfo 的材质为原生注册的内置材质。
- Jest：UITransform 推送/解绑及 AABB、Label 没有 lateUpdate/getContentHeight 轮询、显式测量只桥接一次、Graphics 不获取内置材质、相关生命周期。
- 常规与显式包含 UITransform/Label/Graphics JSB 模块的 TypeScript 检查通过。

复现（先构建当前 native harness）：

```powershell
& native/tests/2d-poc/run-m6-layout-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

探针隔离元数据和 Component 基类，使用实际 UITransform 壳、实际原生 Node/UITransform/Label；Jest 检查完整 JS 注册和壳行为。它不冒充 Creator 真实 Widget/Prefab/场景或跨线程运行证据。跨平台/混合场景/完整稳态计数仍按 M6.4/M6.5 验收。
