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
