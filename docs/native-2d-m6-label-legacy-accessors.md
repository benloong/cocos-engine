# M6 Native Label 兼容访问器与继承入口

2026-11-24，基于 `e1f556f8a2`。补齐 Native Label 的旧 `assemblerData` 只读访问器：加载前、加载后及销毁后均返回 `null`，不向 JS 申请 Canvas。原实现没有该访问器，读取结果为 `undefined`。

## 回归与验证

修复前新增定向测试有一项失败、三项通过。失败项明确为 `assemblerData` 返回 `undefined`；混合状态与两种销毁路径原本已经通过，没有为它们增加重复实现。

修复后定向 Native Label Jest 共六项通过、十项未运行：覆盖本次四项、上一节点实体颜色转发和 Native 字段默认值检查。访问器测试在加载、更新文字和销毁后读取值，并监听 CanvasPool.get，确认没有申请 JS Canvas。默认值检查使用现有字段参考，不运行 Web 渲染验收。

继承行为覆盖：

- `_updateBlendFunc()` 通过已有 Native 材质槽桥接取得材质实例，更新目标混合参数和 Pass hash；重复相同设置不再次更新。销毁后安全返回。此项使用 Jest 的原生槽位和 Pass 替身，未声明 GPU 像素结果。
- `_onPreDestroy()` 经真实 Node/CCObject 延迟销毁调度调用。已加载路径只派发一次 onDestroy，解除 Native Node/Font 绑定、释放 TTF 帧并清空实例 owner；未加载路径不创建 Native 后端，也不派发 onDestroy。测试按实际生命周期设置加载标志，未直接调用待验证的预销毁方法。

Native TypeScript 编译通过。实际 JSB 探针对加载前、加载后、销毁后的访问器分别断言为 `null`，Windows Debug、Release 均输出：

```text
jsb shell integration: OK
jsb scene record: OK
native 2D PoC: PASS
```

此次 Native C++ 未改变，复用上一节点已构建的双配置程序；完整 Native 测试随探针运行通过。没有重新打包或运行完整文档应用/GPU 矩阵。薄壳检查为 `43 checks, 0 failures`，M6 审计基线校验通过，Native 源码哈希未变。

## Label 剩余声明差异

审计中 Label 的直接声明差异从七项减少到六项：`_updateBlendFunc`、`_onPreDestroy` 是本节点验证的继承入口；`textStyle`、`textLayout`、`textRenderData`、`textLayoutData` 在参考源码中均标注 `@engineInternal`，对应原有 JS 文本实现的数据对象。Native 不新增这些 JS 布局状态。

六个名字继续保留在机器可读声明基线中，便于追踪；此分类不等于所有 API、完整应用行为或 M6 终态已签收。Mask、Graphics、资产场景组合及最终候选矩阵继续待办。

[结构化证据与源码、程序、日志哈希](./native-2d-m6-label-legacy-accessors.json)。原始记录位于 `native/tests/2d-poc/build/m6-label-legacy-accessors/`。未修改 Web、SpriteRenderer 或 ModelRenderer，也未改动用户已有文件。
