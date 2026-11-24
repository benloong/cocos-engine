# M6 RichText 保留包装对象与资源生命周期压力验收

2026-11-24，基于 `962d5257dc` 的 Native 实现新增压力用例。Windows Debug、Release 编译及完整 Native 测试均通过；此节点只增加验收代码，没有修改运行时实现。

## 覆盖行为

每种配置执行 100 轮，每轮创建含 32 个文字段和 32 个图片段的 RichText，并在两个宿主分别保留一批真实 JSB Node、UITransform 包装对象。累计保留 12,800 个 Node 和 12,800 个布局包装对象，跨后续重建与分配检查其状态。

- 清空文本后子节点全部脱离宿主；布局池准确保留 20 个文字段与 10 个图片段，超出上限的段销毁；图片资源引用回到基线。
- 重建后更换宿主，旧段 Node 即使被外部强引用，仍处于已销毁、无父节点、未激活、无 Renderer 的状态；借用的布局包装对象私有指针清空。
- 禁用期间清空文本会延迟布局，重新启用后应用清空；随后交替以活动段或池中段结束 RichText 生命周期，验证两种销毁路径。
- 半数轮次显式清除字体与图集；全部轮次结束后字体、图集、SpriteFrame、纹理引用计数均回到预先记录的基线。
- 每 10 轮触发一次 GC，并检查迄今保留的全部包装对象。Node 包装对象仍指向被强引用保留的已销毁原生 Node；已销毁布局的借用包装对象不能重新获得有效指针。
- 生命周期结束后继续刷新脏队列，覆盖队列中的旧 Renderer 清理。

## 验证结果

两种配置输出相同的关键结果，退出码均为 0：

```text
rich text retained wrappers: PASS (100 cycles, 12800 Nodes, 12800 layouts, 10 GC checkpoints)
jsb shell integration: OK
jsb scene record: OK
native 2D PoC: PASS
```

完整测试还运行了现有 RichText JSB 薄壳探针及场景记录。薄壳检查为 `43 checks, 0 failures`；M6 审计基线校验通过，其 API 清单输出仍包含待确认项，不代表完整 API parity 已通过。

[结构化结果与程序、源码及日志哈希](./native-2d-m6-richtext-retained-wrappers.json)。原始构建与运行日志位于 `native/tests/2d-poc/build/m6-richtext-retained-wrappers/`。重新编译 Native PoC 后运行 `cc2d_native_poc.exe` 即会执行新增压力用例；附加 `build/richtext-runtime-probe.js` 参数可同时执行现有 JSB 薄壳探针。

## 验收边界

本用例故意保留 Node 与包装对象，不用于判定进程堆是否无泄漏。它验证真实 JSB 转换、借用包装失效和原生对象退役；完整应用中的 Node 包装对象联调仍需单独签收。字体使用系统 Arial，不覆盖自定义字体与复杂字形。此次没有新增 GPU 或 Web 验收，SpriteRenderer、ModelRenderer 不在范围内。

本节点通过不代表 M6 终态通过。其余公开 API、资产/场景组合、异步资源生命周期以及同一最终候选的完整签收继续待办。
