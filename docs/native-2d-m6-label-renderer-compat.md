# M6.1 Label 渲染和独立 Sprite 资源

现行 `cc.Label` 夹具恢复字体和效果字段。运行时检查显式混合更新隔离共享材质、重复调用复用材质实例，以及销毁后释放 TTF 帧。未加载 Label 的壳用例检查强制更新不分配渲染资源，销毁后组件失效。BMFont 与 LabelAtlas 用例检查切换系统字体后重新绑定原字体时恢复字体帧、字号和布局宽度。

现行 `cc.Sprite` 夹具引用独立 PNG 导入产生的 SpriteFrame。用例检查预加载、四个缓存键、跨场景克隆、最终释放及冷重载，并比较首载、克隆和冷重载的像素。

[渲染探针](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts) · [资源场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6SceneMatrix.ts) · [Label 壳用例](../tests/ui/native-2d-m3-label-shell.test.ts)
