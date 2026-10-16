/* ============================================================================
 * 语音素材批量修复：把浏览器解不了码的音频转成 PCM 16-bit
 * ----------------------------------------------------------------------------
 * 为什么需要：游戏原版语音常是 **IMA / MS ADPCM** 编码的 .wav，Chrome / Edge 的
 * decodeAudioData 解不出来 → 开屏时那一段就没有声音（插件不会用 TTS 冒充）。
 * 这个脚本把这类文件用 ffmpeg 转成标准 PCM 16-bit，原件会备份，可反复运行。
 *
 * 用法：
 *   node dev/fix-audio.mjs                 # 扫描四阵营，转换所有需要处理的文件
 *   node dev/fix-audio.mjs --dry-run       # 只看会改哪些文件，不动手
 *   node dev/fix-audio.mjs --faction soviet
 *   node dev/fix-audio.mjs --rate 44100    # 指定采样率（默认沿用原采样率）
 *
 * 备份位置：lib/assets/_converted-backup/<阵营>/<文件名>
 * ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { inspectAudioFile } from './audio-format.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FACTIONS = ['allied', 'soviet', 'epsilon', 'foehn']
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const only = (() => {
  const i = args.indexOf('--faction')
  return i >= 0 ? args[i + 1] : null
})()
const rate = (() => {
  const i = args.indexOf('--rate')
  return i >= 0 ? Number(args[i + 1]) : 0
})()

function findFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (probe.status === 0) return 'ffmpeg'
  /* 退化到常见安装位置 */
  for (const p of ['D:/C language/ffmpeg-8.1.2-essentials_build/bin/ffmpeg.exe']) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const ffmpeg = findFfmpeg()
if (!ffmpeg) {
  console.error('✗ 找不到 ffmpeg。请先安装并加入 PATH（或放到 D:/C language/ffmpeg-*/bin/）。')
  process.exit(1)
}

console.log('语音素材修复 · 目标：全部转成 PCM 16-bit')
console.log('ffmpeg:', ffmpeg)
if (dryRun) console.log('（--dry-run：只报告，不修改文件）')
console.log('')

let fixed = 0
let skipped = 0
let failed = 0

for (const faction of FACTIONS) {
  if (only && faction !== only) continue
  const dir = path.join(ROOT, 'lib', 'assets', faction)
  if (!fs.existsSync(dir)) continue
  const files = fs.readdirSync(dir).filter((f) => /\.(wav|mp3)$/i.test(f))
  const rows = []

  for (const f of files) {
    const full = path.join(dir, f)
    const res = inspectAudioFile(full)
    if (res.ok) { skipped++; continue }
    rows.push({ f, res })
  }

  if (!rows.length) { console.log(`■ ${faction}  无需处理`); continue }
  console.log(`■ ${faction}`)
  for (const { f, res } of rows) {
    const full = path.join(dir, f)
    console.log(`   · ${f.padEnd(14)} ${res.kind}  ${res.detail}`)
    if (dryRun) continue

    /* 1) 备份原件 */
    const backupDir = path.join(ROOT, 'lib', 'assets', '_converted-backup', faction)
    fs.mkdirSync(backupDir, { recursive: true })
    const backup = path.join(backupDir, f)
    if (!fs.existsSync(backup)) fs.copyFileSync(full, backup)

    /* 2) ffmpeg 转 PCM 16-bit：沿用原采样率与声道数（可用 --rate 覆盖） */
    const tmp = path.join(dir, f.replace(/\.(wav|mp3)$/i, '') + '.pcm.wav')
    const ffArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-i', full, '-c:a', 'pcm_s16le']
    if (rate) ffArgs.push('-ar', String(rate))
    ffArgs.push(tmp)
    const r = spawnSync(ffmpeg, ffArgs, { encoding: 'utf8' })
    if (r.status !== 0 || !fs.existsSync(tmp)) {
      failed++
      console.error('     ✗ 转换失败：' + (r.stderr || '').trim().split('\n').slice(-1)[0])
      continue
    }
    fs.renameSync(tmp, full)
    const after = inspectAudioFile(full)
    if (after.ok) {
      fixed++
      console.log(`     ✓ 已转为 PCM：${after.detail}`)
    } else {
      failed++
      console.error('     ✗ 转换后仍不可解码：' + after.detail)
    }
  }
  console.log('')
}

console.log('─────────────────────────────────────────────')
console.log(`已转换 ${fixed} 个 · 本来正常 ${skipped} 个 · 失败 ${failed} 个`)
if (fixed && !dryRun) {
  console.log('原件已备份到 lib/assets/_converted-backup/<阵营>/')
  console.log('刷新页面（或重启桌面端）即可听到修复后的语音。')
}
if (failed) process.exit(1)
