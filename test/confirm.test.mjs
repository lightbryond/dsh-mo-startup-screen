/* ============================================================================
 * dsh-mo-startup-screen — 确认交互时序测试（DOM 桩 + 事件派发，无需浏览器）
 * ----------------------------------------------------------------------------
 * 验证"身份核验按钮不再突兀出现"这条需求，具体断言时序：
 *   1) 交互幕刚开始时：只有等待提示行，按钮存在但**不可见**；
 *   2) 提示行先逐字打出来（非空），此时按钮仍不可见 —— 顺序不能颠倒；
 *   3) 提示行打完后：按钮才带渐入类 dsu-btnIn 出现，提示行淡出，副提示渐入；
 *   4) 点击按钮 → 按钮淡出 → 预留区被清空 → 进入下一幕。
 * 交互流程由引擎统一实现，四个阵营共用同一条代码路径（各阵营的提示文案由
 * inspect() 覆盖验证，见 test/backdrop.test.mjs）。
 *
 * 用法：node test/confirm.test.mjs [faction]      # 默认 allied
 * ========================================================================== */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installDom } from './dom-stub.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FACTION = (process.argv[2] || 'allied').trim()
let failures = 0

function ok(cond, label) {
  if (cond) console.log('  ✓ ' + label)
  else { failures++; console.error('  ✗ ' + label) }
}

const dom = installDom()
dom.resetListeners()

/* 捕获运行时告警：播放期间任何一幕出错都会被引擎 warn 出来，本测试不允许出现 */
const warns = []
const origWarn = console.warn
console.warn = (...a) => { warns.push(a.map(String).join(' ')); origWarn(...a) }

global.window.__DSH_MO_STARTUP__ = {
  enabled: true, mode: 'always', faction: FACTION, speed: 3,
  requireInteraction: true, allowSkip: true,
  sound: false, soundVolume: 0, voice: false, voiceSource: 'off',
  voiceVolume: 0, voiceCue: false, voiceLead: 0, voiceRate: 1, voicePitch: 1, voiceLang: 'zh',
  backdrop: 'solid', veilOpacity: 1,
}
global.window.__DSH_MO_STARTUP_LOADED__ = false

/* 工具：按类名在树里找第一个节点（可限定父节点） */
function findAll(root, cls, hits = []) {
  if (!root || !root.children) return hits
  for (const child of root.children) {
    if (String(child.className || '').split(/\s+/).includes(cls)) hits.push(child)
    findAll(child, cls, hits)
  }
  return hits
}
function first(root, cls) { return findAll(root, cls)[0] || null }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function pollUntil(fn, timeoutMs, stepMs = 60) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const v = fn()
    if (v) return v
    await wait(stepMs)
  }
  return null
}

console.log(`确认交互时序测试 · 阵营 ${FACTION}`)
console.log('')

await import(pathToFileURL(path.join(ROOT, 'lib', 'splash.js')).href + '?confirm=' + FACTION)

const root = dom.byId.get('dsh-mo-startup-root')
ok(!!root, '开屏根节点已创建')
ok(!!first(root, 'dsu-gate'), '存在底部预留区 .dsu-gate（按钮不再插入正文流，不会顶动画面）')

/* 期望的提示文案：直接取运行时元信息，保证与实现一致 */
const meta = (() => {
  try { return window.__DSH_MO_STARTUP_API__.inspect()[FACTION] } catch (e) { return [] }
})()
const gateScene = (meta || []).find((x) => x.interact) || {}
const EXPECT_PROMPT = gateScene.interactPrompt || ''
ok(!!EXPECT_PROMPT, `该阵营确认幕配置了提示文案：${EXPECT_PROMPT}`)

/* 1) 等到交互的提示行出现 */
const prompt = await pollUntil(() => {
  const p = first(root, 'dsu-gatePrompt')
  return p && p.textContent && p.textContent.length > 0 ? p : null
}, 15000)
ok(!!prompt, '等待提示行先出现在预留区（打字机）')

/* 2) 关键：提示行正在打字，此时按钮必须是"存在但不可见" */
const btn = prompt ? first(root, 'dsu-btn') : null
ok(!!btn, '按钮元素已就位（但尚未显示）')
ok(btn && btn.style.display === 'none', '打字阶段按钮保持不可见（避免突然蹦出来）')
ok(btn && !/dsu-btnIn/.test(btn.className), '打字阶段按钮没有渐入类')
const midText = prompt ? prompt.textContent : ''
ok(midText.length > 0 && midText.length < 32, `打字进行中："${midText}"（未打完就不显示按钮）`)
const promptLen = midText.length

/* 3) 提示行**完整**打出后，按钮才带渐入类出现，副提示渐入 */
const done0 = await pollUntil(() => {
  const p = first(root, 'dsu-gatePrompt')
  return p && p.textContent === EXPECT_PROMPT ? p : null
}, 8000, 40)
const tTyped = Date.now()
ok(!!done0, `提示行完整打出："${EXPECT_PROMPT}"`)

const shown = await pollUntil(() => {
  const b = first(root, 'dsu-btn')
  return b && /dsu-btnIn/.test(b.className) ? b : null
}, 8000, 40)
const tBtn = Date.now()
ok(!!shown, '提示行打完后按钮才出现')
ok(!!shown && shown.style.display !== 'none', '按钮此时才变为可见')
ok(tBtn - tTyped >= 350, `提示打完后停留 ${tBtn - tTyped}ms 才出现按钮（≥350ms，不再抢拍）`)

/* 关键回归：按钮出现的那一刻，提示行必须是完整文案，且仍然在屏幕上 */
const promptAtBtn = first(root, 'dsu-gatePrompt')
ok(!!promptAtBtn, '按钮出现时提示行仍保留在预留区（不再提前淡出）')
ok(!!promptAtBtn && promptAtBtn.textContent === EXPECT_PROMPT,
  `按钮出现时提示行是完整文案（"${promptAtBtn ? promptAtBtn.textContent : '(已移除)'}"）`)
ok(promptLen > 0 && (prompt ? prompt.textContent.length : 0) >= promptLen, '提示行内容完整后才切到按钮')
const hint = first(root, 'dsu-btnHint')
ok(!!hint && /dsu-hintIn/.test(hint.className), '副提示（ENTER / SPACE）带渐入类')
ok(!!first(root, 'dsu-btnIn') || (shown && /dsu-btnIn/.test(shown.className)), '渐入动画类已挂上（dsuBtnIn）')

/* 4) 点击确认 → 按钮淡出 → 预留区清空 → 进入下一幕 */
const badge = first(root, 'dsu-badge')
const beforePhase = badge ? badge.textContent : ''
dom.fire(shown, 'click')
await wait(320)
const gate = first(root, 'dsu-gate')
ok(!!gate && gate.children.length === 0, '确认后预留区被清空（按钮淡出收场）')
const advanced = await pollUntil(() => {
  const b = first(root, 'dsu-badge')
  return b && b.textContent !== beforePhase ? b.textContent : null
}, 4000, 60)
ok(!!advanced, `确认后进入下一幕（${beforePhase} → ${advanced || '(未推进)'}）`)

/* 5) 全程不应有幕级错误（引擎会把渲染/发声异常 warn 出来） */
ok(warns.length === 0, warns.length ? '播放期间无幕级报错（实得：' + warns.join(' | ') + '）' : '播放期间无幕级报错')

console.log('')
if (failures) {
  console.error(`✗ ${failures} 项断言失败`)
  process.exit(1)
} else {
  console.log('✓ 确认交互时序全部正确（提示行 → 渐入按钮 → 淡出推进）')
}
process.exit(0)
