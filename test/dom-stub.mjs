/* ============================================================================
 * 最小 DOM 桩（无浏览器运行 lib/splash.js 用）
 * ----------------------------------------------------------------------------
 * 只实现 splash.js 真正会碰到的部分：createElement / getElementById / classList /
 * dataset / style.setProperty / appendChild / innerHTML ...
 * 画布 getContext 返回 null（粒子层自动退化为空操作），
 * fetch 一律 reject（素材与图标走"缺失回落"分支）。
 *
 * 供 test/backdrop.test.mjs 与 dev/dump-scenes.mjs 共用。
 * ========================================================================== */

/* ---------- 最小 DOM 桩 ---------- */
/* 事件表：让测试可以派发 keydown / click，验证交互时序 */
const elementListeners = new WeakMap()
const docListeners = {}

function makeElement(tag) {
  const e = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    children: [],
    parentNode: null,
    dataset: {},
    __style: {},
    __attrs: {},
    classList: {
      add(c) { if (!e.className.includes(c)) e.className = (e.className + ' ' + c).trim() },
      remove(c) { e.className = e.className.split(/\s+/).filter((x) => x && x !== c).join(' ') },
      contains(c) { return e.className.split(/\s+/).includes(c) },
    },
    appendChild(child) { child.parentNode = e; e.children.push(child); return child },
    insertBefore(child) { child.parentNode = e; e.children.unshift(child); return child },
    removeChild(child) {
      const i = e.children.indexOf(child)
      if (i >= 0) e.children.splice(i, 1)
      child.parentNode = null
      return child
    },
    remove() { if (e.parentNode) e.parentNode.removeChild(e) },
    addEventListener(type, fn) {
      const list = elementListeners.get(e) || {}
      ;(list[type] = list[type] || []).push(fn)
      elementListeners.set(e, list)
    },
    removeEventListener(type, fn) {
      const list = elementListeners.get(e)
      if (list && list[type]) list[type] = list[type].filter((x) => x !== fn)
    },
    querySelector() { return null },
    focus() {},
    getContext() { return null },          /* 画布拿不到 2d 上下文 → startFx 直接返回空操作 */
    setAttribute(k, v) { e.__attrs[k] = String(v) },
    getAttribute(k) { return e.__attrs[k] !== undefined ? e.__attrs[k] : null },
    querySelectorAll() { return [] },
    get clientWidth() { return 1280 },
    get clientHeight() { return 800 },
    get firstChild() { return e.children[0] || null },
    get lastChild() { return e.children[e.children.length - 1] || null },
  }
  e.style = Object.assign(e.__style, {
    setProperty(k, v) { e.__style[k] = String(v) },
    removeProperty(k) { delete e.__style[k] },
  })
  Object.defineProperty(e, 'innerHTML', {
    get() { return '' },
    set(v) {
      if (v === '') { e.children.length = 0; e.__svg = '' }
      else { e.__svg = String(v); if (String(v).includes('svg')) e.__isSvgHost = true }
    },
  })
  return e
}

export const body = makeElement('body')
export const documentElement = makeElement('html')
const byId = new Map()

global.document = {
  body,
  documentElement,
  head: makeElement('head'),
  /* 文本节点：splash.js 的日志行会用它拼接内容 */
  createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null, children: [] }),
  createElement: (t) => makeElement(t),
  getElementById(id) { return byId.get(id) || null },
  querySelector() { return null },
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn) },
  removeEventListener(type, fn) {
    if (docListeners[type]) docListeners[type] = docListeners[type].filter((x) => x !== fn)
  },
}

/* 阵营标志用 new Image() 预载；这里给个够用的桩 */
global.Image = class {
  constructor() { this.src = ''; this.alt = ''; this.draggable = false; this.onerror = null }
}

global.window = {
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  sessionStorage: { getItem: () => null, setItem() {} },
  localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 16),
  cancelAnimationFrame: (h) => clearTimeout(h),
  /* fetch / AudioContext / speechSynthesis 全部缺席 → 走素材缺失与静音回落分支 */
  fetch: () => Promise.reject(new Error('offline in test')),
  performance: { now: () => Date.now() },
}

/* body.appendChild 要能按 id 登记，供 document.getElementById 找到根节点 */
const rawAppend = body.appendChild.bind(body)
body.appendChild = (child) => {
  if (child && child.id) byId.set(child.id, child)
  return rawAppend(child)
}


/** 安装全局 document / window / Image 桩，返回工具句柄 */
export function installDom() {
  return {
    body, documentElement, byId, makeElement,
    /** 派发一个键盘事件给 document 上的监听者 */
    keydown(key) {
      const ev = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      ;(docListeners.keydown || []).slice().forEach((fn) => fn(ev))
      return ev
    },
    /** 触发某个元素上的事件（如 click） */
    fire(el, type) {
      const list = elementListeners.get(el)
      const ev = { type, preventDefault() {}, currentTarget: el }
      if (list && list[type]) list[type].slice().forEach((fn) => fn(ev))
      return ev
    },
    /** 清空所有注册（每个阵营开播前调用，避免上一个实例的监听残留） */
    resetListeners() {
      Object.keys(docListeners).forEach((k) => delete docListeners[k])
    },
  }
}
