/* ============================================================================
 * dsh-mo-startup-screen — 动画驱动测试（DOM 桩，无需浏览器）
 * ----------------------------------------------------------------------------
 * 针对"齿轮不转动 / 进度条不动"这类问题：断言 SVG 动画确实在**逐帧改写属性**。
 * 背景：早前图形动画用 SMIL（animate / animateTransform），部分渲染器不执行，
 * 于是齿轮定格、雷达静止。现已全部改为 JS 逐帧驱动，这个测试就是那条回归线。
 *
 * 用法：node test/anim.test.mjs [faction]     # 默认 soviet（齿轮 + 进度条都在这个阵营）
 * ========================================================================== */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installDom } from './dom-stub.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FACTION = (process.argv[2] || 'soviet').trim()
let failures = 0

function ok(cond, label) {
  if (cond) console.log('  ✓ ' + label)
  else { failures++; console.error('  ✗ ' + label) }
}

const dom = installDom()
dom.resetListeners()
const warns = []
const origWarn = console.warn
console.warn = (...a) => { warns.push(a.map(String).join(' ')); origWarn(...a) }

global.window.__DSH_MO_STARTUP__ = {
  enabled: true, mode: 'always', faction: FACTION, speed: 3,
  requireInteraction: false, allowSkip: true,
  sound: false, soundVolume: 0, voice: false, voiceSource: 'off',
  voiceVolume: 0, voiceCue: false, voiceLead: 0, voiceRate: 1, voicePitch: 1, voiceLang: 'zh',
  backdrop: 'solid', veilOpacity: 1,
}
global.window.__DSH_MO_STARTUP_LOADED__ = false

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function findAll(root, cls, hits = []) {
  if (!root || !root.children) return hits
  for (const c of root.children) {
    if (String(c.className || '').split(/\s+/).includes(cls)) hits.push(c)
    findAll(c, cls, hits)
  }
  return hits
}
const first = (root, cls) => findAll(root, cls)[0] || null
async function pollUntil(fn, timeoutMs, stepMs = 60) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const v = fn()
    if (v) return v
    await wait(stepMs)
  }
  return null
}

console.log(`动画驱动测试 · 阵营 ${FACTION}`)
console.log('')

await import(pathToFileURL(path.join(ROOT, 'lib', 'splash.js')).href + '?anim=' + FACTION)
const root = dom.byId.get('dsh-mo-startup-root')
ok(!!root, '开屏根节点已创建')

/* ---------- 1) 齿轮：transform 属性必须随时间变化 ---------- */
const gears = await pollUntil(() => first(root, 'dsu-gearsSvg'), 25000)
ok(!!gears, '战争工厂幕已渲染（找到 .dsu-gearsSvg）')

if (gears) {
  const svg = gears.children[0]
  const cogGroups = (svg ? svg.children : []).filter((n) => n.tagName === 'G' || n.tagName === 'g')
  ok(cogGroups.length >= 2, `齿轮组数量正确（实得 ${cogGroups.length}）`)

  const readTransform = () => cogGroups.map((g) => String(g.getAttribute('transform') || ''))
  const t1 = readTransform()
  await wait(300)
  const t2 = readTransform()

  ok(t1.some((v) => v.length > 0), `齿轮初始就有旋转姿态：${JSON.stringify(t1)}`)
  ok(t1.join('|') !== t2.join('|'), `齿轮在转动（transform 随时间变化：${t1[0]} → ${t2[0]}）`)

  const deg = (s) => Number((s.match(/rotate\((-?[\d.]+)/) || [])[1] || 0)
  ok(Math.abs(deg(t2[0])) > Math.abs(deg(t1[0])), `主齿轮角度在推进（${deg(t1[0])}° → ${deg(t2[0])}°）`)
  if (cogGroups.length >= 2) {
    ok(/^-/.test(t2[1].replace('rotate(', '')) || deg(t2[1]) < 0, `副齿轮反向旋转（${t2[1]}）`)
  }
  /* 绝不能再出现 SMIL：它正是"齿轮不动"的元凶 */
  const markup = JSON.stringify(cogGroups.map((g) => g.children.map((c) => c.tagName)))
  ok(!markup.includes('animate'), '齿轮组内没有 SMIL 动画元素（纯 JS 驱动）')
}

/* ---------- 2) 生产线进度：格子逐格点亮 + 产量计数推进 ---------- */
if (gears) {
  const bar = first(root, 'dsu-segbar')
  ok(!!bar, '生产线进度条已渲染（.dsu-segbar）')
  if (bar) {
    const litCount = () => bar.children.filter((c) => String(c.className).split(/\s+/).includes('on')).length
    const c1 = litCount()
    await wait(500)
    const c2 = litCount()
    ok(c2 > c1, `进度条在推进（点亮格数 ${c1} → ${c2} / ${bar.children.length}）`)

    const count = first(root, 'dsu-prodCount')
    ok(!!count, '产量计数已渲染')
    if (count) {
      const txt = String(count.textContent)
      ok(/\/\s*\d+/.test(txt), `产量显示为"已完成 / 目标"格式：${txt}`)
    }
  }
}

/* ---------- 3) 全程不应有幕级告警 ---------- */
await wait(300)
ok(warns.length === 0, warns.length ? '播放期间无幕级报错（实得：' + warns.join(' | ') + '）' : '播放期间无幕级报错')

console.log('')
if (failures) {
  console.error(`✗ ${failures} 项断言失败`)
  process.exit(1)
} else {
  console.log('✓ 动画确实在 JS 逐帧驱动下运行（齿轮转动 / 进度推进）')
}
process.exit(0)
