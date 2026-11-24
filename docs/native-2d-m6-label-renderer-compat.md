# M6.1 Label 渲染和独立 Sprite 资源

现行 `cc.Label` 夹具恢复字体和效果字段。运行时检查显式混合更新隔离共享材质、重复调用复用材质实例，以及销毁后释放 TTF 帧。未加载 Label 的壳用例检查强制更新不分配渲染资源，销毁后组件失效。BMFont 与 LabelAtlas 用例检查切换系统字体后重新绑定原字体时恢复字体帧、字号和布局宽度。

现行 `cc.Sprite` 夹具引用独立 PNG 导入产生的 SpriteFrame。用例检查预加载、四个缓存键、跨场景克隆、最终释放及冷重载，并比较首载、克隆和冷重载的像素。

[渲染探针](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts) · [资源场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6SceneMatrix.ts) · [Label 壳用例](../tests/ui/native-2d-m3-label-shell.test.ts)

### 四个文本布局访问器

`textStyle`、`textLayout`、`textLayoutData` 和 `textRenderData` 在 Label 源码中均标为 `@engineInternal`。引擎源码中对它们的点访问和字符串字面量下标访问集中在 Label 的 Web 实现、TTF 和 BMFont assembler。Native 2D 的导入图使用 JSB Label 和对应的 assembler。完整 Windows 应用的 Debug、Release 部署目录各含 15 个 JavaScript 文件，其中均未出现这四个属性名。

此项覆盖引擎内的直接访问，以及实际运行的 Native 字体布局和 RichText 绘制路径。依赖这四个 Web 布局对象的外部脚本仍有兼容差异。[离线审计脚本](../native/tests/2d-poc/audit-label-layout-access.cjs) · [布局与绘制复验](./native-2d-m6-label-layout-access.json)
