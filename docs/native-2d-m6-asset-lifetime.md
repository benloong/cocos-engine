# M6 千轮真实资源加载与内存归因

Windows Debug、Release、完整 cocos-m1-test ASan 应用和 Web 分别完成 1000 次 TexturePacker 图集、PNG 和旧 Prefab 加载卸载。每轮检查 5 个缓存资产，每 100 轮执行 GC 和弱引用采样，另有 22 次真实绘图检查。各配置均未观察到崩溃或资产实例累积。[每个二进制和夹具哈希、样本及堆差分](./native-2d-m6-asset-lifetime.json)

在 Windows Debug 诊断主机，第 100 至 1000 轮，未抓快照的运行中 CRT 普通及客户端堆从 29,704,996 B 变为 29,738,151 B，末轮字节数和活跃块数均处于此前采样范围内。每批 500 个被跟踪的旧 wrapper 最多保留 5 个。单独采快照的运行中，V8 自身字节净增 729,176 B，其中 code 类净增 707,328 B；Prefab、SpriteAtlas、SpriteFrame、Texture2D、ImageAsset、Node、Sprite 实例均减少。Debug CRT 采集覆盖共享调试运行库的普通及客户端分配，进程私有字节和 V8 堆单列。

Chrome 第 100 至 1000 轮快照净增 798,296 B，code 类净增 721,212 B。按对象 ID 检查新增的 10 个 RenderData，7 个由 Label 持有，3 个由 Sprite 持有，均可沿节点父链回到 m1-test 活动 Scene。另 9 个 StaticVBChunk 的持有者均为上述 RenderData。全部对象路径记录在结果文件中。

Windows MSVC AddressSanitizer 在完整工程的 1000 轮中未报告内存访问错误，stderr 为 0 字节。Windows 本次使用 ASan、CRT、V8 及引用计数检查，未执行 LeakSanitizer。原生堆快照使用独立测量主机，结果保留各自的应用哈希。场景切换的独立对照见[千轮场景报告](./native-2d-m6.4-scene-matrix.md)。

## 复现

通过 run-m6-static-atlas-stress.ps1 指定 -AppExe 和独立 -LogDirectory 可运行各 Windows 配置。普通 Debug 增加 -CollectV8Heap 即可通过应用自己输出的回环 Inspector 地址读取 V8 堆。若需同时读取 CRT 或取快照，使用 prepare-m6-perf.cjs 注入诊断绑定的候选源，配合 cocos-m1-test 完整原生配置编译 Debug 主机，指定 -HeapSnapshots。抓取第 100 和 1000 轮快照会额外触发 GC。此前一次 Inspector 直接请求快照超时，最终数据通过同一 V8 isolate 的原生 HeapProfiler 取得。

Web 使用 run-dynamic-atlas-web.cjs --static-atlas-stress --heap-snapshots。对两个快照目录运行 compare-static-atlas-heap.cjs，对 Web 目录运行 inspect-render-heap.cjs 取得持有链。compare-m6-asset-lifetime.cjs 汇总这些报告并检查资产存活、CRT 采样、强引用链以及 ASan 输出。
