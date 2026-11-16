# M6.1 字体资产 native 数据与生命周期

> 更新：2026-11-16。完成 TTFFont、BitmapFont、LabelAtlas 的基础数据、所有权和 Label 消费路径下沉。Windows Debug/Release 的 C++ 与实际 JSB 壳定向验证通过。真实旧场景/Prefab、完整资源加载释放及跨平台字体矩阵仍须独立验收。

## 数据与调用边界

- Font/TTFFont/BitmapFont/LabelAtlas 直接导出 jsb 原生构造器并修改 prototype；使用 native-binding/decorators 注册 ccclass 和原序列化字段。NATIVE 构建通过 cc.config.json 替换模块。
- C++ FontAsset、BitmapFontAsset 避开现有 core/assets 中 Font/BitmapFont 渲染类的名称；SWIG 对外仍注册 Font、BitmapFont。LabelAtlas 继承 BitmapFontAsset。
- TTFFont 持有 family、source path 和独立字节副本；加载失败保留原数据。_nativeAsset 保持加载器使用的 family alias 契约，onLoaded 按 nativeUrl 加载字节，同源且已加载时不重复读取。initDefault 清除旧数据并设置 Arial。
- BitmapFontAsset 持有 SpriteFrame 强引用、fontSize、原始 fntDataStr、配置 JSON、原生 glyph 索引和 kerning 表。配置赋值一次传 JSON，由 C++ 完整解析成功后原子替换；支持 Web 的 signed packed kerning key，以及嵌套的 Unicode key。
- Label 只绑定字体资产，渲染直接读取共享的原生 glyph/kerning 表；移除 JS _applyBitmapFont 和每次绑定时的逐字形 JSB 调用。多个 Label 可共享同一字体。
- fntConfig 返回用于序列化/兼容的 JS 视图。整体赋值立即提交；修改嵌套字段后须调用 onLoaded 或重新赋值才能提交。fontDefDictionary/FontAtlas 是按需生成的废弃 API 兼容视图，不参与 native Label 渲染，修改该视图不会修改原生字形。兼容视图不 addRef/decRef/destroy 共享纹理。
- 没有恢复已撤销的 SpriteFrame 共享内存方案，没有新增每帧 JS 字体处理。

## 所有权与释放

- Label 通过 IntrusivePtr 持有 FontAsset；BitmapFontAsset 持有 SpriteFrame，后者持有 Texture。切换字体、切回系统字体和 Label onDestroy 解除绑定。
- 原生 revision 标识数据变更，Label 在 prepare/updateRenderData 时检测后重建。配置清空、图集解绑和字体销毁会清除旧 draw frame、像素与尺寸，空字体不会回退显示旧系统字体。
- clearNativeData 释放原生表/字节/图集，可重新填充。destroy/destruct 标记 released 并释放数据；销毁后不接受重新填充。C++ 析构自然释放成员。JS _destroy/clearNativeData 同时丢弃缓存的兼容视图。
- CHAR 字形缓存现由 native 注册表条目中的 unique_ptr 独占。Label 保存非 owning 指针、键和一份计数租用；所有获取/切换/销毁路径对称增减租用数，最后一个租用释放时注册表删除条目和图集。已移除此前的 shared_ptr/weak_ptr 方案。键包含字体实例身份、revision、CSS font 和 lineHeight，避免同名字体重新加载或不同布局条件复用旧字形。两 Label 共用、释放其中之一和最后租用的 1000 次释放/重建通过 Windows Debug/Release 原生回归，见 [所有权记录](./native-2d-m6.3-graphics-runtime.md)。
- TTF 字节归资产所有，但现有 Canvas 平台后端仍通过加载器注册的 alias/path 渲染；本轮没有新增“直接从这些字节渲染”的接口，也没有改变平台字体别名注册表。OS 字体资源的创建/释放仍由现有 Canvas delegate 管理，不能在单个资产销毁时全局注销共享字体。平台注册表清理和真实跨平台字体句柄验收保持待办。

## 验证与复现

| 检查 | 覆盖 |
|---|---|
| Windows C++ Debug/Release | TTF 字节复制、失败加载保留旧数据；配置解析与失败原子性；packed/nested kerning；LabelAtlas 渲染；配置/图集更新；共享引用与 Label 析构；1000 次切换；字体销毁后的数据和旧画面清理 |
| 实际 V8/JSB 壳 | 四个实际 .jsb.ts 模块、真实原生继承和构造钩子；读取仓库 Thonburi.ttf；配置/字形/兼容视图；原生 Label 绑定与切换；clear/destroy/initDefault |
| Jest | ccclass 与序列化元数据、Asset 初始化、TTF alias/nativeDep/加载去重；Details 依赖回填；兼容视图及纹理不误销毁；Label 转发、系统字体切换、onDestroy；既有字体加载/字体名回归 |
| TypeScript | 常规项目及显式包含四个字体 JSB 模块、Label JSB 的类型检查 |

```powershell
& native/tests/2d-poc/run-m6-font-assets-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
```

先构建当前版本 native harness。脚本生成实际字体 JSB 源码探针，要求 jsb shell integration: OK，然后运行字体资产、Label 壳和 Web 字体加载/字体名测试。run-m0-checks.ps1 已接入字体入口。

V8 探针隔离 core/metadata 与 Asset 初始化，元数据由 Jest 验证；它读取真实 TTF，但不运行完整 asset-manager/Creator 场景。C++ 检查原生 BMFont 合成像素，不替代真实字体 GPU 对照或泄漏检测工具。

补充回归覆盖 BitmapFont/LabelAtlas 实例间配置和兼容视图隔离、native 配置更新后旧 JS 视图不覆盖新数据，以及释放一个资产不影响另一个资产。实际 JSB 探针同时验证 destroy 后迟到的图集依赖、配置和 TTF 加载器写入不能恢复已释放的数据。

补充实际 `deserialize` 入口验证：BitmapFont/LabelAtlas 恢复原生配置、字号、源文本，记录 SpriteFrame UUID 并经 Details 回填；TTFFont 恢复 family 时不会提前读取 native 依赖。该测试发现并修复内置类快速反序列化把 null 默认值的字符串当作对象的问题，JIT 和非 JIT 实现都改为按序列化值区分 primitive/object。两种实现分别覆盖 nullable 字符串、数字、布尔、对象、null 和缺省字段；四个定向 Jest suite 共 24 项通过，已接入字体测试脚本与 native TS CI。CI 配置已更新，远端运行仍待验证。本轮重新运行 Windows Debug/Release 字体 JSB 探针通过；这不替代完整 asset-manager 异步加载与真实场景验收。

## 后续验收

按 [M6 计划](./native-2d-m6-plan.md) 继续真实字体资源/旧场景/Prefab、完整异步依赖加载、重复加载释放、平台字体注册表/句柄矩阵、复杂文本和 GPU 对照。基础数据下沉通过不关闭这些终态 Gate。
