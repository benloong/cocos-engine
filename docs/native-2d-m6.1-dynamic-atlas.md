# M6.1 SpriteFrame 动态合图状态与上传

> 2026-11-17。本节点补齐 native SpriteFrame 的打包/恢复状态及真实动态图集内存图片上传。完整 M6 仍未收口。

## 实现与所有权

SpriteFrame 在 native 中保存打包前的纹理、rect x/y 与有效标志。活动图集纹理和原图均由帧的 IntrusivePtr 持有；reset 恢复原图并释放备份，copyFrom 同时复制打包状态。两次转换都增加 revision，让既有 Sprite/Mask 消费者在不重新赋值 spriteFrame 的情况下更新纹理与 UV。未打包时 reset 不修改 revision。没有新增 shared_ptr，也没有在 JS 保存另一份权威原图状态。

JSB prototype 补齐 original 查询、_setDynamicAtlasFrame 和 _resetDynamicAtlasFrame，UV_UPDATED 沿用已有事件桥接。仍没有 SpriteFrame.native property。原生测试覆盖 1000 次打包/恢复、独立 clone、覆盖旧备份和直接析构的纹理引用恢复，以及实际 JSB 方法转换。

Web Mask 的 Sprite stencil 创建/刷新时漏写 alphaThreshold：组件值为 0.1，实际 uniform 却为 0.5。已在材质刷新后同步当前值，并补默认值与重建实例回归；修复后 GPU 读回为 0.10000000149011612。此项修正公开属性与实际绘制不一致，不将 native 改成错误默认值。

真实管理器探针发现 DynamicAtlasTexture 把 RGBA8888 内存图片的 TypedArray 送入 copyTexImagesToTexture，JSB 图片适配层记录转换失败，图集像素为空。现对内存视图使用 copyBuffersToTexture，保留视图 byteOffset/byteLength；DOM/native 图片继续使用图片上传入口。Jest 覆盖偏移视图、区域和两种上传入口。

## 测试工程与诊断

按 [统一流程](./native-2d-build-and-acceptance.zh-CN.md) 构建 cocos-m1-test。M4 探针创建局部 DynamicAtlasManager，真实 packToDynamicAtlas、纹理边缘扩展与 manager.reset；覆盖 Sprite、SPRITE_STENCIL Mask × REPEAT/CLAMP × 原图/打包/恢复，共 12 份 RGBA；检查打包/恢复状态、独立 clone 和全部恢复帧字节，CLAMP 打包帧还要求与原图完全一致。REPEAT 下的跨边采样会随图集边缘扩展变化，必须用同候选 Web/native 原始帧按计划通道容差 1 逐字节比较，而非假定每种 wrap 在打包前后都不变。原有 M4 几何/像素阈值保持不变。

手工纹理诊断曾漏掉图集边缘扩展，Mask 打包时有 82 个通道差异、恢复为 0；已改用生产管理器，没有放宽比较阈值。生产管理器在修复上传前，Sprite/Mask 分别有 6400/3360 个通道不同，日志明确记录图片转换失败。同步 Web 的正确阈值后，Web 也复现 REPEAT Mask 的 80 个通道变化，CLAMP 与所有恢复帧为 0。Web 全局自动合图在探针期间关闭后恢复，局部管理器独占测试帧；Web 外部显式打包按 assembler 契约刷新数据，native 只依靠 revision。Mask 赋帧后明确设回 80×80，避免 Web TRIMMED Sprite 自动改成 64×64。最终结果以同候选完整门禁和 12 份两端原始 RGBA 为准，见 [验收数据](./native-2d-m6.1-dynamic-atlas-results.json)。

本轮首次 CLI 调用工作目录错误，污染了测试工程的脚本派生缓存，后续构建将 M1Test 序列化为 null。已将该工程 targets 缓存可逆移到同级备份，从 cocos-cli 重新构建并确认生成场景保留正确脚本 UUID；源场景未修改。该问题与排查方法已补入统一文档。

## 验收结果与稳定性记录

文档工程已构建并同步当前 override。各门禁的最后一次执行均通过：M0 包含 M2/M3 应用检查与 8 suite/33 tests；独立 M2、M3、M4、M4 extra、M5、UV（1 项）与定向 Jest（6 suite/32 tests）通过。原生帧所有权 1000 次循环与实际 JSB 探针通过。12 份原始 RGBA 的 native/Web SHA256 全部相同，最大通道差值 0；没有新增视觉容差。

完整串行运行曾在 M5 阶段两次缺失完成标记（45 秒预算），后续保持预算和全部断言重跑通过。此前未采集原生退出码，固定临时 stdout 又被后续运行覆盖，不能据此宣称崩溃或确定根因。脚本现补提前退出码诊断；该间歇问题单列 M6 稳定性待办，不宣称单次完整串行运行已经稳定通过。

验收使用工作区既有的六份测试入口 cwd 修正，未并入本节点提交；其内容 SHA256 随验收数据记录。捕获使用 80ms 稳定窗口，native 渲染不派发 JS Director.AFTER_DRAW，因此本轮不作为帧事件 parity 的证据。Win32 FileUtils 使用 app 默认资源根的绝对捕获目录，入口清除旧的已知文件并要求 12 份新输出。

## 未关闭边界

此节点不代表动态合图整体下沉完成：manager/Atlas 排布仍在现有 JS 路径；native 自动触发打包、Label/BMFont 联动、压缩/不可打包来源、其他原始像素格式、图集满回退、场景切换与异步资源/延迟销毁、packed clone 跨图集销毁及其他平台仍需逐项验收。mesh/vertices API、真实旧资源/Prefab 和 M6 性能门禁继续待办。original 的完整可写对象兼容性也须与整个 SpriteFrame API 一并验收。
