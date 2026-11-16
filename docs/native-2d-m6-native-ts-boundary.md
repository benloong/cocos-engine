# M6 native TypeScript 构建与导入边界

更新：2026-11-16。当前完整 native TS 生成与编译通过。此前记录的 30 项诊断已修复；不据此认定 M6 全部终态门禁通过。

## 修复

- `2d/index.ts` 导出 assembler manager 时原本经 Web barrel 导入 Sprite/Label 几何、Canvas 和文本布局实现。NATIVE 现在 override `assembler/index.ts` 到 `index.jsb.ts`，保留 `spriteAssembler`、`labelAssembler` 及组件静态 Assembler 注册。
- 适配器的显式 updateRenderData/updateUVs 请求转发 Sprite.setDirty 或 Label.updateRenderData；updateColor 传递当前 RGBA。原生 Batcher 在遍历时准备并提交 buffer，适配器不分配 RenderData，不注册 JS 帧回调。销毁后 native=null 时这些转发安全返回。
- 这些是旧 manager 入口的 native 更新语义。没有返回 JS 几何/Canvas 缓存；未把 Label 尚待验收的全部兼容 API 认定为通过。
- UITransform.__preload 使用 Node UI 槽位自身的类型完成赋值。原有显式 import 类型没有被 preserveType 改写，额外带入 Web UITransform 实现；移除该引用后，其私有字段身份和关联 Mask 类型错误随无关实现一起消除。
- Mask 从 2D 资产模块直接导入 SpriteFrame；SpriteFrame JSB 重导出 IUV 类型。
- TypeScript API 参数使用 `ScriptTarget.ES2015` 和 `ModuleResolutionKind.NodeJs`，避免字符串 target 带来的隐式默认解析行为。

## 验证

```powershell
node scripts/compile-native-ts.js --no-clean
node node_modules/typescript/bin/tsc --noEmit --pretty false
node --test tests/scripts/native-2d-assembler.test.cjs tests/scripts/native-2d-audit.test.cjs tests/scripts/native-2d-decorators.test.cjs
& native/tests/2d-poc/run-m6-sprite-api-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

- Windows x64、Node 24.18.1、TypeScript 4.9.5：完整 OPEN_HARMONY preserveType 生成（含 rich-text）与类型检查 exit 0；常规项目 tsc exit 0。日志位于本地忽略目录 native/tests/2d-poc/build/native-ts-build.log 和 web-ts-build.log。
- Node 9 项测试通过，包含实际适配器转发 RGBA/更新、静态 manager 注册、释放后调用、限定依赖，及元数据和审计基线。
- Windows Debug/Release 真实 SWIG + 实际 JSB 源码探针通过：静态 manager 身份、Sprite 原生 RenderEntity alpha、几何失效后的 native prepare、Label native 文本更新/颜色更新后像素，以及销毁后调用。探针中 getColor() 的返回包装未暴露 r/g/b/a，未用它做 RGB 读回断言；精确 RGBA 参数由 Node 测试验证，实际 native 探针检查 Sprite alpha 和 Label 更新后仍有像素，不替代 RGB GPU 对照。
- Sprite/Label/SpriteFrame/MaterialInstance 的 4 套件、19 项 Jest 回归通过；UITransform/Mask 的 2 套件、3 项定向回归通过。
- 源码审计新增 entrypointImports，覆盖 2d/index.ts 总入口；回归要求该闭包使用 native assembler barrel 且不含 Web Sprite/Label assembler 子模块。该闭包仍在非 2D 边界停止，不能替代最终构建产物运行时审计。

CI 已接入适配器测试；远端 CI 运行未验证。OPEN_HARMONY 是 TS 生成配置，本轮没有在 OHOS 设备上编译或运行 native 引擎。全平台、动态导入、实际裁剪组合、稳态 JSB trace、真实场景与 GPU/性能门禁继续按 M6 计划推进。
