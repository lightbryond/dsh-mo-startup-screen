/* ============================================================================
 * dsh-mo-startup-screen — 本地测试台（免 DSH、免构建、零依赖）
 * ----------------------------------------------------------------------------
 * 做法：用假的 Cordis ctx（只实现 webServer.register / tapIndex）把**真实的**
 * lib/index.js Host 半侧挂到一个 node:http 服务上，再给它一份仿 DSH 的宿主页面。
 * 于是首屏注入、splash.css / splash.js 下发、语音与图标素材路由、配置读写 API
 * 全部走真实代码路径 —— 唯一没有覆盖的是依赖 DSH slots 的设置页卡片。
 *
 * 用法：
 *   node dev/harness.mjs            # 默认 http://127.0.0.1:4321
 *   node dev/harness.mjs --port 5000
 *
 * 配置写入 <项目>/.harness-home/dsh-mo-startup.json（不碰你真实的 ~/.dsh 配置）。
 * 改 lib/splash.js · splash.css 后直接刷新页面即可（Host 按 mtime 重新读取）。
 * ========================================================================== */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = (() => {
  const i = process.argv.indexOf('--port')
  const v = i >= 0 ? Number(process.argv[i + 1]) : Number(process.env.PORT)
  return Number.isFinite(v) && v > 0 ? v : 4321
})()

/* 配置隔离：Host 半侧读 process.env.DSH_HOME，必须在 import 之前设好 */
process.env.DSH_HOME = path.join(ROOT, '.harness-home')

/* ---------- 假 Cordis 上下文 ---------- */
const routes = []
const indexTaps = []
const effects = []   /* ctx.effect 的清理函数单独放：绝不能被当成 index 注入器调用 */

const fakeWebServer = {
  register(route) {
    routes.push(route)
    return () => {
      const i = routes.indexOf(route)
      if (i >= 0) routes.splice(i, 1)
    }
  },
  tapIndex(fn) {
    indexTaps.push(fn)
    return () => {
      const i = indexTaps.indexOf(fn)
      if (i >= 0) indexTaps.splice(i, 1)
    }
  },
}

const fakeCtx = {
  get: (name) => (name === 'webServer' ? fakeWebServer : undefined),
  logger: {
    warn: (...a) => console.warn('[host:warn]', ...a),
    info: (...a) => console.log('[host]', ...a),
    error: (...a) => console.error('[host:error]', ...a),
  },
  effect: (fn) => { const d = fn(); if (typeof d === 'function') effects.push(d) },
  on: () => {},
}

const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href)
mod.apply(fakeCtx)
console.log(`[harness] Host 半侧已挂载：${routes.length} 条路由 · ${indexTaps.length} 个 index 注入器`)
console.log('[harness] DSH_HOME =', process.env.DSH_HOME)

