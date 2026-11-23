# M6.1 Label 现行序列化字段与默认值

更新：2026-11-16。修复 M6.0 初版矩阵发现的 Label 字段/初值差异，并补 native 下划线高度与实际字号 API。此节点不宣告 Label 全 API、CHAR 效果、复杂文本或真实完整场景已完成。

## 行为

- 恢复与 Web 一致的 24 个序列化字段/初值：默认文字 label、水平/垂直居中，字体与系统字体标记、bold/italic/underline、下划线高度、outline/shadow 及偏移。特别是 _font 和 _isSystemFontUsed 现在能从现行 Web/Editor 记录恢复。
- 原生壳先前的内部 _useSystemFont 统一改为 Web 的 _isSystemFontUsed；持久化字段遵循现行 Web/Editor 序列化契约。本节点不引入会覆盖规范字段读取的 formerlySerializedAs 映射。
- font/cacheMode 的编辑器类型元数据与 Web 对齐。Details 对 _font 的 UUID 回填不需要额外包装，onLoad 一次绑定原生字体资产。
- _syncAll 补齐反序列化后 bold、italic、underline、underlineHeight 的原生初始化；此前只在用户调用属性 setter 时才转发这些样式。
- underlineHeight API 转发到 native，普通 TTF 栅格路径使用指定厚度，不再固定为 1。actualFontSize 显式读取 native 解析字号；空文本清除输出。序列化字段仍保留输入快照，native 负责渲染时的实际结果。

## 验证

- Jest 比较全部 24 个 Web/native 序列化字段默认值，且 native __values__ 含相同字段。
- 以实际 deserialize + Details 读取包含 `_font` 和 `_isSystemFontUsed` 的现行 `cc.Label` 记录，验证字体 UUID 回填、系统字体标记、样式和效果传给 native；instantiate 保留字体 Asset 身份、复制 Vec2 状态且不复制 native 组件对象。
- Windows Debug/Release 重新生成 SWIG 并编译链接通过。实际 V8/UITransform 壳 + native Label 探针验证普通 TTF 下划线厚度改变 CPU 光栅结果、actualFontSize 和空文本清理；其余布局/静止帧/解绑回归仍通过。
- run-m6-layout-tests.ps1：3 组 Jest、6 项用例和两个原生配置通过；常规及显式包含 Label JSB 的 TypeScript 检查通过。
- 审计基线同步后，Label 缺失序列化字段与初值文本差异均为 0。

复现：沿用 [布局测试入口](./native-2d-m6.0-layout-material.md)。真实 Creator 场景/Prefab、完整字体加载释放、全平台字体和 GPU 字形对照仍归 M6.1/M6.4；本节点的 mocked native 转发测试不替代这些证据。
