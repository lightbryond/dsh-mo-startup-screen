/* ============================================================================
 * dsh-mo-startup-screen — Host 半侧
 * ----------------------------------------------------------------------------
 * 《红色警戒2：心灵终结》主题开屏动画。做三件事：
 *   1) 在 index.html 里注入「启动界面」：首屏兜底黑幕 + 关键 CSS + 配置 + 运行时
 *   2) 提供 /dsh-mo-startup/splash.css · splash.js · config · asset 路由
 *   3) 把配置持久化到 ~/.dsh/dsh-mo-startup.json（设置页经 /config 读写）
 *
 * 音频素材：lib/assets/<faction>/<slot>.wav（也兼容 .mp3），按阵营子目录
 * 白名单下发；素材缺失时浏览器自动回落到 TTS / 静默，不影响播放。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-mo-startup.json')

const NS = 'dsh-mo-startup-screen'
const ROUTE_BASE = '/dsh-mo-startup'

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 四个阵营的合法取值（与 lib/splash.js 的 FACTIONS 一一对应）。 */
const FACTIONS = ['allied', 'soviet', 'epsilon', 'foehn']

/** 默认配置：字段与 lib/splash.js 的 DEFAULTS 一一对应。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  faction: 'allied',          // allied | soviet | epsilon | foehn
  commander: '',              // '' = 用阵营默认指挥官称谓（终幕「欢迎回来，xxx」）
  speed: 1,
  requireInteraction: true,
  allowSkip: true,
  sound: true,                // 界面音效（WebAudio 现场合成，无音频文件）
  soundVolume: 0.5,
  /* 背景：solid=完全不透明（默认，彻底盖住 DSH 界面）/ soft=几乎不透明 /
     veil=半透明模糊 / clear=明显透出 */
  backdrop: 'solid',
  veilOpacity: 1,
  voice: true,                // 副官语音播报
  voiceSource: 'asset',       // asset=优先 lib/assets 里的 .wav 素材（缺失自动回落）/ tts=全 TTS / off=静默
  voiceVolume: 0.9,
  voiceCue: true,             // 念台词前的一声轻提示
  voiceLead: 240,             // 提示音之后留一小段空白再开口（ms）
  voiceRate: 0.9,             // TTS 回落时的语速
  voicePitch: 0.9,            // TTS 回落时的音调
  voiceLang: 'zh'             // TTS 回落时念中文还是英文：zh | en | both
}

const TEXT_KEYS = ['commander']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  faction: FACTIONS,
  voiceSource: ['asset', 'tts', 'off'],
  voiceLang: ['zh', 'en', 'both'],
  backdrop: ['solid', 'soft', 'veil', 'clear']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice', 'voiceCue']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  veilOpacity: [0.1, 1],
  soundVolume: [0, 1],
  voiceVolume: [0, 1],
  voiceLead: [0, 1200],
  voiceRate: [0.5, 2],
  voicePitch: [0, 2]
}

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (RANGES[key]) {
      const [lo, hi] = RANGES[key]
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  out.commander = String(out.commander || '').trim().slice(0, 32)
  return out
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。 */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  '#dsh-mo-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_MO_STARTUP__||{};
var root=document.getElementById('dsh-mo-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-mo-startup:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-mo-startup:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_MO_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-mo-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_MO_STARTUP_FAILED__=true;}}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/**
 * 取得 HTTP 载体服务。
 *
 * web profile 与桌面端都会挂 `@deepseek-ai/dsh-web-app`，其中 `webserver`
 * 这一行提供 `webServer`；但 Electron 也可能改成 file:// + IPC 直接下发
 * 前端。那种情况下没有 webServer，本插件不该把一颗 fiber 炸掉 ——
 * 交给客户端半侧自举（lib/client.js 的 selfBoot）。
 */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /** 没有可注册路由的 HTTP 载体：桌面端若走 IPC 下发前端就是这种形态。
      什么都不注册（plugin 仍然 APPLIED，不报错），页面由客户端半侧自举。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入，改由浏览器半侧自举启动界面。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
  }))

  /* 素材下发（只读、逐段白名单校验，杜绝目录穿越）：
       语音   lib/assets/<faction>/<slot>.wav（兼容 .mp3）
       图标   lib/assets/icons/deepseek.svg · <faction>.webp/.png
     素材缺失时返回 404，浏览器自动回落 TTS / 兜底绘制，不影响播放。 */
  const MIME = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.png': 'image/png'
  }
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
      let segs = rel.split('/').filter(Boolean)
      /* 有的载体把已匹配的前缀剥掉（req.url = /allied/x.wav），有的原样传入
         （req.url = /dsh-mo-startup/asset/allied/x.wav）—— 两种都要认。 */
      const at = segs.lastIndexOf('asset')
      if (at >= 0) segs = segs.slice(at + 1)
      if (segs.length !== 2 || segs.some((x) => x.includes('..'))) {
        res.writeHead(404); res.end(); return
      }
      const [group, file] = segs
      const ext = path.extname(file).toLowerCase()
      const isAudioGroup = FACTIONS.includes(group) && /^[a-z0-9_-]+\.(wav|mp3)$/i.test(file)
      const isIconGroup = group === 'icons' && /^(deepseek|[a-z]+)\.(svg|webp|png)$/i.test(file)
      if ((!isAudioGroup && !isIconGroup) || !MIME[ext]) {
        res.writeHead(404); res.end(); return
      }
      const disk = path.join(PACKAGE_ROOT, 'lib', 'assets', group, file)
      let bytes
      try { bytes = fs.readFileSync(disk) } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext],
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  /* 音频清单：设置页与文档用它列出哪些槽位已有素材、哪些还是占位。 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/assets-manifest',
    handler: (req, res) => {
      const manifest = {}
      for (const faction of FACTIONS) {
        const dir = path.join(PACKAGE_ROOT, 'lib', 'assets', faction)
        try {
          manifest[faction] = fs.readdirSync(dir)
            .filter((f) => /\.(wav|mp3)$/i.test(f))
            .sort()
        } catch (err) {
          manifest[faction] = []
        }
      }
      sendJson(res, 200, { ok: true, manifest })
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: readConfig(), defaults: DEFAULTS, file: CONFIG_FILE })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          const cfgNow = writeConfig(DEFAULTS)
          sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const cfgNow = writeConfig({ ...current, ...patch })
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
    const cfg = readConfig()
    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style id="dsh-mo-startup-critical">' + CRITICAL_CSS + '</style>'
    const body =
      '<div id="dsh-mo-startup-root" class="dsu-root dsu-boot"></div>' +
      '<script>window.__DSH_MO_STARTUP_BOOT__="index";window.__DSH_MO_STARTUP_VERSION__=' + safeJson(PLUGIN_VERSION) + ';window.__DSH_MO_STARTUP__=' + safeJson(cfg) + ';' + BOOTSTRAP_JS + '</script>' +
      '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

/* 导出形状对齐 DSH 内部插件：只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject, name }
