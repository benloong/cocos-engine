# M6.3 Graphics 原生几何核心

更新：2026-11-16。完成可独立验证的 native 路径、填充三角化和描边网格核心。786 组实际 Web 实现对照在 g++、Windows MSVC Debug/Release 通过。运行时 Graphics 仍使用旧 CPU 纹理路径；GPU 提交和 Mask 改造是接下来的必做工作，本节点不关闭 M6.3。

## 实现与语义

- `native/cocos/2d/geometry/GraphicsGeometry` 持有多子路径和增量输出。moveTo 新建子路径，fill/stroke 后的下一次 moveTo 开始新的提交范围；重复 fill/stroke 保持 Web 的路径范围和追加语义。clear 清除路径和网格，保留样式。
- rect/circle/ellipse/roundRect/arc、cubic/quadratic 直接在 native 构建路径。曲线沿用 Web 的 KAPPA、递归细分容差和深度边界；路径计算使用 double，输出时转 float，匹配 Web Float32Array。
- 复杂路径使用单环 Earcut：重复/共线过滤、Z-order 索引、局部交点修复和拆分回退。Z-order 使用稳定排序建立链；Web 使用链表归并，两者在测试中输出相同索引。Web Graphics 按每条子路径分别填充，不向 Earcut 传 holeIndices；本核心保留这一语义，没有增加跨路径挖洞规则。
- 描边沿用 Web flatten/joins/caps/三角带展开，支持 BEVEL/ROUND/MITER、BUTT/ROUND/SQUARE 和 miterLimit。闭合点比较采用 Web Vec2 相对容差；不能用精确坐标相等代替。
- 输出为 Web Graphics 的八浮点顶点布局（position.xyz/color.rgba/distance），索引为 uint32。核心不依赖 Canvas、Texture、Sprite、JSB、GPU 或引擎单例，已进入 production CMake 源列表；目前尚无生产组件消费它。

## 对照与复现

```powershell
& native/tests/2d-poc/run-m6-graphics-geometry-parity.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_graphics_geometry.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_graphics_geometry.exe'
)
```

先构建上述 CMake target。runner 编译独立 g++ backend，生成输入，运行三个 backend，再由 Jest 调用实际 Web Impl、helper、GraphicsAssembler 和 Earcut 对照。测试仅替换 Web MeshRenderData 存储入口和更新通知；未复制 Web 几何算法生成期望值。

786 组覆盖正负尺寸、超过旧 256 画布的坐标、圆椭圆、两种 arc 方向/整周、roundRect 限制和负尺寸、cubic/quadratic、凹多边形、反向顶点、重复/共线点、局部自交、急角、三种 join/cap、两种线宽、miterLimit、开闭路径、多次填充/描边、RGBA 切换、clear、80 组确定性随机凹多边形及 5000 点复杂填充。

逐 backend 比较完整顶点数量、三角形索引数量和每项索引（精确相同），顶点各通道须有限，误差不得超过 max(0.00002, |Web|×0.000001)。三个 backend 合计 2358 组对照通过。C++ harness 另外生成 20000 个独立矩形，验证 80000 顶点、120000 索引与末尾 79999，防止几何层提前截断为 16-bit。

Windows x64 / Node 24.18.1 / TypeScript 4.9.5 / MSVC 14.51；Debug 使用 /Z7 /Od /RTC1，Release 使用既有 Release 配置。本机 Debug 首次构建在外部 ConvertUTF.c 遇到已有 PDB 管理器 C1902，改用本地 CMAKE_C_FLAGS_DEBUG 的 /Z7 后构建通过，没有修改 production 编译标志。日志和完整 native 输入/输出在忽略目录 native/tests/2d-poc/build。CI 增加 g++ + Web 对照入口，远端执行未验证。

## 必须继续的运行时工作

下一节点将核心接入原生 Graphics：使用匹配 graphics shader 的顶点布局和 GPU buffer/IA，按硬件索引边界分块，原生处理世界变换、opacity、材质、Node/RenderEntity 生命周期和稳定帧缓存。移除旧 pixels/texture/internal Sprite，并改造当前通过 Graphics.getFrame 取纹理的 Mask 调用方。

随后补实际 JSB 壳中的 lineJoin/lineCap/miterLimit 与序列化/API，验证 Graphics/Mask 混合与嵌套 stencil、缩放和大尺寸的 GPU 像素对照、半透明描边、线程/极限输入、资源释放，以及逐 API 和批量命令的性能比较。几何相同不证明 shader、上传、裁剪、像素或性能门禁已通过。
