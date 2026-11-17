# M6.2 Windows 自定义字体原生描边

> 2026-11-17。自定义字体的 Label Outline 已接入真实轮廓描边；严格视觉门禁仍未通过。

## 实现与所有权

DirectWriteFont 新增 stroke，复用 regular shaping、字形轮廓、D2D Widen、裁剪 mask 和 FIR/预混合管线。描边只绘制轮廓环，不与实心字形 union；填充仍由独立 draw 完成。支持 round、miter、bevel，拒绝非正数及非有限线宽。

Canvas 增加默认返回 false 的 supportsTextStroke 能力查询，Windows 私有 DirectWrite 字体返回 true。Label 在支持时使用两倍 outlineWidth 的 round stroke 后填字；GDI 与其他平台继续使用既有偏移填字回退。Windows Canvas 初始化为黑色、线宽 1、miter、left/alphabetic，非法线宽保留旧状态。

临时轮廓由同步 Draw 的 unique_ptr rasterizer 管理；COM 引用分别由 ComOwner 持有，mask 由 vector 值持有，shape 指针只借用局部 geometry。COM apartment lease 沿用前一节点的配对释放，没有新增 shared_ptr、跨帧 JS 镜像或逐字形 JSB 调用。

## 验证与限制

- Windows Debug/Release 完整 native harness 和实际字体 JSB 探针通过。新增空心内部、线宽响应、join 区别、无效线宽、部分离屏裁剪及 Canvas 默认值测试；保留 24 个普通/斜体 Web RGBA 校验值。
- 1000 次真实字体创建/测量/绘制/释放循环中增加 250 次 stroke。GDI 均为 10→10，Debug/Release 句柄分别为 363→363、361→361；STA 调用方 lease 保持不变。
- 4 个 Jest suite、49 项及 10 项 native 边界静态测试通过。下一字号校验节点另有 7 suite、68 项与 Debug/Release 实际 JSB 复验。
- 原始描边矩阵覆盖四个字号、普通/粗体/斜体，以及三种 join、填充叠加、红色和半透明泰文：72 例 Debug/Release 字节一致，但严格 Web 对照 **0/72**。面积相近不能代替像素通过。
- 完整应用快照 `cb28128dc7d54cfedaa2e8ae4d5a2d1efcf8e758d5fe51231af2a04297d5ab5c`：布局 12/12，严格图像仍 9/12。outline 最大差值 122→30，不同像素 202；bold 20、nested 47，均仍失败。
- 普通 Debug 与 ASAN 的 12 张 RGBA 和 manifest 逐字节一致，ASAN stderr 为 0 字节，真实字体加载/释放标记通过。该 GPU 快照早于独立字号校验提交 69624e043e，不能视为当前完整候选版本验证。

原始数据见 [结果](./native-2d-m6.2-ttf-stroke-results.json)。复现沿用 [Canvas 对照](./native-2d-m6.2-ttf-preblend.md) 和 [完整 GPU 应用](./native-2d-m6.2-richtext-gpu.md#复现)。原始工具新增末尾 mode 参数：stroke-round、stroke-miter、stroke-bevel、outline；Web runner 使用相同 mode。日志为 build/ttf-stroke-*。

剩余：轮廓扩张/栅格覆盖差异、粗体描边、灰色 RGB、RTL/sideways、其他字体/平台、性能和完整资源生命周期。未重跑 Graphics 74 例；已有 SpriteFrame.native 改动仍未纳入提交，此节点不作为 M6 最终候选验收。
