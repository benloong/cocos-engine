# M6.2 斜体描边的几何顺序

> 2026-11-17。修复斜体字形与描边同时斜切的问题；严格像素门禁仍未通过。

前一实现先对 regular 字形 Widen，再斜切整个描边环。这会使笔宽和圆角也随字体倾斜变形。现在仅在 italic stroke 路径先创建字形的斜切 geometry，再 Widen；后续世界坐标和采样变换只做平移/缩放，避免重复斜切。填字、普通字和粗体路径保持原实现。

新增 transformed geometry 由局部 ComOwner 持有；strokePath 是局部同步借用，拥有者晚于使用结束释放。沿用同一 Draw 的 COM lease 和裁剪 mask，不增加持久缓存或 shared_ptr。

## 验证

- 原始 72 例重新生成 Debug/Release，全部逐字节一致；Web 使用前一节点同字体、参数、浏览器的原始捕获。24 个斜体用例最大通道差值全部下降，没有升高用例；另外 48 个普通/粗体 native 捕获 SHA256 保持相同。
- 白色拉丁 round stroke 四个字号最大差值：85/101/87/88 → 50/72/49/62。24 例斜体的不同像素总数为 20,014 → 10,198，严格阈值仍为 ≤1，故仍 **0/72** 通过。
- Windows Debug/Release 完整 native harness 和实际字体 JSB 探针通过，包括粗斜体 viewport crop 逐字节对照、join、无效线宽、默认值、24 个填字 Web golden、STA lease 和 1000 次字体绘制释放循环。GDI 对象均为 10→10，句柄分别为 363→363、361→361。native 边界静态测试 10 项通过。

原始数据与前后逐例比较见 [结果](./native-2d-m6.2-ttf-italic-stroke-results.json)。日志为 build/ttf-italic-stroke-*；复现工具参数沿用 [描边节点](./native-2d-m6.2-ttf-stroke.md)。本轮没有重跑完整 GPU 应用和 ASAN，不沿用历史快照声称当前候选版本通过。

剩余曲线细分、轮廓扩张、边缘覆盖、颜色/半透明取整、粗体描边、其他字体/平台及性能/生命周期门禁继续按 M6 计划验收。
