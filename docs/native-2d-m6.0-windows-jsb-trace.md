# Windows V8 逐组件 JSB 运行基线

场景使用 Windows Debug、V8、GLES3 及同一套 Canvas/Camera。测试专用 Debug 程序编译时开启已有的 `RECORD_JSB_INVOKING`，通过原生绑定注册函数统计方法、属性、构造和析构。常规应用没有采集控制入口。每组依次记录创建或配置、预热后的静止场景、用户显式调用。每个静止窗口均捕获 60 次原生 Root.frameMove。每个显式窗口准确捕获一次 SpriteFrame.getRectWidth。

空 Canvas 和 13 个组件/资产消费者窗口均没有迁移类的稳态直接调用。按函数名与空 Canvas 相减，仅 V8 GC 析构的分布有差异。完整计数包含相机、管线、节点和 GC；13 个非空窗口覆盖 UITransform、RenderRoot2D、UIOpacity、Sprite、Label、Graphics、Mask、RichText、LabelOutline、LabelShadow 以及普通、TTF 和位图字体、SpriteFrame、SpriteAtlas 消费者。基础类通过其可绘制派生类覆盖。原始 TTF 由 asset-manager 加载。输出按场景分组，共享的 UITransform、Node 或资产不独立归因到每个对象。耗时和迁移前后改善率由性能门禁独立采集。

## 复现

先按 Graphics GPU 报告准备 Windows 场景工程和当前 native override，在启用 x64 MSVC 的 PowerShell 中执行下列命令。runner 只修改独立 trace 程序的 Resources 入口，随后的运行从工程 data 恢复，再安装夹具。

```powershell
$fixture = (Resolve-Path native/tests/2d-poc/build/graphics-gpu-project).Path
$build = 'native/tests/2d-poc/build/gpu-win-trace'
cmake -S "$fixture/native/engine/win64" -B $build -G Ninja -DCMAKE_BUILD_TYPE=Debug "-DRES_DIR=$fixture/build/windows" '-DCMAKE_CXX_FLAGS_DEBUG=/Z7 /Od /DRECORD_JSB_INVOKING'
cmake --build $build -j 5
pwsh -NoProfile -File native/tests/2d-poc/run-m6-jsb-trace.ps1
```

原始 stdout、stderr 和 JSON 位于 trace 构建目录。版本库保存本次[逐窗口函数计数](./native-2d-m6.0-windows-jsb-trace.json)。统计限于 V8 的 SE 绑定包装入口，未计入原生内部直接调用或通过共享内存完成的数据访问。M0 至 M6 常规 Debug 门禁及 32 项定向 Jest 在关闭采集的应用中通过。

## 当前引擎的变更与生命周期计数

Windows Debug 和 Release 使用相同的引擎 JS，原生程序分别按配置编译并显式启用 `RECORD_JSB_INVOKING`。两种配置各采集 14 个场景、每个场景 8 个窗口。创建和初始配置完成后预热 12 帧，随后分别采静止 60 帧、一次显式 SpriteFrame getter、一次同步变更、变更后的 1 帧、节点禁用、重新启用、销毁及随后的 3 帧。最后检查节点已经销毁。每个窗口的方法计数之和均等于 V8 输出的窗口总数。[双配置逐窗口、逐方法计数与构建哈希](./native-2d-m6-jsb-lifecycle.json)

下表为迁移类的直接绑定调用数，两种配置逐格相同。每个场景在静止窗口和变更后的 1 帧均为 0；共享 manager 在静止窗口固定调用 60 次。显式 getter 单独命中 1 次。组件启停包含节点上及子节点中的所有组件。空 Canvas 对照也创建一个带 UITransform 的空子节点，因此销毁列包含它的 1 次调用。JSON 保存 Canvas 的完整方法计数，其余场景保存相对 Canvas 同阶段的逐方法差值，二者相加可还原各原始计数。

| 场景及变更 | 创建/配置 | 同步变更 | 禁用 | 再启用 | 销毁及后续 3 帧 |
|---|---:|---:|---:|---:|---:|
| 空 Canvas 子节点 | 0 | 0 | 0 | 0 | 1 |
| UITransform 改尺寸 | 1 | 1 | 0 | 0 | 1 |
| RenderRoot2D 平移根节点 | 29 | 0 | 2 | 2 | 9 |
| UIOpacity 改继承透明度 | 31 | 1 | 2 | 2 | 9 |
| Sprite 改色 | 22 | 1 | 1 | 1 | 6 |
| Label 改字 | 34 | 1 | 1 | 1 | 6 |
| LabelOutline 改宽度 | 35 | 1 | 2 | 2 | 7 |
| LabelShadow 改模糊半径 | 35 | 1 | 2 | 2 | 7 |
| Label 清除文件字体 | 38 | 4 | 1 | 1 | 6 |
| BitmapFont 改字号 | 38 | 1 | 1 | 1 | 6 |
| LabelAtlas 改字号 | 38 | 1 | 1 | 1 | 6 |
| Graphics 新增矩形 | 24 | 1 | 1 | 1 | 4 |
| Mask 修改 inverted | 37 | 1 | 2 | 2 | 9 |
| RichText 更换带图片的富文本 | 15 | 1 | 0 | 0 | 3 |

Component、Node 和管线方法计入窗口总数。例如 RichText 场景启停各有一次 Component.setEnabled。静止窗口与空 Canvas 逐方法相减，移除 GC 析构后，两种配置的差值均为空。资产通过表中消费者参与场景，表内销毁计数覆盖这些节点的生命周期，独立资产的加载、换源及 releaseAsset 另行验收。

复现时使用两个独立的 CMake 构建目录。Debug 使用上文配置，Release 使用 `-DCMAKE_BUILD_TYPE=Release` 及 `-DCMAKE_CXX_FLAGS_RELEASE=/O2 /Ob2 /DNDEBUG /DRECORD_JSB_INVOKING`。分别将目录传给 `run-m6-jsb-trace.ps1 -BuildDir`。每次运行均保存完整 trace.log 和 trace.json。

## 独立资产的 JSB 调用

Windows Debug 和 Release 各运行 Font、TTFFont、BitmapFont、LabelAtlas、SpriteFrame、SpriteAtlas 六组独立资产，每组分四个计数窗口。下表是 V8 原始总调用数，两种配置逐格相同。每个窗口包含一次计数器清零；延迟清理窗口还包含三帧的常规引擎调用。[完整逐方法记录及可执行文件哈希](./native-2d-m6-jsb-assets.json)

| 资产及变更 | 创建和初始配置 | 同步变更 | destroy | 随后三帧 |
|---|---:|---:|---:|---:|
| Font 改名 | 2 | 2 | 6 | 195 |
| TTFFont 设字体族并加载 223404 字节的本地 TTF | 2 | 3 | 6 | 195 |
| BitmapFont 更换字形图集帧 | 8 | 2 | 6 | 195 |
| LabelAtlas 更换字形图集帧 | 8 | 2 | 6 | 195 |
| SpriteFrame 更换纹理 | 8 | 7 | 6 | 196 |
| SpriteAtlas 替换同名帧 | 8 | 4 | 6 | 196 |

每次变更后回读属性，调用 destroy 后立即检查严格有效性，三帧后检查延迟销毁完成。字体资产报告已释放，TTF 字节和源路径清空，位图字体解除帧引用；SpriteAtlas 清空原生帧表，共享帧及纹理仍然有效。这组同步 destroy 采集与前文的节点生命周期窗口独立，异步下载、取消和跨场景资源行为由其各自验收项覆盖。
