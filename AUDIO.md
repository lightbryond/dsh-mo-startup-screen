# 副官语音槽位清单（AUDIO.md）

本插件的所有语音都是**占位设计**：把你自己生成的 .wav 文件放进对应目录即可生效，
**无需重启 DSH、无需改代码**（刷新页面后 Host 按文件 mtime 重新下发）。

- 素材目录：`lib/assets/<阵营>/<槽位>.wav`（兼容 `.mp3`，同槽位优先取 `.wav`）
- 下发路由：`/dsh-mo-startup/asset/<阵营>/<槽位>.wav`（逐段白名单校验，只读）
- 素材缺失的槽位**自动回落**到系统 TTS（念的文本 = 下表「推荐台词」），TTS 也不可用则静默，
  动画播放不受任何影响
- 每一步的停留时长 = `max(视觉基准时长, 实际语音时长 + 240ms 收尾)` —— 素材多长，画面就等多久，
  点得再快也不会掐断语音
- 浏览器自动播放策略要求先有一次点击才出声；第一幕若无声，点一次任意确认按钮后即恢复
- **开屏图标页（DeepSeek 标识）刻意保持静默**：那里过去会用人声念「欢迎回来，指挥官」，
  合成音听着突兀，已去掉。将来若要给图标页配语音，需要两处一起改：
  在 `lib/splash.js` 的 `makeIntroScene` 里把 `audio: null` 改成槽位名，并在各阵营目录放同名素材。
  另外：**该槽位没有素材、且这一幕也没写台词时，插件会整幕静默（连提示音都不响）**。

---

## 一、同盟国联军（allied）—— 盟军 EVA 女声

推荐音色：**冷静、清晰、略带金属质感的女声**（参考原版盟军 EVA「Battle control online」）。
语速中偏快，情绪克制，像作战系统而非人类。

| 槽位文件 | 播放时机（画面） | 推荐台词（中） | 参考（EN） |
|---|---|---|---|
| `lib/assets/allied/boot.wav` | 「同盟国联军 · 作战指挥系统」字样浮现 | 指挥官，欢迎回到作战指挥系统。 | Commander, welcome back to battle control. |
| `lib/assets/allied/uplink.wav` | 雷达扫描旋转、亮点浮现「卫星链路建立中」 | 卫星链路建立中，正在同步战区数据。 | Satellite uplink in progress. Syncing theater data. |
| `lib/assets/allied/verify.wav` | 身份卡浮现「指挥官身份核验」（等待确认） | 请确认您的身份，指挥官。 | Commander identity verification required. |
| `lib/assets/allied/chrono.wav` | 充能环 0→100%「超时空传送仪充能」 | 超时空传送仪充能完毕，随时待命。 | Chronosphere charged and standing by. |
| `lib/assets/allied/online.wav` | 战区网格逐块点亮「作战控制连线」（等待确认） | 作战控制已连线。 | Battle control online. |
| `lib/assets/allied/finale.wav` | 终幕「欢迎回来，指挥官」（**可选**，默认无人声） | 欢迎回来，指挥官。祝您武运昌隆。 | Welcome back, Commander. |

## 二、苏维埃联盟（soviet）—— 苏联副官女声

推荐音色：**坚定、有力、带命令口吻的女声**（参考苏联副官「Establishing battlefield control」）。
语速沉稳，句尾加重，可带轻微俄语口音质感。

| 槽位文件 | 播放时机（画面） | 推荐台词（中） | 参考（EN） |
|---|---|---|---|
| `lib/assets/soviet/alarm.wav` | 红光闪烁 + 警报条纹「战 斗 警 报」 | 战斗警报！全体就位。 | Combat alert! All units to stations. |
| `lib/assets/soviet/control.wav` | 斜切分段进度条填充「建立战场控制」 | 正在建立战场控制。 | Establishing battlefield control. |
| `lib/assets/soviet/verify.wav` | 红星身份卡「将军同志身份确认」（等待确认） | 请确认身份，将军同志。 | Identification required, comrade general. |
| `lib/assets/soviet/factory.wav` | 双齿轮旋转 + 产量计数「战争工厂全速运转」 | 战争工厂已全速运转。 | War factory at full production. |
| `lib/assets/soviet/curtain.wav` | 五枚六边形脉冲「铁幕装置充能完毕」 | 铁幕装置充能完毕。 | Iron curtain fully charged. |
| `lib/assets/soviet/finale.wav` | 终幕「欢迎回来，将军同志」（**可选**） | 欢迎回来，将军同志。祖国需要您。 | Welcome back, comrade general. |

## 三、厄普西隆军（epsilon）—— 厄普西隆副官

推荐音色：**低沉、缓慢、带混响的耳语感声线**（男女皆可，偏中性更佳），
像直接在听者脑内响起，情绪是平静的蛊惑。

| 槽位文件 | 播放时机（画面） | 推荐台词（中） | 参考（EN） |
|---|---|---|---|
| `lib/assets/epsilon/beacon.wav` | 同心波纹自中心扩散「心灵信标已启动」 | 心灵信标已启动。 | Psychic beacon activated. |
| `lib/assets/epsilon/link.wav` | 凝视之瞳睁开「接入心灵网络」 | 你的思想，正在接入网络。 | Your mind is joining the network. |
| `lib/assets/epsilon/will.wav` | 信徒身份卡「确认异教意志」（等待确认） | 证明你的忠诚，异教。 | Prove your devotion, proselyte. |
| `lib/assets/epsilon/dominator.wav` | 波形柱群起伏「心灵支配仪充能中」 | 心灵支配仪充能中。 | Psychic dominator charging. |
| `lib/assets/epsilon/master.wav` | RGB 故障抖动大字「尤里即是主宰」 | 尤里即是主宰。 | Yuri is master. |
| `lib/assets/epsilon/finale.wav` | 终幕「欢迎，异教 / YURI IS WATCHING YOU」（**可选**） | 欢迎，异教。尤里注视着你。 | Welcome, proselyte. Yuri is watching you. |

