# M6 字体文件验收目录隔离与失败诊断

## 对照结果

原工作目录的共享冲突可在不调用引擎或 DirectWrite 的控制程序中出现。只执行 Windows CopyFile、关闭与独占打开，前两次原目录对照分别在第 238、592 轮返回错误 32。隔离构建目录与系统临时目录的原始文件对照各完成千轮。第三次原目录对照通过，确认该现象具有间歇性。

带阶段诊断的原生字体探针也在原目录第 735 轮记录到 after-valid-font-release / error=32；失败后查询成功，但当时占用 PID 已为 0。已知读句柄对照能返回本进程 PID。当前证据证明目录相关的共享冲突不需要 DirectWrite 才能发生，具体占用者仍未识别；不能将原目录错误单独归因为 Native 字体持有泄漏。

## 修复边界

字体探针默认将临时字体源文件放在自身程序的构建目录，不再依赖启动目录。CC_M6_FONT_PROBE_DIRECTORY 可显式覆盖目录，保留原目录诊断入口。独占访问标志、首次失败即失败、1000 轮加载／绘制／拒绝无效文件／释放、进程句柄和 GDI 检查均保留，没有加入通过重试。

新增阶段、路径、进程与错误码日志，失败后尽力查询占用 PID。CC_M6_FONT_DIAGNOSTIC_CONTROL 非空时输出已知持有者对照，使用独立 CONTROL 标签。查询只在失败判定或显式对照之后执行，结果不影响门禁。接口依据 [FILE_INFORMATION_CLASS](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/ne-wdm-_file_information_class) 和 [NtQueryInformationFile](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntqueryinformationfile)。

系统临时目录方案曾在原生探针创建文件阶段返回错误 5，尚未执行字体检查；该试跑日志保留。最终选择已验证可写的程序构建目录。Kernel File ETW 因系统权限不足未启动。

## 最终验证

从仓库根目录启动最终程序，Windows Debug／Release 各三轮、合计 6000 个字体生命周期循环通过；每轮均验证已知读句柄仍会使独占检查失败。双配置完整原生测试通过。显式覆盖回原工作目录的入口也经验证，本次该千轮通过，早先失败记录继续保留。

可使用 `run-font-file-isolation-control.ps1 -Repository <引擎根目录> -OutputRoot <独立输出目录>` 复现三个目录的原始文件对照。该脚本是诊断比较工具，其输出不替代 Native 字体门禁。

[结构化证据](../native/tests/2d-poc/build/m6-font-lock-node/summary.json)包含实际程序哈希和所有记录；同目录保留原目录失败、独立目录通过、系统临时目录设置失败及 ETW 权限记录。

本节点只修改 Native 验收夹具与诊断工具，未修改引擎字体实现或 Web。隔离后的文件释放门禁已通过；原目录共享冲突保留为环境诊断，M6 其他终态项和最终候选完整签收继续待办。

## 2026-11-24 候选 c543632b37 复验

用当前 Debug、Release 探针分别在原工作目录连续交替执行三轮，再在各自默认构建目录各执行一轮。八个进程均以 0 退出，合计 8000 个生命周期循环。每个进程故意保留读句柄时都检测到错误 32，实际释放后的独占检查全部通过。32 个检查点的进程句柄与 GDI 对象数均与该进程的基线一致。历史间歇性冲突本轮未复现，占用者仍未确定。[逐轮结果、程序和日志哈希](./native-2d-m6-font-file-recheck-c543632b37.json)
