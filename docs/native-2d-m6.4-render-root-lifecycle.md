# M6.4 RenderRoot2D 注册、顺序与生命周期

2026-11-16。本节点修复原生 root 注册的悬空指针、多个 root 的提交状态串扰，以及排序桥接清空原生注册的问题。Canvas 的 Camera/adaptation 行为继续使用现有 JS 实现。

## 实现与所有权

- RenderRoot2D 继承 native Component，使用 TYPE_ID=8 接入 Node 销毁通知，不再维护独立的 Node 裸指针和可能过期的 registered 标志。启停/换 Node 通过当前 Root/Batcher 注册或移除；Root 不存在时安全跳过，重复 enable 可以重试注册。
- Component.setNode 改为 virtual，RenderRoot2D、Sprite、Label、Graphics、Mask 明确 override，避免通过 Component 指针换 Node 时绕过 renderer 的解绑/附加逻辑。此修改影响 C++ vtable，应用和 native 库必须一致重建。
- Batcher 以 unique_ptr 独占每个注册 link。link 是轻量 Component，通过 Node 的非 owning 槽位得到销毁通知；Node 销毁后 link 的 Node 自动变为 null。Node 不拥有 link，注册也不增加 Node 引用。Batcher 销毁时 link 析构从仍存活的 Node 移除自身。
- 重复注册去重、重复移除安全，legacy syncRootNodesToNative 也使用同一带销毁通知的注册表。每次遍历前删除失效 link，并按当前 siblingIndex 排序，平局按注册序稳定决定顺序。std::sort 不使用额外堆缓冲。
- 遍历开始时用可复用 vector 保存本次 root 的 IntrusivePtr 快照，明确只在本次遍历期间拥有 Node；当前 RenderScene 在该 root 提交期间也有临时强引用。回调移除尚未遍历的 root 会跳过它，回调新增 root 到下一次遍历再处理，避免注册 vector 改动使迭代器失效。遍历结束释放这些临时引用。未宣告所有子树/组件回调和渲染线程场景都已完成快照化。
- 无 Scene/RenderScene 的 root 安全跳过。每个 root 提交完成后清除当前 batch 状态和 stencil 状态，避免下一个 root 再次提交上一个 root 的半透明 mesh，或继承其 stencil 层。
- 修复 native Node 的 Scene 借用更新：移到无 Scene 的父节点或脱离父节点时递归清空旧 Scene；父 Node/Scene 析构时，仍被 JS/遍历快照保留的子树也清空 Scene 借用，析构中不触发新的 JS SceneUpdated 回调。新增“脱离 Scene”和“Scene 先销毁但 root 存活”回归在修复前均失败，修复后通过。
- JS Root onLoad 避免重复创建 backend。Web addScreen 去重；JSB sortScreens 只调用原生 sortRootNodes，避免用原生下沉后空的 JS screens 列表覆盖正在工作的注册表。

没有新增 shared_ptr。长期拥有者为 Batcher→unique_ptr<link>；link→Node 为销毁可见的借用，Node→link 为非 owning 槽位；遍历快照→Node/Scene 为限定范围的 IntrusivePtr 强引用。RenderRoot2D 不保存 Batcher 裸指针。

## 已执行验证

- MSVC Debug/Release C++ 与实际 JSB probe 通过。C++ 覆盖去重/排序/重排、重复移除、legacy sync、无 Scene、Node 先销毁、Batcher 先销毁、通用 Component 换 Node、1000 次注册/Node 释放，以及遍历回调中删除/新增 root。另将已注册 root 移到第二个 Scene 后继续遍历，验证使用当前 Scene。
- 独立应用夹具增加 10 个图像捕获：两个半透明 Graphics root 的注册顺序、重排、disable/enable（含重复 onEnable）、销毁，以及两个 Canvas 的启停/销毁。比较器还独立检查中心像素的预期混色，防止两端都重复提交但互相相等。
- 同一快照 `15244fe8aa8033013ccc596187d86ea6643df6802449989cc99d9df82c40390a`：58 个 GPU 捕获全部全通道差值 0；11 项 root 注册计数及已有 19 项命中检查在 Web/native 均符合预期。见 [逐项结果与 RGBA SHA256](./native-2d-m6.4-render-root-lifecycle-results.json)。
- 常规 tsc 和完整 native TS 编译通过。6 个定向 Jest suite 共 16 项通过，覆盖重复 backend 初始化、启停/销毁/迟到调用、Web 注册去重排序、JSB sortScreens 不覆盖注册表，并回归既有 Mask/Graphics/UITransform；元数据/审计/适配器 Node 测试 10 项通过。CI 接入该入口，远端执行仍待验证。

环境仍为 Windows native Debug GLES3/PVRVFrame（host RTX 4080）和 Chrome ANGLE/NVIDIA。完整 native 应用在 Component vtable 改动后进行了 clean rebuild；Debug/Release harness 的 header 依赖扫描正常。

## 构建依赖扫描记录

本轮完整应用最初链接失败，检查发现 GPU Ninja 缓存中的 MSVC showIncludes 前缀乱码，Component.cpp 的 Ninja 依赖记录为 0，头文件修改未触发旧对象重编译。先 clean rebuild 验证 ABI 一致，再将该缓存的 C/CXX 编译器前缀修复为本机编译器实际输出的 `注意: 包含文件:  `，重新配置并再次 clean rebuild。不能只重编译一个链接失败的对象来规避 vtable 不一致。

复用 MSVC/Ninja 缓存前，应核对 CMakeFiles/rules.ninja 的 msvc_deps_prefix 和真实编译输出，并用 ninja -t deps 检查 Component.cpp.obj 包含 Component.h 等依赖；0 依赖不构成有效增量构建证据。本机安装的编译器仍输出中文，单设 VSLANG=1033 未改变输出，不应据此假定英文前缀有效。独立 /Zi probe 还重现了本机 PDB 管理器 C1902，生产夹具继续使用已记录的 /Z7 配置。

当前图像/注册/命中夹具沿用 [GPU 复现步骤](./native-2d-m6.3-graphics-gpu.md#复现)，比较器现在要求 58 图像、11 注册结果和 19 命中结果。原始数据和本机构建日志位于 native/tests/2d-poc/build 忽略目录。

## 保持待验收

本节点证明单 Camera 下多个 root/Canvas 的基础顺序与生命周期，以及 C++ 层跨 Scene 重挂。真实 director 场景切换、多个 Camera 的可见性/顺序/目标窗口组合、嵌套 root、全部回调/渲染线程同步边界、完整资源加载释放和平台矩阵仍待验证。1000 次 plain Node 注册/释放不是 1000 次完整资产/场景加载卸载，也不替代泄漏检测器。

快照仍含工作区已有未提交的 SpriteFrame.native getter；该文件未纳入本节点，已知无 native 属性的旧测试失败仍独立保留。最终 M6 同一候选版本 Gate 未关闭。