/* ---------- 仿 DSH 宿主页面（让透明背景 / 模糊遮罩有真实背景可压） ---------- */
function shellHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>DSH 宿主模拟页 · 开屏动画测试台</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;height:100vh;display:flex;font:14px "Segoe UI","Microsoft YaHei",sans-serif;
       background:#15161c;color:#d7dae3;overflow:hidden}
  .sidebar{width:250px;flex:none;background:#1a1c23;border-right:1px solid #262932;
           padding:14px;display:flex;flex-direction:column;gap:10px}
  .brand{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.06em}
  .dot{width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#4d6bfe,#8a5cff)}
  .item{padding:8px 10px;border-radius:8px;color:#9aa1b0;font-size:13px;background:#1f2229}
  .item.on{background:#262a35;color:#e6e9f0}
  .main{flex:1;display:flex;flex-direction:column}
  .top{padding:12px 18px;border-bottom:1px solid #262932;color:#8b93a3;font-size:13px}
  .chat{flex:1;padding:26px 34px;display:flex;flex-direction:column;gap:16px;overflow:auto}
  .msg{max-width:640px;padding:12px 16px;border-radius:12px;line-height:1.6;font-size:13.5px}
  .user{align-self:flex-end;background:#2b3550}
  .ai{align-self:flex-start;background:#212430}
  .composer{margin:0 34px 22px;padding:14px 16px;border:1px solid #2c303c;border-radius:12px;color:#6f7787}
  .hint{position:fixed;right:14px;bottom:14px;background:#000a;border:1px solid #333a48;color:#98a0b0;
        padding:8px 12px;border-radius:8px;font-size:11px;z-index:5}
</style></head>
<body>
  <aside class="sidebar">
    <div class="brand"><i class="dot"></i> DeepSeek Harness</div>
    <div class="item on">● 心灵终结开屏动画测试</div>
    <div class="item">○ 另一个会话</div>
    <div class="item">○ 又一个会话</div>
  </aside>
  <main class="main">
    <div class="top">G:\\test\\start_up — 宿主模拟页（harness）</div>
    <div class="chat">
      <div class="msg ai">这是模拟的 DSH 宿主界面。开屏动画会盖在这上面播放，背景透明，可以看到这里的界面被压暗 + 模糊。</div>
      <div class="msg user">切阵营只要点右下角工具栏，或按 Esc 跳过动画。</div>
    </div>
    <div class="composer">给 DeepSeek 发消息…（模拟输入框，不可用）</div>
  </main>
  <div class="hint">HARNESS · 改 lib/splash.js 后刷新即生效 · 默认背景不透明</div>
  <script>
    /* 工具栏：直接调插件自己的配置 API，顺带验证配置读写链路 */
    var API = '/dsh-mo-startup/config'
    fetch(API).then(function (r) { return r.json() }).then(function (j) {
      if (!j || !j.ok) return
      var box = document.createElement('div')
      box.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9;' +
        'display:flex;gap:8px;align-items:center;background:#101318f2;border:1px solid #2c3242;' +
        'border-radius:12px;padding:10px 14px;font-size:12px'
      box.innerHTML = '<span style="color:#7d8698">阵营</span>'
      ;[['allied', '同盟国'], ['soviet', '苏联'], ['epsilon', '厄普西隆'], ['foehn', '焚风']].forEach(function (f) {
        var b = document.createElement('button')
        b.textContent = f[1] + (j.config.faction === f[0] ? ' ✓' : '')
        b.style.cssText = 'background:#1c202b;color:#dbe2f0;border:1px solid #333a4c;border-radius:8px;padding:6px 10px;cursor:pointer'
        b.onclick = function () { post({ faction: f[0] }) }
        box.appendChild(b)
      })
      var bd = document.createElement('button')
      var isSolid = j.config.backdrop !== 'veil' && j.config.backdrop !== 'clear' && j.config.backdrop !== 'soft'
      bd.textContent = '背景：' + (isSolid ? '不透明' : '透出')
      bd.style.cssText = 'background:#1c202b;color:#dbe2f0;border:1px solid #333a4c;border-radius:8px;padding:6px 10px;cursor:pointer'
      bd.onclick = function () {
        if (isSolid) post({ backdrop: 'veil', veilOpacity: 0.72 })
        else post({ backdrop: 'solid', veilOpacity: 1 })
      }
      box.appendChild(bd)

      var sp = document.createElement('button')
      sp.textContent = '重播（当前配置）'
      sp.style.cssText = 'background:#1c202b;color:#dbe2f0;border:1px solid #333a4c;border-radius:8px;padding:6px 10px;cursor:pointer'
      sp.onclick = function () {
        if (window.__DSH_MO_STARTUP_API__) window.__DSH_MO_STARTUP_API__.replay()
        else location.reload()
      }
      box.appendChild(sp)
      document.body.appendChild(box)
    })

    function post(patch) {
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: patch })
      }).then(function () { location.reload() })
    }
  </script>
</body></html>`
}

/* ---------- HTTP 服务：真实路由 + 宿主页 ---------- */
function send(res, code, type, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': String(buf.length) })
  res.end(buf)
}

let currentPort = PORT
let tries = 0

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
  const p = u.pathname
  try {
    for (const r of routes) {
      if (r.kind === 'exact' && r.path === p) {
        console.log(`[req] ${req.method} ${p} → 插件路由`)
        return await r.handler(req, res)
      }
    }
    for (const r of routes) {
      if (r.kind === 'prefix' && (p === r.path || p.startsWith(r.path + '/'))) {
        console.log(`[req] ${req.method} ${p} → 插件路由(prefix)`)
        return await r.handler(req, res)
      }
    }
    if (p === '/' || p === '/index.html') {
      let html = shellHtml()
      for (const tap of indexTaps) html = tap(html)
      console.log(`[req] ${req.method} / → 宿主页（已注入开屏动画）`)
      return send(res, 200, 'text/html; charset=utf-8', html)
    }
    console.log(`[req] ${req.method} ${p} → 404`)
    send(res, 404, 'text/plain; charset=utf-8', 'not found')
  } catch (err) {
    console.error('[harness] 处理请求失败：', err)
    try { send(res, 500, 'text/plain; charset=utf-8', String(err && err.message)) } catch (e) { /* noop */ }
  }
})

/* 端口占用时自动顺延，最多试 10 个 */
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE' && tries < 10) {
    tries++
    console.warn(`[harness] 端口 ${currentPort} 被占用，改试 ${currentPort + 1}`)
    currentPort++
    setTimeout(() => server.listen(currentPort, '127.0.0.1'), 80)
    return
  }
  console.error('[harness] 启动失败：', err && err.message)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  const cfgFile = path.join(process.env.DSH_HOME, 'dsh-mo-startup.json')
  if (!fs.existsSync(cfgFile)) {
    try {
      fs.mkdirSync(path.dirname(cfgFile), { recursive: true })
      fs.writeFileSync(cfgFile, JSON.stringify({ faction: 'allied', mode: 'always', requireInteraction: true }, null, 2))
      console.log('[harness] 已写入初始测试配置：', cfgFile)
    } catch (err) { /* 首次没有也能跑，Host 会用默认值 */ }
  }
  console.log('')
  console.log('  ┌────────────────────────────────────────────────────────────┐')
  console.log('  │  开屏动画测试台已启动                                      │')
  console.log('  └────────────────────────────────────────────────────────────┘')
  console.log(`    打开：http://127.0.0.1:${currentPort}`)
  console.log(`    配置文件：${cfgFile}`)
  console.log('    改 lib/splash.js · splash.css 后刷新页面即可生效；Ctrl+C 退出')
  console.log('')
})
