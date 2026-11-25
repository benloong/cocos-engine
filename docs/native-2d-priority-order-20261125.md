# Windows 2D 渲染器动态 priority 复验

2026-11-25，`cocos-m1-test` 的 Windows Debug 和 Release 均通过。引擎修复为 `de98ba9203`，像素门禁为 `6be4139b72`。三个 JSB 壳保留基类的 priority 读写，并在原生组件存在时将新值传给实际提交渲染实体的组件。加载前设置的值继续在 onLoad 同步。

## 实际渲染顺序

同一活动场景中，红色被测组件和蓝色参照矩形保持相同位置及兄弟顺序。蓝色参照的 priority 固定为 20。被测组件加载前设为 10，加载后依次改为 30、10。每次等两个帧边界，再从 RenderTexture 回读。下面三阶段分别统计符合预期的蓝色遮挡、红色前景、恢复蓝色的采样点数。

| 组件 | 采样点 | 修复前 Release | 修复后 Debug | 修复后 Release |
|---|---:|---|---|---|
| Sprite | 4096 | 4096 / 0 / 4096 | 4096 / 4096 / 4096 | 4096 / 4096 / 4096 |
| Label | 331 | 331 / 0 / 331 | 331 / 331 / 331 | 331 / 331 / 331 |
| Graphics | 4096 | 4096 / 0 / 4096 | 4096 / 4096 / 4096 | 4096 / 4096 / 4096 |

门禁要求每个组件至少有 32 个可辨认的红色前景采样点，并且所有采样点在三个阶段均符合预期。前景参考由蓝色矩形以已知低优先级绘制在红色组件背后得到，提高 priority 后逐点比较 RGBA 四个通道。首次试跑中，用纯红阈值判断蓝底字形会将 65 个抗锯齿采样点判错，最终门禁使用同背景合成参考。负对照使用相同的最终场景脚本和修复前的 Release 引擎，三个组件在提高 priority 后的匹配数均为 0。

测试工程裁剪了可选的 Sorting2D 组件，夹具在本场景内启用与 Sorting2D 相同的原生批次排序队列，用完后恢复。被测对象均通过公开的 `renderer.priority` 修改。门禁集成在 [M4 Windows 应用运行器](../native/tests/2d-poc/run-m4-mask-probe.ps1)中，使用新包运行该入口即可复验。[像素场景](../native/tests/2d-poc/fixtures/acceptance/PriorityOrderProbe.ts)

## 构建与回归

- 从 cocos-cli 目录对 `cocos-m1-test` 运行 Windows build，重新生成 Native override，然后用 CMake 增量编译 Debug 和 Release。最终的 ccbuild 已输出 `CCBUILD_DONE` 并生成产物，其 Node 进程仍驻留，核验产物后结束该进程并接续 CMake。两个配置的 43 个资源文件均与最终导出逐文件匹配。Debug 使用本轮对象重新链接并关闭启动器的远程调试，Release 使用常规可执行文件。
- 双配置各通过 M2 Sprite、M3 Label、M4 Mask、M4 Extra、M5 RichText 五个应用入口。M5 均自然退出 0。每个配置的 12 张图集和 92 张字体 RGBA 捕获均与既有基准一致。[应用结果](./acceptance/native-2d-20261125/app-results.json)
- 真实组件的调用记录确认两种配置下，Sprite、Label、Graphics 加载时均收到初始值 3，加载后均收到新值 100。Native TS 编译、像素夹具类型检查、三个定向 Jest 套件共 32 个用例均通过。[Debug 调用记录](./acceptance/native-2d-20261125/public-api-Debug.json) · [Release 调用记录](./acceptance/native-2d-20261125/public-api-Release.json)
- 整体验收仍有独立阻断。单参数 UITransform 中心点命中、默认 Mask.isHit 和 Graphics.impl 的既有失败仍可复现。M0 更新审计基线后通过 175 项 C++ 检查，仍在位图字体 U+1F642 的宽度对照失败，Native 为 8.5，Web 为 0。

| 最终产物 | SHA-256 |
|---|---|
| 双配置引擎 cc.js | `37bf2c12bcfebcc43607943be49bd9f9fca03c98af6460c0741029ca5736b139` |
| 双配置与负对照场景脚本 | `ece7f9bbe420a45fd7e5d04e33c4ee72a49e8b5f1ee46d224cc5db4869d6a05b` |
| 负对照引擎 cc.js | `ba82afe94c1ffab33a452a99e663f5b0395f9eba9dfdb9a962905b64b0e7f22f` |
| Debug 测试可执行文件 | `dfa84e02a1a0af320d812789a76b5655c22cbc691d10b047419660ea88ec872e` |
| Release 测试可执行文件 | `8c514284c554110e53fa4231e24adb2e354fbcbb0c2159b4df3f2f270d820d78` |

归档含 275 个文件。`priority/` 保存本次运行的构建与应用日志、旧引擎负对照，以及 Debug 和 Release 各 104 份图集与字体 RGBA 捕获；`before-priority/` 保存修复前整体验收的总门禁、性能、公开接口和资源压力记录。ZIP 解压后的每个文件已与原始产物逐一核对 SHA-256。归档 SHA-256 为 `d38cef4dc025e774a0c0f8ec65d98dc4b6db42bace29a850eff7eaaa9e99f62c`。[三组遮挡采样结果](./acceptance/native-2d-20261125/priority-pixels.json) · [Windows 验收产物](./acceptance/native-2d-20261125/windows-evidence.zip)
