# M6 SpriteFrame 克隆生命周期矩阵

2026-11-24，基于 `7a7749f315`。新增 Native-only JSB 探针，加载实际 `sprite-frame.jsb.ts`，使用真实绑定的 Texture2D、SpriteFrame、普通 Sprite 和 UITransform。Windows Debug、Release 均通过。本节点只修改验收代码及入口。

## 覆盖与结果

旋转、UV X/Y 翻转、裁剪几何、可打包标志各两种，普通 Sprite 的 SIMPLE/SLICED/TILED 类型与 CUSTOM/TRIMMED/RAW 尺寸模式各三种，共 288 种组合。每种组合执行四次，每个配置完成 1,152 轮，保留 3,456 个已销毁帧包装对象，执行 16,133 条断言。

- `clone()` 和二级克隆保留帧的序列化几何、UV、九宫格 UV 与元数据，共享纹理；Rect、Offset、OriginalSize、Pivot 包装对象各自独立。
- 修改原帧几何、Pivot 并更换纹理后，两级克隆均保持原值。
- 原帧进入真实 CCObject 延迟销毁队列；帧末后纹理清空，迟到依赖和公开 texture 写入不能恢复已销毁资源。
- 普通 Sprite 绑定存活克隆后采用相应尺寸模式；直接修改克隆 Rect 触发原生更新，已绑定 Sprite 使用新的宽度。
- 解绑并销毁中间克隆后，二级克隆仍保留数据和纹理，可重新绑定普通 Sprite。
- 最后销毁全部克隆，保留的所有帧包装对象均处于已销毁、纹理为空的状态；调用者持有的两张纹理最后由调用者主动释放。

两个配置均输出，进程退出码为 0：

```text
sprite frame clone lifetime: PASS (1152 cycles, 3456 retained frames, 16133 assertions)
jsb shell integration: OK
jsb scene record: OK
native 2D PoC: PASS
```

完整 Native 测试随两次探针运行通过。将生成探针中的两级克隆替换为原对象别名后，Release 在第 0 轮报告 `clone math views have independent identity`，退出码为 1；负例检测符合预期。

六项 Native SpriteFrame 薄壳 API／序列化 Jest 测试通过，同文件四项 Web 测试排除。生成器语法、PowerShell 入口语法和 M6 审计基线校验通过，薄壳检查为 `43 checks, 0 failures`。审计基线通过不表示其余公开 API 已完成行为签收。

## 复现与边界

运行 `node native/tests/2d-poc/build-sprite-frame-lifetime-probe.cjs` 生成探针，再将生成的 `build/sprite-frame-lifetime-probe.js` 绝对路径作为 Native PoC 的第一个参数。建议从独立构建目录启动。该探针也已加入 `run-windows-jsb-probes.ps1` 的标准 Native 集合；本轮直接运行新增探针，没有重跑整个七组集合。

[结构化证据、程序及源码哈希](./native-2d-m6-sprite-frame-clone-lifetime.json)。原始日志与生成的负例位于 `native/tests/2d-poc/build/m6-frame-clone-lifetime/`。

此节点验证资产状态、数学视图独立性、原生 Sprite 尺寸消费及延迟销毁，不声明新的 GPU 像素、描述符或进程堆泄漏结论。Creator 导入、Prefab 实例化、异步下载与跨场景缓存所有权仍是独立验收项。Native 动态合图继续禁用；新增探针未构造 SpriteRenderer／ModelRenderer，也未创建帧的 Mesh。

未修改或运行 Web。本节点通过不替代其余 API、资产场景组合或同一最终候选的完整 M6 签收。
