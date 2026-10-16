/* ============================================================================
 * dsh-mo-startup-screen — 导出各幕生成的图形片段（排障用）
 * ----------------------------------------------------------------------------
 * 用途：在**没有浏览器**的情况下跑一遍开屏序列，把每一幕动态生成的
 * SVG / DOM 片段打印出来，用来核对几何形状是否正确（例如雷达是不是正圆、
 * 齿轮/波纹/瞳孔的坐标对不对），排查"某个渲染器里图形被裁成圆角方块"这类问题。
 *
 * 用法：
 *   node dev/dump-scenes.mjs               # 四个阵营全跑一遍
 *   node dev/dump-scenes.mjs allied        # 只看盟军
 *   node dev/dump-scenes.mjs soviet --full # 打印完整片段（不截断）
 * ========================================================================== */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installDom } from '../test/dom-stub.mjs'

const SELF = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(SELF), '..')
const args = process.argv.slice(2)
const only = args.find((a) => !a.startsWith('--'))
const full = args.includes('--full')
const FACTIONS = ['allied', 'soviet', 'epsilon', 'foehn']

/* 没有指定阵营时：每个阵营单独起一个进程跑 —— 模块实例与全局 DOM 桩各自独立，
   结果互不干扰（同进程里连续播多个阵营会互相污染）。 */
if (!only) {
  console.log('逐个阵营跑一遍开屏序列，导出动态生成的图形片段（每个阵营独立进程）')
  let bad = 0
  for (const f of FACTIONS) {
    const r = spawnSync(process.execPath, [SELF, f, ...(full ? ['--full'] : [])], { stdio: 'inherit' })
    if (r.status !== 0) bad++
  }
  process.exit(bad ? 1 : 0)
}

const targets = [only]

let dom = installDom()

/* 把桩元素序列化成精简 HTML（SVG 现在由 createElementNS 构建，没有 innerHTML 可读） */
function serialize(n) {
  const tag = String(n.tagName || 'div').toLowerCase()
  const attrs = Object.entries(n.__attrs || {})
    .filter(([k]) => k !== 'aria-hidden')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  const kids = (n.children || []).map(serialize).join('')
  const head = '<' + tag + (attrs ? ' ' + attrs : '') + (n.className ? ` class="${n.className}"` : '') + '>'
  return head + kids + '</' + tag + '>'
}

/* 收集所有图形容器（含 <svg> 子节点者），按出现顺序去重输出 */
function collectSvg(seen) {
  const out = []
  const walk = (node) => {
    if (!node || !node.children) return
    for (const child of node.children) {
      const isSvgHost = String(child.tagName || '').toLowerCase() === 'svg'
      if (isSvgHost && !seen.has(child)) {
        seen.add(child)
        out.push({ cls: (child.parentNode && child.parentNode.className) || 'svg', html: serialize(child) })
      }
      walk(child)
    }
  }
  walk(dom.body)
  return out
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }

for (const faction of targets) {
  console.log('')
  console.log('══════ ' + faction + ' ══════')
  global.window.__DSH_MO_STARTUP__ = {
    enabled: true, mode: 'always', faction, speed: 3, requireInteraction: false, allowSkip: true,
    sound: false, soundVolume: 0, voice: false, voiceSource: 'off',
    voiceVolume: 0, voiceCue: false, voiceLead: 0, voiceRate: 1, voicePitch: 1, voiceLang: 'zh',
    backdrop: 'solid', veilOpacity: 1,
  }
  global.window.__DSH_MO_STARTUP_LOADED__ = false

  /* 每个阵营用全新的一棵 DOM 树，避免上一轮的节点/计数器串味 */
  dom = installDom()
  const seen = new Set()
  /* 用查询串换一个模块实例，让 IIFE 重新执行（每个阵营各自播一遍） */
  await import(pathToFileURL(path.join(ROOT, 'lib', 'splash.js')).href + '?f=' + faction)

  /* 3× 速度下整套约 5 秒；边播边采样，抓到每一幕的片段 */
  const deadline = Date.now() + 9000
  let total = 0   /* 本阵营抓到的片段数（每个阵营独立计数） */
  while (Date.now() < deadline) {
    await wait(70)
    const found = collectSvg(seen)
    for (const item of found) {
      const text = full ? item.html : item.html.replace(/\s+/g, ' ').slice(0, 700)
      console.log('\n  · ' + item.cls + '  (' + item.html.length + ' 字符)')
      console.log('    ' + text + (full || item.html.length <= 700 ? '' : ' …'))
      total++
    }
    /* 动画播完（根节点被移除）就收工 */
    const root = dom.byId.get('dsh-mo-startup-root')
    if (total > 0 && root && root.parentNode === null) break
    if (!root) break
  }
  try { global.window.__DSH_MO_STARTUP_API__.stop() } catch (e) { /* noop */ }
}

console.log('')
console.log('提示：圆形图元都以 <circle>/<ellipse> + 明确坐标出现 —— 若看到的是 div+border-radius，')
console.log('      说明该阵营的某个视觉又退回 CSS 方案了，需要改回 SVG 工厂。')
process.exit(0)
