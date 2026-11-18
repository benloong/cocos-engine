# M6.1 原生 UI 组件自动合图

> 下述双端打包数据来自禁用前的候选。当前 JSB + Native 运行时暂停动态图集，按[统一验收流程](./native-2d-build-and-acceptance.zh-CN.md)检查源纹理路径。

原生 Sprite 启用和换帧时尝试打包，Sprite stencil Mask 在启用、换帧或切换到 Sprite stencil 时尝试打包，位图 Label 在启用及切换字体来源时尝试打包。调用同一动态图集管理器，保留其启用状态、可打包性、纹理格式及容量约束。图集页管理、纹理上传和恢复沿用现有实现。平台默认仍由 CLEANUP_IMAGE_CACHE 决定，保留原始图片并启用管理器才会尝试打包。原生消费者根据 SpriteFrame revision 读取变更，组件没有新增 update 或 lateUpdate，也没有为自动合图引入新的原生指针所有权。

双端真实 M4 夹具在图集启用后检查非活动节点，随后激活 Sprite、Sprite stencil Mask 和 BitmapFont Label，等待正常组件路径让各自的帧入图集。三个组件切换资源后共享同一源纹理的上传，关闭动态图集恢复所有原图。夹具没有直接请求打包这些帧，两端都必须记录 M6_ATLAS_AUTOMATIC_PASS。另保留原有 100 份 Sprite、Mask、BitmapFont 和 LabelAtlas 像素对照。

本节点覆盖已有可上传纹理的组件生命周期和属性更新入口。图集运行时重新启用后静止组件的回补、已绑定纹理迟到加载、资产内部直接换帧、场景切换压力测试，以及上传和页面策略是否下沉仍保留在 M6。全模块运行时 JSB 计数属于终态门禁。

首次 Windows 串行运行在 M5 完成标记前发生一次 GLES3 绘制状态绑定异常。同一构建复核捕获到另一个明确的问题，M4、M4 extra 与 M5 的计时器可以让 Camera 借用重叠，导致随后尝试恢复已销毁的 RenderTexture。夹具现在等待前一项归还 Camera 后再借用，保留原超时及全部断言。暂未证明首次 GLES3 异常与该问题同源。

验收按[统一流程](./native-2d-build-and-acceptance.zh-CN.md)执行。

最终候选完成 Windows 与 Web CLI、NATIVE override、资源同步和 Windows Debug 编译。完整串行门禁、37 项定向 Jest 和 100 份逐字节一致的图像对照均通过。M5 用时 39.95 秒，预算 45 秒。

## JSB + Native 暂停运行时合图

JSB 和 NATIVE 同时为真时，动态图集管理器保持关闭。单例和独立实例一律适用。原生 Sprite、Mask 和 Label 直接提交当前资源，Web 继续走原有合图路径。预制 SpriteAtlas 和字体自带图集仍按资产加载。

Windows Debug 的 M4 探针覆盖活跃组件换资源、显式启用、插入、打包和重置。管理器必须保持零页，SpriteFrame 的纹理与 UV 必须保持原值。Web 继续检查自动打包、回退、帧所有权和恢复。位图字体保留 GPU 源纹理绑定、布局和大字形分块检查。对照工具用同候选的 Web 原图验证原生在尝试启用与重置后的像素。

统一验收在同一候选上完成 Windows/Web CLI、NATIVE override、Windows Debug 编译和 M0、M2–M5、M6.1 UV 门禁。37 项定向 Jest 和实际 JSB 壳探针通过。12 组 Sprite/Mask、12 组位图字体源纹理及 76 组布局像素逐字节一致。M5 用时 40.12 秒，预算 45 秒。
