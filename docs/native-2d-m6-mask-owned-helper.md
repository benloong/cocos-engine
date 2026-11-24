# M6 Mask 自有模板销毁与资源重建守卫

2026-11-24，基于 `a8cf2ff684`。修复两条 Mask 生命周期缺口：未加载组件通过 type/subComp 创建了 Graphics 模板，但销毁时没有 onDestroy 回调，模板及其预加载后端未释放；已销毁 Mask 的 subComp 等入口仍能重新创建模板资源。

## 修复行为

增加幂等清理入口，由 onDestroy 和 `_onPreDestroy()` 的 finally 共用。无论组件是否加载，都解绑模板与 Native Mask，安排自有 Graphics 节点进入正常销毁队列，清空模板及待解析 SpriteFrame 引用。继承预销毁流程仍负责生命周期派发与从宿主移除组件。

组件排队销毁或已经清理后，subComp 返回 null，类型/帧写入和模板创建、手动 onLoad/onRestore 不再建立新资源。获取私有模板的方法改为可空返回，调用点均处理空值。清理可以重复调用；没有修改 Web 或额外销毁宿主上用户持有的 Sprite。

## 验证

修复前，两项新增回归分别失败：未加载路径的模板 Node 仍有效，已加载路径的 subComp 在销毁后返回新模板。修复后，Mask/Graphics 两个套件共 15 项通过；新增两项单独运行也通过，确认不依赖前置测试顺序。

回归使用真实 JS Node、Component 和 CCObject 延迟销毁流程，Native 绑定为 Jest 替身。覆盖未加载/已加载 Mask、模板加载前绘制后端、排队销毁时读取、两个销毁批次后的子节点与组件失效、Graphics 后端清空、待解析帧引用清除，以及销毁后读模板、改类型、写帧、手动恢复/加载不再创建 Native Mask。已加载路径派发一次 onDestroy，未加载路径不派发但仍完成清理。

```text
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

Native TypeScript 编译通过；薄壳检查为 `43 checks, 0 failures`，审计基线校验通过。Native C++ 未改变，复用现有 Windows Debug、Release 程序运行完整 Native 测试与现有 Sprite/Label/Graphics JSB 探针，两种配置均为 `native 2D PoC: PASS`、`jsb shell integration: OK`。这些既有集成回归不替代新增 Mask 壳的完整应用联调。

[结构化证据与源码、程序、日志哈希](./native-2d-m6-mask-owned-helper.json)。原始记录位于 `native/tests/2d-poc/build/m6-mask-owned-helper/`。最初一次替身缺少 moveTo 的夹具错误单独保留，不作为引擎失败证据。

本节点验证自有模板退役与禁止资源重建，没有新增完整应用 Mask wrapper、GPU 像素或进程堆泄漏签收结论。完整文档应用打包、其余 API/资产场景与同一最终候选 M6 签收继续待办。未修改 Web、SpriteRenderer、ModelRenderer 或用户已有改动。
