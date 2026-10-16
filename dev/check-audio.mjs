/* ============================================================================
 * dsh-mo-startup-screen — 副官语音素材体检
 * ----------------------------------------------------------------------------
 * 扫描 lib/assets/<阵营>/ 下每个语音槽位，报告：
 *   · 槽位覆盖率（哪些还没放素材，会回落到 TTS / 静默）
 *   · 真实格式（PCM / IEEE float / IMA·MS ADPCM / µ-law / MP3）
 *   · **浏览器可解码性** —— 这是最容易踩的坑：ADPCM 编码的 .wav 在 Chrome / Edge
 *     的 decodeAudioData 里通常解不出来，插件会静默回落到 TTS，听起来像"素材没生效"
 *   · 时长（插件按它决定每一幕停留多久）
 *   · 需要转换时，直接给出 ffmpeg 命令
 *
 * 用法：node dev/check-audio.mjs
 * ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectAudioFile } from './audio-format.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FACTIONS = ['allied', 'soviet', 'epsilon', 'foehn']

/* 期望槽位：从 lib/splash.js 里抓（含图标页 intro），单一事实来源 */
function expectedSlots() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'splash.js'), 'utf8')
  const out = {}
  const factionRe = /\/\* -+ .+? -+ \*\/\s*(\w+): \{/g
  const marks = []
  let m
  while ((m = factionRe.exec(src))) marks.push({ id: m[1], at: m.index })
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].at
    const end = i + 1 < marks.length ? marks[i + 1].at : src.indexOf('/* ---------- 引擎')
    const block = src.slice(start, end)
    /* 期望槽位直接来自阵容定义里的 audio 字段；图标页是静默的（audio: null），不会出现在这里 */
    const slots = [...block.matchAll(/id: '(\w+)', audio: '(\w+)'/g)].map((x) => x[2])
    out[marks[i].id] = slots
  }
  return out
}

/* 格式解析复用 dev/audio-format.mjs（与 fix-audio.mjs 同一套判定口径） */
function ffmpegHint(file, faction) {
  const out = file.replace(/\.(wav|mp3)$/i, '.pcm.wav')
  return `ffmpeg -y -i "${file}" -c:a pcm_s16le -ar 44100 -ac 1 "${out}" && move /Y "${out}" "${file}"`
}

const expected = expectedSlots()
let problems = 0
let missing = 0
let slots = 0

console.log('副官语音素材体检 · lib/assets/<阵营>/')
console.log('')

for (const faction of FACTIONS) {
  const dir = path.join(ROOT, 'lib', 'assets', faction)
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  const want = expected[faction] || []
  const have = (slot) => files.find((f) => f.toLowerCase() === slot + '.wav' || f.toLowerCase() === slot + '.mp3')

  const rows = []
  for (const slot of want) {
    slots++
    const f = have(slot)
    if (!f) {
      missing++
      rows.push({ slot, status: '缺失', detail: '播放时回落 TTS / 静默', warn: false })
      continue
    }
    const full = path.join(dir, f)
    const res = inspectAudioFile(full)
    if (!res.ok) problems++
    rows.push({
      slot,
      status: res.kind,
      detail: res.detail,
      warn: !res.ok,
      file: full,
    })
  }

  const filled = rows.filter((r) => r.status !== '缺失').length
  console.log(`■ ${faction}  （${filled}/${rows.length} 已就位）`)
  for (const r of rows) {
    const mark = r.warn ? '✗' : r.status === '缺失' ? '·' : '✓'
    console.log(`   ${mark} ${r.slot.padEnd(11)} ${r.status.padEnd(5)} ${r.detail}`)
    if (r.warn) console.log(`     ↑ 浏览器大概率解不出来，建议转 PCM：${ffmpegHint(r.file || r.slot + '.wav', faction)}`)
  }
  console.log('')
}

/* 通用建议 */
console.log('─────────────────────────────────────────────')
console.log(`槽位总数 ${slots} · 已就位 ${slots - missing} · 缺失 ${missing} · 需处理 ${problems}`)
if (problems) {
  console.log('')
  console.log('⚠ 有素材是浏览器解不出码的编码（多为游戏原版的 IMA / MS ADPCM）。')
  console.log('  Chrome / Edge 的 decodeAudioData 不支持 ADPCM，开屏时那一段会没有声音。')
  console.log('  → 一条命令批量修好（会自动备份原件）：node dev\\fix-audio.mjs')
  console.log('    或双击「素材修复.cmd」。也可以按上面每行的 ffmpeg 命令单独转。')
}
if (missing) {
  console.log('')
  console.log(`· 还缺 ${missing} 个槽位：缺失的槽位不影响播放，会按配置回落到 TTS 或静默。`)
}
console.log('')
console.log('推荐规格：WAV / PCM 16-bit / 44.1kHz（或 22.05kHz）/ 单声道 / 每句 1.5–4 秒。')