## 四、焚风反抗军（foehn）—— 焚风 AI 副官

推荐音色：**中性、冷静、带轻微电子合成感的 AI 声线**（沃克网的人格化）。
语速均匀，咬字精准，无明显情绪起伏。

| 槽位文件 | 播放时机（画面） | 推荐台词（中） | 参考（EN） |
|---|---|---|---|
| `lib/assets/foehn/signal.wav` | 风向流线掠过「捕获加密信号」 | 捕获加密信号，正在解析。 | Encrypted signal acquired. Decoding. |
| `lib/assets/foehn/volknet.wav` | 六边形蜂格级联点亮 + 数据瀑布「接入沃克网」 | 沃克网连接已建立。 | Volknet connection established. |
| `lib/assets/foehn/sync.wav` | 神经直连身份卡「指挥官神经同步」（等待确认） | 准备神经同步，指挥官。 | Prepare for neural sync, commander. |
| `lib/assets/foehn/nano.wav` | 纳米粒子向核心汇聚「纳米同步完成」 | 纳米同步完成。 | Nanomachine synchronization complete. |
| `lib/assets/foehn/winds.wav` | 风带掠过「焚风已起」 | 焚风已起。 | The winds have risen. |
| `lib/assets/foehn/finale.wav` | 终幕「欢迎，指挥官」（**可选**） | 欢迎，指挥官。焚风与你同在。 | Welcome, Commander. |

---

## 五、通用建议

1. **格式（最重要）**：`.wav` 优先，且**必须是 PCM 16-bit**（44.1kHz 或 22.05kHz、单声道最佳）；
   `.mp3` 也支持，同槽位 `.wav` 优先。
   ⚠ **不要用 ADT/ADPCM 编码的 wav**（IMA ADPCM / MS ADPCM，codec 17 / 2）：
   浏览器 `decodeAudioData` 通常解不出来，插件会**静默回落到 TTS**，听感上像"素材没生效"。
   先体检、再修复：
   ```sh
   node dev\check-audio.mjs   # 或双击 素材体检.cmd：逐槽位列出格式与可解码性
   node dev\fix-audio.mjs     # 或双击 素材修复.cmd：批量转成 PCM（原件自动备份）
   ```
   修复工具会把原件备份到 `lib/assets/_converted-backup/<阵营>/`，可反复运行；
   也可以按体检给出的单条 ffmpeg 命令自己转：
   ```sh
   ffmpeg -y -i in.wav -c:a pcm_s16le -ar 22050 -ac 1 out.wav
   ```
   **注意**：素材"存在但解不了码"时，插件不会用 TTS 顶替，而是保持静默并在控制台
   指出是哪个文件 —— 避免听起来像"配错了台词"。
2. **时长**：每句建议 1.5–4 秒。画面会等语音播完再推进，过长的素材会拖慢整个序列。
3. **响度**：各槽位响度尽量一致（建议统一归一化到 −16 LUFS 左右），避免忽大忽小。
4. **终幕（finale.wav）默认留空**：四阵营终幕默认只有画面与和声钟，不播人声（致敬参考片）。
   想让副官念欢迎词，放入对应阵营的 `finale.wav` 即可；台词里如要包含玩家在设置页填的
   指挥官名称，请在生成语音时把名字念进去。
5. **界面音效不需要素材**：打字机滴答、确认音、警报、风声等全部由 WebAudio 现场合成。
6. **check 工具**：`node dev\check-audio.mjs`（或双击 `素材体检.cmd`）逐槽位报告
   覆盖率 / 真实编码 / 浏览器可解码性 / 时长，并在需要时给出转码命令。
7. **检查哪些槽位已就位**：DSH 设置页 →「开屏动画 · 心灵终结」→「副官语音」分组底部，
   会列出当前阵营已检测到的素材文件；也可直接访问
   `http://127.0.0.1:3080/dsh-mo-startup/assets-manifest` 查看四阵营完整清单。

---

## 六、当前素材状态（2026-10-16）

| 阵营 | 已就位 | 说明 |
|---|---|---|
| 同盟国联军 allied | 6/6 | 全部 PCM 16-bit；早期 3 个 IMA ADPCM 文件已转换（备份在 `lib/assets/_adpcm-backup/allied/`）。 |
| 苏维埃联盟 soviet | 6/6 | `control / curtain` 原为游戏原版的 IMA ADPCM，**已用 `fix-audio` 转成 PCM 16-bit**（备份在 `lib/assets/_converted-backup/soviet/`）。 |
| 厄普西隆军 epsilon | 6/6 | `master` 为 MP3（可直接解码），其余为 PCM。 |
| 焚风反抗军 foehn | 6/6 | 全部 PCM 16-bit。 |

**24 个槽位全部就位、全部可被浏览器解码**（`node dev\check-audio.mjs` 应显示「需处理 0」）。
以后导入新的游戏原版语音后，建议固定跑一次「素材体检 → 素材修复」。

随时用 `node dev\check-audio.mjs` 复查（缺失的槽位不影响播放，会按配置回落 TTS / 静默）。
