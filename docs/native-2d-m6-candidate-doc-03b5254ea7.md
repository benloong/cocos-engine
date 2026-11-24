# M6 候选文档工程 Native 子项复验

2026-11-24。实现候选 `03b5254ea7` 的文档应用 Debug、Release 选定检查通过；所有尝试并非全通过，首轮 Debug M5 超时继续留档，M6 整体仍未签收。

## 通过项

两种配置分别通过 M2 五模式 Sprite 像素与材质实例、M3 Label 字体与原生图集策略、M4 Mask、M4 Extra 和 M5 RichText 检查。M5 仍使用原 45 秒预算：Debug 串行重验为 41.68 秒，Release 为 40.14 秒；完成前进程均存活，RichText 为 10 段、9 Label、1 Sprite。没有改动像素期望、阈值或夹具工作量。

两配置各完成 1000 轮静态图集加载释放、5000 项资产断言、22 项 GPU 检查与 11 个包装对象/内存采样。采样中的非初始批次均为 5/500 个包装对象存活；私有内存原始值在结构化证据中保留，不作为完整 Native 泄漏证明。

Native 定向 Jest 为 17 套件、127 项通过、13 项排除或跳过，包含近期 Label、Graphics、Mask 新增回归。Native 审计/元数据工具测试 13 项通过，元数据一致性检查通过。原 M0 入口中的 Web 混合套件未运行，本报告只记录 Native 子项。

## 来源

文档程序 Debug、Release 均从当前 Native 源码重新增量编译、生成绑定并链接。CLI 资源复用上一独立文档工程；六份文档探针与当前受版本管理夹具逐份文本一致，来源哈希已归档。本轮没有重新执行 CLI 导入或从空目录重编。

部署的 Native 包来自上一核心节点的干净源码构建，cc.js SHA-256 为 `95483396adbc0d44adf33aa34e630f339ec4312ed525a799acf5592f887f1d2a`，与 RichText 及核心应用节点一致。二进制、部署包、编译日志、原始应用报告和夹具来源均记录哈希。

新增 `run-m6-candidate-doc.ps1` 将部署和探针执行串联；隔离探针只补 Hidden 启动和进程句柄缓存，没有修改测试条件。两次入口准备错误（重复 WindowStyle、漏带静态 golden JSON）单独保留，修正后在新目录重新执行。

## 保留的失败与剩余边界

Debug 首轮 M5 在 45.37 秒被预算终止，终止前进程仍存活，日志刚进入 RichText 阶段。当时 Native Jest 并发运行；去除并发后的定向重验通过，但不能仅凭先后关系归因并发或宣布稳定性已经解决。结构化结果明确区分 `selectedChecksPassed: true` 与 `allRecordedAttemptsPassed: false`。

[完整证据与通过/失败记录](./native-2d-m6-candidate-doc-03b5254ea7.json)。原始产物位于 `native/tests/2d-poc/build/m6-doc-03b5254ea7/`：`checked` 保留 Debug M2–M4 和首轮 M5 失败，`serial-Debug-m5` 为串行重验，`release` 为 Release 完整组，`validation.json` 为选定检查汇总。

连续启动矩阵、此前提前退出的原因、其余 API/资源边界及最终总签收继续待办。未修改 Web、SpriteRenderer、ModelRenderer 或用户已有改动。
