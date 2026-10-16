/* ============================================================================
 * dsh-mo-startup-screen — 背景档位映射单测（不需要浏览器）
 * ----------------------------------------------------------------------------
 * 用最小 DOM 桩把 lib/splash.js 跑起来，断言：
 *   配置 backdrop / veilOpacity → 根节点上的 data-backdrop 与 --veil-alpha 是否正确
 * 这是「开屏被应用界面透出干扰」这个问题的回归测试。
 *
 * 用法：node test/backdrop.test.mjs
 * ========================================================================== */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installDom } from './dom-stub.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
installDom()
let failures = 0
let inBrowser = false

function ok(cond, label) {
  if (cond) console.log('  ✓ ' + label)
  else { failures++; console.error('  ✗ ' + label) }
}

/* ---------- 逐个档位验证 ---------- */
const CASES = [
  { backdrop: 'solid', veilOpacity: 1, expect: '1', why: '默认档位：完全不透明，应用界面不可见' },
  { backdrop: 'solid', veilOpacity: 0.3, expect: '1', why: 'solid 档强制不透明（防止配置漂移把界面透出来）' },
  { backdrop: 'soft', veilOpacity: 0.93, expect: '0.93', why: 'soft 档：几乎不透明' },
  { backdrop: 'veil', veilOpacity: 0.72, expect: '0.72', why: 'veil 档：半透明 + 模糊' },
  { backdrop: 'clear', veilOpacity: 0.32, expect: '0.32', why: 'clear 档：明显透出' },
  { backdrop: 'bogus', veilOpacity: 0.5, expect: '1', why: '非法档位回落 solid（不透明）' },
]

console.log('背景档位映射单测（DOM 桩，无浏览器）')
console.log('')

for (let i = 0; i < CASES.length; i++) {
  const c = CASES[i]
  inBrowser = true
  window.__DSH_MO_STARTUP__ = {
    enabled: true, mode: 'always', faction: 'allied', speed: 1,
    requireInteraction: false, allowSkip: true,
    sound: false, soundVolume: 0, voice: false, voiceSource: 'off',
    voiceVolume: 0, voiceCue: false, voiceLead: 0, voiceRate: 1, voicePitch: 1, voiceLang: 'zh',
    backdrop: c.backdrop, veilOpacity: c.veilOpacity,
  }
  window.__DSH_MO_STARTUP_LOADED__ = false
  /* 每个档位用不同的 URL 查询串导入 → 拿到全新的模块实例，IIFE 重新执行 */
  await import(pathToFileURL(path.join(ROOT, 'lib', 'splash.js')).href + '?case=' + i)

  const root = document.getElementById('dsh-mo-startup-root')
  const backdrop = root && root.dataset ? root.dataset.backdrop : undefined
  const alpha = root && root.style ? root.style['--veil-alpha'] : undefined
  const expectBackdrop = ['solid', 'soft', 'veil', 'clear'].includes(c.backdrop) ? c.backdrop : 'solid'
  ok(backdrop === expectBackdrop, `${c.backdrop}(${c.veilOpacity}) → data-backdrop=${expectBackdrop} — ${c.why}`)
  ok(alpha === c.expect, `${c.backdrop}(${c.veilOpacity}) → --veil-alpha=${c.expect}（实得 ${alpha}）`)

  /* 遮罩层必须存在且排在粒子层之下（z 序由 CSS 保证，这里确认元素已挂上） */
  if (i === 0) {
    const veil = root && root.children.find((x) => x.className.includes('dsu-veil'))
    ok(!!veil, '根节点下已挂载遮罩层 .dsu-veil')
  }
  try { window.__DSH_MO_STARTUP_API__.stop() } catch (e) { /* noop */ }
}

/* ---------- 逐阵营验证：图标页必须静默（不出 TTS、不请求素材） ---------- */
console.log('')
console.log('图标页静默检查（四个阵营）')
const inspected = (() => {
  try { return window.__DSH_MO_STARTUP_API__.inspect() } catch (e) { return null }
})()
ok(!!inspected, 'inspect() 可调用')
if (inspected) {
  const factions = Object.keys(inspected)
  ok(factions.length === 4, `覆盖四个阵营（实得 ${factions.length}）`)
  let allSilent = true
  for (const f of factions) {
    const scenes = inspected[f] || []
    const intro = scenes[0] || {}
    const silent = intro.id === 'intro' && intro.audio === null && intro.hasSay === false
    if (!silent) allSilent = false
    ok(silent, `${f} 图标页静默：audio=${JSON.stringify(intro.audio)} hasSay=${intro.hasSay}`)
    ok(scenes.length >= 6, `${f} 幕数 ≥ 6（实得 ${scenes.length}）`)
    /* 图标页之外，仍要有会说话/有槽位的幕，避免误把整段都静音 */
    const voiced = scenes.slice(1).filter((x) => x.audio).length
    ok(voiced >= 5, `${f} 除图标页外仍有 ${voiced} 幕带语音槽位`)
    /* 需要人工确认的幕，必须有等待提示文案（按钮渐入前先打出这行） */
    const gates = scenes.filter((x) => x.interact)
    ok(gates.length >= 1, `${f} 有 ${gates.length} 幕需要人工确认`)
    const withPrompt = gates.filter((x) => x.interactPrompt)
    ok(withPrompt.length === gates.length,
      `${f} 所有确认幕都有等待提示文案（${withPrompt.map((x) => x.interactPrompt).join(' / ')}）`)
  }
  ok(allSilent, '图标页在四个阵营中均为静默（无 TTS 合成音）')
}

console.log('')
if (failures) {
  console.error(`✗ ${failures} 项断言失败`)
  process.exit(1)
} else {
  console.log('✓ 背景档位映射 + 图标页静默 全部正确')
}
process.exit(0)
