/* ============================================================================
 * dsh-mo-startup-screen — 开屏动画运行时（浏览器侧，无构建纯 JS）
 * ----------------------------------------------------------------------------
 * 《红色警戒2：心灵终结》主题。四个阵营各自独立的播放序列与视觉：
 *   allied  同盟国联军：卫星链路 → 身份核验 → 超时空充能 → 作战控制连线
 *   soviet  苏维埃联盟：战斗警报 → 战场控制 → 战争工厂 → 铁幕充能
 *   epsilon 厄普西隆军：心灵信标 → 心灵网络 → 支配仪充能 → 尤里即是主宰
 *   foehn   焚风反抗军：加密信号 → 沃克网 → 神经同步 → 纳米汇聚
 *
 * 配置来自 window.__DSH_MO_STARTUP__（Host 侧注入），也可用
 * window.__DSH_MO_STARTUP_API__.replay() 重播。
 *
 * 语音槽位：lib/assets/<faction>/<slot>.wav，经 /dsh-mo-startup/asset/ 下发；
 * 素材缺失自动回落 TTS / 静默，绝不打断动画。槽位清单见 AUDIO.md。
 * ========================================================================== */
(function () {
  'use strict'
  if (window.__DSH_MO_STARTUP_LOADED__) return
  window.__DSH_MO_STARTUP_LOADED__ = true

  var ROUTE = '/dsh-mo-startup'
  var ROOT_ID = 'dsh-mo-startup-root'

  var DEFAULTS = {
    enabled: true, mode: 'session', faction: 'allied', commander: '',
    speed: 1, requireInteraction: true, allowSkip: true,
    sound: true, soundVolume: 0.5,
    backdrop: 'solid', veilOpacity: 1,
    voice: true, voiceSource: 'asset', voiceVolume: 0.9,
    voiceCue: true, voiceLead: 240, voiceRate: 0.9, voicePitch: 0.9, voiceLang: 'zh'
  }

  /* ---------- 小工具 ---------- */
  /* 动画帧与高精度时间：一律走这里，不裸调 requestAnimationFrame / performance，
     这样在缺少这些全局对象的环境（测试桩、非浏览器宿主）里也能正常工作。 */
  var raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
    ? function (fn) { return window.requestAnimationFrame(fn) }
    : function (fn) { return setTimeout(function () { fn(Date.now()) }, 16) }
  var caf = (typeof window !== 'undefined' && window.cancelAnimationFrame)
    ? function (id) { window.cancelAnimationFrame(id) }
    : function (id) { clearTimeout(id) }
  var nowMs = function () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }
  function readCfg() {
    var raw = (window.__DSH_MO_STARTUP__ && typeof window.__DSH_MO_STARTUP__ === 'object')
      ? window.__DSH_MO_STARTUP__ : {}
    var cfg = {}
    for (var k in DEFAULTS) cfg[k] = raw[k] !== undefined ? raw[k] : DEFAULTS[k]
    return cfg
  }
  function writeFlag(store, key, value) {
    try { window[store] && window[store].setItem(key, value) } catch (e) { /* 隐私模式忽略 */ }
  }

  /* 逐字打字机；返回 Promise。 */
  function typeText(node, text, cps, tick) {
    return new Promise(function (resolve) {
      var i = 0
      node.classList.add('dsu-caret')
      var timer = setInterval(function () {
        i++
        node.textContent = text.slice(0, i)
        if (tick && i % 2 === 0) tick()
        if (i >= text.length) {
          clearInterval(timer)
          node.classList.remove('dsu-caret')
          resolve()
        }
      }, Math.max(12, Math.round(1000 / cps)))
      node.__timer = timer
    })
  }

  /* ---------- 音效（WebAudio 现场合成，无音频文件） ---------- */
  var actx = null
  function ac() {
    if (!actx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext
        actx = AC ? new AC() : null
      } catch (e) { actx = null }
    }
    if (actx && actx.state === 'suspended') { try { actx.resume() } catch (e) { /* noop */ } }
    return actx
  }
  function beep(freq, dur, type, gain, when) {
    var c = ac(); if (!c) return
    var t = c.currentTime + (when || 0)
    var o = c.createOscillator()
    var g = c.createGain()
    o.type = type || 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(c.destination)
    o.start(t); o.stop(t + dur + 0.05)
  }
  function noise(dur, gain, freq, q, sweepTo) {
    var c = ac(); if (!c) return
    var len = Math.max(1, Math.floor(c.sampleRate * dur))
    var buf = c.createBuffer(1, len, c.sampleRate)
    var data = buf.getChannelData(0)
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    var src = c.createBufferSource(); src.buffer = buf
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur)
    var g = c.createGain()
    g.gain.setValueAtTime(gain, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    src.connect(f); f.connect(g); g.connect(c.destination)
    src.start()
  }
  function makeSfx(cfg) {
    var vol = function () { return (cfg.sound ? cfg.soundVolume : 0) }
    return {
      tick: function () { if (vol()) beep(1900, 0.03, 'square', 0.05 * vol()) },
      cue: function () { if (vol()) { beep(1046.5, 0.09, 'sine', 0.12 * vol()); beep(1568, 0.12, 'sine', 0.1 * vol(), 0.12) } },
      confirm: function () { if (vol()) { beep(660, 0.08, 'triangle', 0.16 * vol()); beep(990, 0.14, 'triangle', 0.14 * vol(), 0.09) } },
      sweep: function () { if (vol()) noise(0.7, 0.1 * vol(), 600, 2, 3200) },
      chime: function () { if (vol()) { beep(523, 0.9, 'sine', 0.12 * vol()); beep(659, 0.9, 'sine', 0.1 * vol(), 0.12); beep(784, 1.2, 'sine', 0.1 * vol(), 0.24) } },
      siren: function () {
        if (!vol()) return
        for (var i = 0; i < 3; i++) { beep(720, 0.28, 'sawtooth', 0.06 * vol(), i * 0.42); beep(540, 0.28, 'sawtooth', 0.06 * vol(), i * 0.42 + 0.21) }
      },
      clank: function () { if (vol()) { beep(180, 0.12, 'square', 0.14 * vol()); noise(0.08, 0.08 * vol(), 900, 1) } },
      pulse: function () { if (vol()) beep(72, 0.5, 'sine', 0.2 * vol()) },
      whisper: function () { if (vol()) noise(0.9, 0.06 * vol(), 2400, 0.7, 900) },
      wind: function () { if (vol()) noise(1.4, 0.09 * vol(), 500, 0.6, 1800) },
      data: function () { if (vol()) for (var i = 0; i < 4; i++) beep(1200 + i * 300, 0.04, 'square', 0.05 * vol(), i * 0.06) }
    }
  }

  /* ---------- 语音：.wav 素材优先，缺失回落 TTS，再回落静默 ---------- */
  var currentNodes = []
  function stopAudio() {
    try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (e) { /* noop */ }
    for (var i = 0; i < currentNodes.length; i++) {
      try { currentNodes[i].stop() } catch (e) { /* noop */ }
    }
    currentNodes = []
  }

  function pickTtsVoice(lang) {
    try {
      var list = window.speechSynthesis.getVoices() || []
      var want = lang === 'zh' ? 'zh' : 'en'
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].lang || '').toLowerCase().indexOf(want) === 0) return list[i]
      }
      return list[0] || null
    } catch (e) { return null }
  }

  function ttsSay(text, lang, cfg) {
    return new Promise(function (resolve) {
      try {
        if (!window.speechSynthesis || !text) { resolve(0); return }
        var started = Date.now()
        var u = new SpeechSynthesisUtterance(text)
        var v = pickTtsVoice(lang)
        if (v) { u.voice = v; u.lang = v.lang }
        u.rate = cfg.voiceRate
        u.pitch = cfg.voicePitch
        u.volume = cfg.voiceVolume
        u.onend = u.onerror = function () { resolve((Date.now() - started) / 1000) }
        window.speechSynthesis.speak(u)
      } catch (e) { resolve(0) }
    })
  }

  /**
   * 拉取并播放素材。返回 Promise：
   *   >= 0  实际播放秒数
   *   -1    该槽位没有素材（404）→ 可以名正言顺地回落 TTS
   *   -2    素材在，但**解不了码**（多为 ADPCM 编码 / 采样格式异常）
   *         → 不能用 TTS 冒充，改为静默 + 告警，提示去跑素材体检工具
   */
  function playAsset(faction, slot, cfg) {
    var grab = function (ext) {
      return fetch(ROUTE + '/asset/' + faction + '/' + slot + ext)
        .then(function (r) { return r.ok ? r.arrayBuffer() : null })
        .catch(function () { return null })
    }
    return grab('.wav')
      .then(function (buf) { return buf || grab('.mp3') })
      .then(function (buf) {
        if (!buf) return -1
        var c = ac()
        if (!c) return -2
        return c.decodeAudioData(buf).then(function (audio) {
          return new Promise(function (resolve) {
            var src = c.createBufferSource()
            var g = c.createGain()
            g.gain.value = cfg.voiceVolume
            src.buffer = audio
            src.connect(g); g.connect(c.destination)
            currentNodes.push(src)
            src.onended = function () { resolve(audio.duration) }
            try { src.start() } catch (e) { resolve(-2) }
          })
        }).catch(function () { return -2 })
      })
      .catch(function () { return -1 })
  }

  /* 素材清单：一次性拉取并缓存，用来判断"某阵营某槽位到底有没有素材"。
     拿到之后就能避免"没素材也响提示音""每次都发一个 404 请求"这类浪费。 */
  var manifestPromise = null
  var assetManifest = null
  function loadAssetManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(ROUTE + '/assets-manifest')
        .then(function (r) { return r.json() })
        .then(function (j) { assetManifest = (j && j.ok && j.manifest) || {}; return assetManifest })
        .catch(function () { assetManifest = {}; return assetManifest })
    }
    return manifestPromise
  }
  /** true=有素材 / false=确认没有 / null=清单还没拿到（按"可能有"处理） */
  function assetState(faction, slot) {
    if (!assetManifest) return null
    var list = assetManifest[faction]
    if (!list || !list.length) return false
    for (var i = 0; i < list.length; i++) {
      var f = String(list[i]).toLowerCase()
      if (f === slot + '.wav' || f === slot + '.mp3') return true
    }
    return false
  }

  /**
   * 念一句台词：返回 Promise<实际出声秒数>（0 = 没有任何声音）。
   * 规则（先判断"这一幕到底有没有声音"，再决定要不要出提示音）：
   *   1) 该幕没有语音槽位 / 语音总开关关闭 → 直接静默，不出提示音；
   *   2) 查过素材清单、确认该槽位**没有素材**，且这一幕也没写台词 → 静默，不出提示音；
   *   3) 有素材 → 提示音 → 留白 → 播放素材；
   *   4) 没素材但有台词（或清单还没拿到）→ 提示音 → 留白 → 系统 TTS。
   */
  function voiceLine(scene, faction, cfg, sfx) {
    if (!cfg.voice || cfg.voiceSource === 'off' || !scene.audio) return Promise.resolve(0)
    var hasSay = !!(scene.say || scene.sayEn)
    var known = assetState(faction, scene.audio)     /* true / false / null(清单还没到) */
    if (known === false && !hasSay) return Promise.resolve(0)

    var started = Date.now()
    var say = function () {
      if (cfg.voiceSource === 'asset' && known !== false) {
        return playAsset(faction, scene.audio, cfg).then(function (sec) {
          if (sec >= 0) return sec
          if (sec === -2) {
            /* 素材存在但解不了码：这是素材编码问题，用 TTS 顶替反而更让人困惑，
               所以静默 + 明确指出是哪个文件，交给素材体检工具处理。 */
            try {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[dsh-mo-startup-screen] 语音素材无法解码：lib/assets/' + faction + '/' +
                  scene.audio + '.wav（多半是 ADPCM/异常采样格式）—— 执行 node dev/check-audio.mjs 查看并转换')
              }
            } catch (e) { /* noop */ }
            return 0
          }
          return tts()
        })
      }
      return tts()
    }
    var tts = function () {
      if (!hasSay) return Promise.resolve(0)
      var zh = scene.say, en = scene.sayEn
      if (cfg.voiceLang === 'en') return ttsSay(en, 'en', cfg)
      if (cfg.voiceLang === 'zh') return ttsSay(zh, 'zh', cfg)
      return ttsSay(zh, 'zh', cfg).then(function () { return ttsSay(en, 'en', cfg) })
        .then(function () { return (Date.now() - started) / 1000 })
    }
    if (!cfg.voiceCue) return say()
    sfx.cue()
    return wait(cfg.voiceLead).then(say)
  }

  /* 背景档位：solid 完全不透明（默认，彻底盖住 DSH 应用界面），
     soft 几乎不透明，veil 半透明 + 背景模糊，clear 明显透出。
     具体不透明度由 cfg.veilOpacity 决定（设置页里选档位会同时写入推荐值）。 */
  var BACKDROPS = { solid: 1, soft: 0.93, veil: 0.72, clear: 0.32 }

  /* ---------- 图标素材 ---------- */
  function iconUrl(name) { return ROUTE + '/asset/icons/' + name }

  /* DeepSeek 图标：拉取 SVG 文本内联（currentColor 随阵营染色）；失败回落文字标 */
  var deepseekSvgPromise = null
  function loadDeepseekLogo() {
    if (!deepseekSvgPromise) {
      deepseekSvgPromise = fetch(iconUrl('deepseek.svg'))
        .then(function (r) { if (!r.ok) throw new Error('logo 404'); return r.text() })
        .catch(function () { return null })
    }
    return deepseekSvgPromise
  }

  /* ---------- 动态背景粒子（透明背景上的阵营专属氛围层） ---------- */
  var FX_CFG = {
    allied: {
      count: 90, type: 'mote',
      colors: ['#4da3ff', '#9cc8ff', '#ffd75e', '#ffffff']
    },
    soviet: {
      count: 120, type: 'ember',
      colors: ['#e0301e', '#ff7a3c', '#f2c14e']
    },
    epsilon: {
      count: 46, type: 'orb',
      colors: ['#a64dff', '#ff4dd2', '#e0b3ff']
    },
    foehn: {
      /* 与盟军 / 苏联同一套方案：缓慢上浮的柔和光尘（mote），只换成焚风配色。
         "流动的风线"那条路线观感不佳，已彻底弃用。 */
      count: 96, type: 'mote',
      colors: ['#2fe0c0', '#9ff5e4', '#7fe9d6', '#ffffff']
    }
  }

  function startFx(faction, root) {
    var cfg = FX_CFG[faction] || FX_CFG.allied
    var canvas = el('canvas', 'dsu-fx')
    root.appendChild(canvas)
    var ctx2d = canvas.getContext('2d')
    if (!ctx2d) return function () {}
    var dpr = Math.min(1.5, window.devicePixelRatio || 1)
    var w = 0, h = 0, alive = true, rafId = 0
    var parts = [], ripples = []

    function resize() {
      w = canvas.clientWidth || window.innerWidth
      h = canvas.clientHeight || window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

    function spawn() {
      var p = { c: pick(cfg.colors), tw: Math.random() * Math.PI * 2 }
      if (cfg.type === 'mote') {
        p.x = Math.random() * w; p.y = h + 10
        p.vx = (Math.random() - 0.5) * 0.2; p.vy = -(0.25 + Math.random() * 0.5)
        p.size = 1 + Math.random() * 2.2; p.alpha = 0.25 + Math.random() * 0.5
      } else if (cfg.type === 'ember') {
        p.x = Math.random() * w; p.y = h + 10
        p.vx = (Math.random() - 0.5) * 0.5; p.vy = -(0.5 + Math.random() * 1.1)
        p.size = 1 + Math.random() * 2.4; p.alpha = 0.3 + Math.random() * 0.6
        p.flick = 6 + Math.random() * 8
      } else if (cfg.type === 'orb') {
        p.x = Math.random() * w; p.y = Math.random() * h
        p.vx = (Math.random() - 0.5) * 0.18; p.vy = (Math.random() - 0.5) * 0.14
        p.size = 2.5 + Math.random() * 6; p.alpha = 0.08 + Math.random() * 0.16
      }
      return p
    }
    for (var i = 0; i < cfg.count; i++) {
      var p0 = spawn()
      if (cfg.type !== 'ember' && cfg.type !== 'mote') { p0.x = Math.random() * w; p0.y = Math.random() * h }
      parts.push(p0)
    }

    var last = nowMs()
    function frame(now) {
      if (!alive) return
      var dt = Math.min(50, now - last); last = now
      ctx2d.clearRect(0, 0, w, h)

      /* epsilon：周期性心灵涟漪 */
      if (cfg.type === 'orb' && Math.random() < 0.012 && ripples.length < 4) {
        ripples.push({ x: Math.random() * w, y: Math.random() * h, r: 4, max: 90 + Math.random() * 120, a: 0.5 })
      }
      for (var ri = ripples.length - 1; ri >= 0; ri--) {
        var rp = ripples[ri]
        rp.r += dt * 0.045; rp.a *= 0.985
        if (rp.r > rp.max) { ripples.splice(ri, 1); continue }
        ctx2d.beginPath()
        ctx2d.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx2d.strokeStyle = 'rgba(166,77,255,' + rp.a.toFixed(3) + ')'
        ctx2d.lineWidth = 1
        ctx2d.stroke()
      }

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]
        p.x += p.vx * dt * 0.06
        p.y += p.vy * dt * 0.06
        p.tw += dt * 0.0012
        var a = p.alpha * (0.65 + 0.35 * Math.sin(p.tw))
        if (p.flick) a *= 0.6 + 0.4 * Math.sin(now * 0.001 * p.flick + i)
        if (p.y < -20 || p.y > h + 20 || p.x > w + 80) { parts[i] = spawn(); continue }
        ctx2d.globalAlpha = Math.max(0, Math.min(1, a))
        ctx2d.fillStyle = p.c
        /* 光尘 / 火星统一画成柔和圆点（与盟军、苏联同一套观感） */
        ctx2d.beginPath()
        ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx2d.fill()
      }
      ctx2d.globalAlpha = 1
      rafId = raf(frame)
    }
    rafId = raf(frame)
    loadDeepseekLogo() /* 顺便预热图标缓存 */
    return function stop() {
      alive = false
      caf(rafId)
      window.removeEventListener('resize', resize)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }

  /* ==========================================================================
   * SVG 图形与动画
   * --------------------------------------------------------------------------
   * 两条硬规则（都踩过坑）：
   *   1) 图形一律用内联 SVG 显式坐标绘制 —— 不用 border-radius / CSS 渐变画圆，
   *      否则在部分渲染器里会被裁成"圆角方块"。
   *   2) 动画一律由 **JS 逐帧改写属性** 驱动 —— 不用 SMIL，也不用 CSS transform：
   *      实测某些渲染器（含桌面端的 webview）不执行 SMIL animate/animateTransform，
   *      于是齿轮、雷达扫描会直接定格。
   * 元素用 createElementNS 构建以保留节点引用，动画就是 setAttribute。
   * ======================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg'

  function svgEl(tag, attrs) {
    var n = document.createElementNS ? document.createElementNS(SVGNS, tag) : document.createElement(tag)
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, String(attrs[k]))
      }
    }
    return n
  }
  function svgRoot(w, h) {
    var s = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true' })
    s.style.display = 'block'
    s.style.overflow = 'visible'
    return s
  }

  /** 逐帧动画驱动：注册 (元素, step(t 秒))；每幕一个实例，幕结束即停 */
  function createAnimator() {
    var items = []
    var alive = true
    var rafId = 0
    var t0 = nowMs()
    /* 注意：不要用 rAF 回调参数当时间基准 —— 它和 nowMs() 可能不是同一个时钟
       （实测在测试桩里会混出 1e10 量级的秒数）。统一用 nowMs() 算经过时间。 */
    function frame() {
      if (!alive) return
      var t = (nowMs() - t0) / 1000
      for (var i = 0; i < items.length; i++) {
        try { items[i].step(t, items[i].el) } catch (e) { /* 单个元素出错不影响其它 */ }
      }
      rafId = raf(frame)
    }
    rafId = raf(frame)
    return {
      add: function (element, step) { items.push({ el: element, step: step }); return element },
      /* 立刻算一帧 t=0 的姿态，避免"从静态初值跳到动画值"的第一帧闪动 */
      prime: function () {
        for (var i = 0; i < items.length; i++) {
          try { items[i].step(0, items[i].el) } catch (e) { /* noop */ }
        }
      },
      stop: function () { alive = false; caf(rafId); items.length = 0 }
    }
  }

  /* ---------- 盟军：雷达（同心圆环 + 十字轴 + 旋转扇面 + 闪烁亮点） ---------- */
  function radarSvg(anim) {
    var R = 104, cx = 120, cy = 120
    var svg = svgRoot(240, 240)
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: R, class: 'dsu-fxDisc' }))
    ;[26, 52, 78, 104].forEach(function (r, i) {
      svg.appendChild(svgEl('circle', {
        cx: cx, cy: cy, r: r, class: 'dsu-fxRing' + (i === 3 ? ' dsu-fxRingOuter' : '')
      }))
    })
    svg.appendChild(svgEl('line', { x1: 16, y1: 120, x2: 224, y2: 120, class: 'dsu-fxAxis' }))
    svg.appendChild(svgEl('line', { x1: 120, y1: 16, x2: 120, y2: 224, class: 'dsu-fxAxis' }))

    var ang = (62 * Math.PI) / 180
    var ex = (cx + R * Math.sin(ang)).toFixed(1)
    var ey = (cy - R * Math.cos(ang)).toFixed(1)
    var sweep = svgEl('g')
    sweep.appendChild(svgEl('path', {
      d: 'M' + cx + ' ' + cy + ' L' + cx + ' ' + (cy - R) +
         ' A' + R + ' ' + R + ' 0 0 1 ' + ex + ' ' + ey + ' Z',
      class: 'dsu-fxSweep'
    }))
    sweep.appendChild(svgEl('line', { x1: cx, y1: cy, x2: cx, y2: cy - R, class: 'dsu-fxSweepEdge' }))
    svg.appendChild(sweep)
    anim.add(sweep, function (t, e) {
      e.setAttribute('transform', 'rotate(' + ((t % 3.2) / 3.2 * 360).toFixed(1) + ' ' + cx + ' ' + cy + ')')
    })

    ;[[160, 84, 0], [78, 150, 0.9], [150, 168, 1.7], [64, 74, 2.4]].forEach(function (b) {
      var dot = svgEl('circle', { cx: b[0], cy: b[1], r: 3.4, class: 'dsu-fxBlip' })
      svg.appendChild(dot)
      anim.add(dot, function (t, e) {
        var ph = (((t + b[2]) % 3.2) + 3.2) % 3.2 / 3.2
        var o = ph < 0.12 ? ph / 0.12 : (ph < 0.6 ? 1 : Math.max(0, 1 - (ph - 0.6) / 0.4))
        e.setAttribute('opacity', o.toFixed(3))
      })
    })
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 2.6, class: 'dsu-fxCore' }))

    var wrap = el('div', 'dsu-radar')
    wrap.appendChild(svg)
    return wrap
  }

  /* ---------- 苏联：齿轮组（虚线圆环当齿 + 轮毂 + 轮辐，两只反向转） ---------- */
  function gearsSvg(anim) {
    var svg = svgRoot(240, 160)
    var cog = function (x, y, r, dur, reverse) {
      var teeth = Math.max(8, r * 0.28)
      var hub = r * 0.34
      var g = svgEl('g')
      g.appendChild(svgEl('circle', {
        cx: x, cy: y, r: r, class: 'dsu-fxTeeth',
        'stroke-width': teeth.toFixed(0),
        'stroke-dasharray': (r * 0.22).toFixed(1) + ' ' + (r * 0.18).toFixed(1)
      }))
      g.appendChild(svgEl('circle', { cx: x, cy: y, r: (r - teeth * 0.7).toFixed(1), class: 'dsu-fxRing' }))
      g.appendChild(svgEl('circle', { cx: x, cy: y, r: hub.toFixed(1), class: 'dsu-fxHub' }))
      for (var i = 0; i < 4; i++) {
        var sp = (Math.PI / 2) * i + Math.PI / 4
        g.appendChild(svgEl('line', {
          x1: x, y1: y,
          x2: (x + Math.cos(sp) * (hub + 4)).toFixed(1),
          y2: (y + Math.sin(sp) * (hub + 4)).toFixed(1),
          class: 'dsu-fxSpoke'
        }))
      }
      svg.appendChild(g)
      anim.add(g, function (t, e) {
        var deg = (reverse ? -1 : 1) * (t * 360 / dur)
        e.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' ' + x + ' ' + y + ')')
      })
    }
    cog(88, 78, 50, 7, false)
    cog(170, 104, 32, 5, true)
    var wrap = el('div', 'dsu-gearsSvg')
    wrap.appendChild(svg)
    return wrap
  }

  /* ---------- 厄普西隆：心灵波纹（三圈由小到大）+ 凝视之瞳 ---------- */
  function psiwaveSvg(anim) {
    var svg = svgRoot(240, 240)
    svg.appendChild(svgEl('circle', { cx: 120, cy: 120, r: 112, class: 'dsu-fxRing' }))
    ;[0, 1, 2].forEach(function (i) {
      var ring = svgEl('circle', { cx: 120, cy: 120, r: 14, class: 'dsu-fxPsi', opacity: 0 })
      svg.appendChild(ring)
      anim.add(ring, function (t, e) {
        var p = (((t + i) % 3) + 3) % 3 / 3
        e.setAttribute('r', (14 + 98 * p).toFixed(1))
        e.setAttribute('opacity', (0.85 * (1 - p)).toFixed(3))
      })
    })
    svg.appendChild(svgEl('circle', { cx: 120, cy: 120, r: 9, class: 'dsu-fxCore' }))
    var pulse = svgEl('circle', { cx: 120, cy: 120, r: 9, class: 'dsu-fxCorePulse', opacity: 0.5 })
    svg.appendChild(pulse)
    anim.add(pulse, function (t, e) {
      var k = (Math.sin(t * 2 * Math.PI / 1.8) + 1) / 2
      e.setAttribute('r', (9 + 11 * k).toFixed(1))
      e.setAttribute('opacity', (0.5 * (1 - k)).toFixed(3))
    })
    var wrap = el('div', 'dsu-psiwaveSvg')
    wrap.appendChild(svg)
    return wrap
  }

  function eyeSvg(anim) {
    var svg = svgRoot(300, 130)
    svg.appendChild(svgEl('ellipse', { cx: 150, cy: 65, rx: 146, ry: 62, class: 'dsu-fxEyeLid' }))
    svg.appendChild(svgEl('circle', { cx: 150, cy: 65, r: 34, class: 'dsu-fxIris' }))
    svg.appendChild(svgEl('circle', { cx: 150, cy: 65, r: 13, class: 'dsu-fxPupil' }))
    var glow = svgEl('circle', { cx: 150, cy: 65, r: 42, class: 'dsu-fxPupilGlow', opacity: 0.28 })
    svg.appendChild(glow)
    anim.add(glow, function (t, e) {
      var k = (Math.sin(t * 2 * Math.PI / 3.2) + 1) / 2
      e.setAttribute('r', (40 + 6 * k).toFixed(1))
      e.setAttribute('opacity', (0.28 - 0.18 * k).toFixed(3))
    })
    svg.appendChild(svgEl('circle', { cx: 150, cy: 65, r: 4, class: 'dsu-fxGlint' }))
    var wrap = el('div', 'dsu-eyeSvg')
    wrap.appendChild(svg)
    return wrap
  }

  /* ---------- 焚风：纳米汇聚（散点向核心收拢） ---------- */
  function nanoSvg(anim) {
    var CX = 130, CY = 90
    var svg = svgRoot(260, 180)
    svg.appendChild(svgEl('rect', {
      x: 117, y: 77, width: 26, height: 26, class: 'dsu-fxNanoCore', transform: 'rotate(45 130 90)'
    }))
    var dots = []
    for (var i = 0; i < 26; i++) {
      var ang = Math.random() * Math.PI * 2
      var rad = 66 + Math.random() * 76
      var sx = Number((CX + Math.cos(ang) * rad).toFixed(1))
      var sy = Number((CY + Math.sin(ang) * rad * 0.62).toFixed(1))
      var dot = svgEl('circle', {
        cx: sx, cy: sy, r: (1.8 + Math.random() * 1.8).toFixed(1), class: 'dsu-fxNanoDot'
      })
      svg.appendChild(dot)
      dots.push({ el: dot, x0: sx, y0: sy })
    }
    anim.add(svg, function (t) {
      var k = Math.min(1, t / 2.2)
      var e2 = 1 - Math.pow(1 - k, 3)
      for (var j = 0; j < dots.length; j++) {
        var d = dots[j]
        d.el.setAttribute('cx', (d.x0 + (CX - d.x0) * e2).toFixed(1))
        d.el.setAttribute('cy', (d.y0 + (CY - d.y0) * e2).toFixed(1))
        d.el.setAttribute('opacity', (1 - 0.72 * e2).toFixed(2))
      }
    })
    var wrap = el('div', 'dsu-nanoSvg')
    wrap.appendChild(svg)
    return wrap
  }

  /* ---------- 开屏图标页：DeepSeek 标识（阵营色）→ 柔和过渡 → 阵营序列 ----------
     出声：不出。图标页刻意保持静默（audio: null）—— 过去这里会用人声念一句
     「欢迎回来，指挥官」，合成音听着突兀，现已去掉；将来要配也建议用真人素材，
     直接改这里的 audio 为槽位名即可（槽位清单见 AUDIO.md）。
     过场：不做整屏闪白，改为图标轻微放大 + 淡出，与下一幕的淡入自然衔接。 */
  function makeIntroScene(meta, ctx) {
    return {
      id: 'intro', audio: null, hold: 2100, sfx: null,
      zh: '', en: '', say: null, sayEn: null,
      render: function (stage) {
        var box = el('div', 'dsu-intro')
        var logo = el('div', 'dsu-introLogo')
        var word = el('div', 'dsu-introWord dsu-mono', 'DEEPSEEK HARNESS')
        var sub = el('div', 'dsu-introSub dsu-mono', meta.zh + ' · ' + meta.en)
        box.appendChild(logo)
        box.appendChild(word)
        box.appendChild(sub)
        stage.appendChild(box)
        loadDeepseekLogo().then(function (svg) {
          if (svg) logo.innerHTML = svg
          else {
            logo.className = 'dsu-introWordmark'
            logo.textContent = 'DS'
          }
        })
        /* 停留尾声：柔和的淡出（不做闪白），交给下一幕的淡入接上 */
        setTimeout(function () {
          box.classList.add('dsu-introOut')
        }, Math.max(200, ctx.ms(2100) - 420))
      }
    }
  }

  /* ==========================================================================
   * 阵营定义：meta + 六幕序列
   * 每幕字段：
   *   id/audio  语音槽位（lib/assets/<faction>/<audio>.wav），null = 本幕无人声
   *   zh/en     中文主字 / 英文等宽副标题
   *   say/sayEn TTS 回落时念的台词（也是 AUDIO.md 里推荐台词的基准）
   *   hold      视觉基准停留毫秒（实际停留 = max(hold, 语音时长 + 240ms)）
   *   interact  { zh, en } 存在时显示确认按钮（可在设置里关掉人工确认）
   *   sfx       幕开场音效名
   *   render(stage, ctx) → 可选 cleanup 函数
   * ======================================================================== */

  function stdZhEn(stage, zh, en, ctx) {
    var zhN = el('div', 'dsu-zh')
    var enN = el('div', 'dsu-en dsu-mono')
    stage.appendChild(zhN)
    stage.appendChild(enN)
    var p = typeText(zhN, zh, 14, ctx.sfx.tick)
      .then(function () { return typeText(enN, en, 26, ctx.sfx.tick) })
    /* 登记到本幕的等待队列：有的幕 render 返回的是"清理函数"，
       若只等返回值，这一幕的打字机就会被漏掉（文字没打完就切走）。 */
    if (ctx && ctx.pending) ctx.pending.push(p)
    return p
  }

  var FACTIONS = {

    /* ---------------- 同盟国联军 ---------------- */
    allied: {
      zh: '同盟国联军', en: 'ALLIED NATIONS', mark: '▲',
      motto: '自由世界的利剑 · SWORD OF THE FREE WORLD',
      titleZh: '指挥官', titleEn: 'COMMANDER',
      commanderDefault: 'COMMANDER',
      scenes: [
        {
          id: 'boot', audio: 'boot', hold: 1800, sfx: 'sweep',
          zh: '同盟国联军 · 作战指挥系统', en: 'ALLIED NATIONS COMMAND OS',
          say: '指挥官，欢迎回到作战指挥系统。', sayEn: 'Commander, welcome back to battle control.',
          render: function (stage, ctx) { return stdZhEn(stage, this.zh, this.en, ctx) }
        },
        {
          id: 'uplink', audio: 'uplink', hold: 2800, sfx: 'data',
          zh: '卫星链路建立中', en: 'SATELLITE UPLINK IN PROGRESS',
          say: '卫星链路建立中，正在同步战区数据。', sayEn: 'Satellite uplink in progress. Syncing theater data.',
          render: function (stage, ctx) {
            stage.appendChild(radarSvg(ctx.anim))
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('SAT-LINK', '上行链路握手 OK · 延迟 42ms')
            ctx.log('NORAD-7', '战区影像回传中…')
            return p
          }
        },
        {
          id: 'verify', audio: 'verify', hold: 1400, sfx: 'cue',
          zh: '指挥官身份核验', en: 'COMMANDER IDENTITY VERIFICATION',
          say: '请确认您的身份，指挥官。', sayEn: 'Commander identity verification required.',
          interact: { zh: '确 认 身 份', en: 'CONFIRM IDENTITY', prompt: 'AWAITING COMMANDER IDENTITY' },
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var card = el('dl', 'dsu-idcard')
            var rows = [
              ['COMMANDER', ctx.commander()],
              ['CLEARANCE', 'LEVEL 5 · TOP SECRET'],
              ['THEATER', 'EUROPE / PACIFIC / ARCTIC']
            ]
            rows.forEach(function (r) {
              card.appendChild(el('dt', 'dsu-mono', r[0]))
              card.appendChild(el('dd', null, r[1]))
            })
            stage.appendChild(card)
            return p
          }
        },
        {
          id: 'chrono', audio: 'chrono', hold: 3200, sfx: 'sweep',
          zh: '超时空传送仪充能', en: 'CHRONOSPHERE CHARGING',
          say: '超时空传送仪充能完毕，随时待命。', sayEn: 'Chronosphere charged and standing by.',
          render: function (stage, ctx) {
            /* 充能环：SVG 圆 + JS 每帧改写 stroke-dashoffset（不用 SMIL），
               百分比数字与圆环同步，任何渲染器下都会动。 */
            var R = 96
            var circ = 2 * Math.PI * R
            var dur = ctx.ms(2600)
            var svg = svgRoot(220, 220)
            svg.setAttribute('viewBox', '0 0 220 220')
            svg.appendChild(svgEl('circle', {
              class: 'dsu-ringTrack', cx: 110, cy: 110, r: R, fill: 'none', 'stroke-width': 6
            }))
            var bar = svgEl('circle', {
              class: 'dsu-ringBar', cx: 110, cy: 110, r: R, fill: 'none', 'stroke-width': 6,
              'stroke-linecap': 'round', transform: 'rotate(-90 110 110)',
              'stroke-dasharray': circ.toFixed(1), 'stroke-dashoffset': circ.toFixed(1)
            })
            svg.appendChild(bar)
            var wrap = el('div', 'dsu-ring')
            wrap.appendChild(svg)
            var pct = el('div', 'dsu-ringPct dsu-mono', '0%')
            wrap.appendChild(pct)
            stage.appendChild(wrap)

            var t0 = nowMs()
            ctx.anim.add(bar, function (t) {
              var k = Math.min(1, (nowMs() - t0) / dur)
              bar.setAttribute('stroke-dashoffset', (circ * (1 - k)).toFixed(1))
              pct.textContent = Math.round(k * 100) + '%'
            })
            stdZhEn(stage, this.zh, this.en, ctx)
          }
        },
        {
          id: 'online', audio: 'online', hold: 2200, sfx: 'chime',
          zh: '作战控制连线', en: 'BATTLE CONTROL ONLINE',
          say: '作战控制已连线。', sayEn: 'Battle control online.',
          interact: { zh: '接 管 战 场', en: 'TAKE COMMAND', prompt: 'AWAITING COMMAND AUTHORIZATION' },
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var map = el('div', 'dsu-gridmap')
            var cells = []
            for (var i = 0; i < 48; i++) { var c = el('i'); map.appendChild(c); cells.push(c) }
            stage.appendChild(map)
            var idx = 0
            var timer = setInterval(function () {
              for (var n = 0; n < 2 && idx < cells.length; n++, idx++) {
                cells[idx].classList.add('on')
                ctx.sfx.tick()
              }
              if (idx >= cells.length) clearInterval(timer)
            }, ctx.ms(90))
            ctx.log('GRID', '战区网格逐块点亮 · 48 节点')
            return function () { clearInterval(timer) }
          }
        },
        {
          id: 'finale', audio: 'finale', hold: 2400, sfx: 'chime', finale: true,
          zh: '欢迎回来', en: 'WELCOME BACK',
          say: null, sayEn: null,
          render: function (stage, ctx) {
            var w = el('div', 'dsu-welcome')
            w.appendChild(document.createTextNode('欢迎回来，'))
            w.appendChild(el('span', 'dsu-welcomeName', ctx.commander()))
            stage.appendChild(w)
            stdZhEn(stage, '', 'WELCOME BACK, ' + ctx.commander().toUpperCase(), ctx)
          }
        }
      ]
    },

    /* ---------------- 苏维埃联盟 ---------------- */
    soviet: {
      zh: '苏维埃联盟', en: 'SOVIET UNION', mark: '★',
      motto: '钢铁洪流势不可挡 · THE STEEL TIDE ADVANCES',
      titleZh: '将军同志', titleEn: 'COMRADE GENERAL',
      commanderDefault: 'COMRADE GENERAL',
      scenes: [
        {
          id: 'alarm', audio: 'alarm', hold: 2000, sfx: 'siren',
          zh: '战 斗 警 报', en: 'COMBAT ALERT',
          say: '战斗警报！全体就位。', sayEn: 'Combat alert! All units to stations.',
          render: function (stage, ctx) {
            var glow = el('div', 'dsu-alarmGlow')
            ctx.root.appendChild(glow)
            stage.appendChild(el('div', 'dsu-hazard'))
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            stage.appendChild(el('div', 'dsu-hazard'))
            ctx.log('ALERT', '边境侦测到敌对活动 · 警戒级别提升')
            return function () { glow.remove() }
          }
        },
        {
          id: 'control', audio: 'control', hold: 2800, sfx: 'clank',
          zh: '建立战场控制', en: 'ESTABLISHING BATTLEFIELD CONTROL',
          say: '正在建立战场控制。', sayEn: 'Establishing battlefield control.',
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            /* 分段进度条：按时间确定性填满（不依赖定时器抖动，幕结束前必定 100%） */
            var bar = el('div', 'dsu-segbar')
            var segs = []
            for (var i = 0; i < 14; i++) { var sg = el('i'); bar.appendChild(sg); segs.push(sg) }
            stage.appendChild(bar)
            var t0 = nowMs()
            var dur = ctx.ms(2200)
            ctx.anim.add(bar, function () {
              var k = Math.min(1, (nowMs() - t0) / dur)
              var filled = Math.floor(k * segs.length)
              for (var j = 0; j < segs.length; j++) {
                if (j < filled && !segs[j].__on) {
                  segs[j].__on = true
                  segs[j].classList.add('on')
                  if (j % 2 === 0) ctx.sfx.tick()
                }
              }
            })
            ctx.log('FIELD-CTL', '占领战区指挥节点 … ')
            return p
          }
        },
        {
          id: 'verify', audio: 'verify', hold: 1400, sfx: 'cue',
          zh: '将军同志身份确认', en: 'COMRADE GENERAL IDENTIFICATION',
          say: '请确认身份，将军同志。', sayEn: 'Identification required, comrade general.',
          interact: { zh: '确认，将军同志', en: 'CONFIRM, COMRADE', prompt: 'AWAITING COMRADE GENERAL' },
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var card = el('dl', 'dsu-idcard')
            var rows = [
              ['GENERAL', ctx.commander()],
              ['RANK', '将军 · GENERAL OF THE ARMY'],
              ['FRONT', '东经战线 / 极地方面军']
            ]
            rows.forEach(function (r) {
              card.appendChild(el('dt', 'dsu-mono', r[0]))
              card.appendChild(el('dd', null, r[1]))
            })
            stage.appendChild(card)
            return p
          }
        },
        {
          id: 'factory', audio: 'factory', hold: 3000, sfx: 'clank',
          zh: '战争工厂全速运转', en: 'WAR FACTORY AT FULL PRODUCTION',
          say: '战争工厂已全速运转。', sayEn: 'War factory at full production.',
          render: function (stage, ctx) {
            stage.appendChild(gearsSvg(ctx.anim))
            /* 生产线进度：12 格确定性地从 0 推到 100%，右侧同步显示产量（0 → 24 台） */
            var bar = el('div', 'dsu-segbar')
            var segs = []
            for (var i = 0; i < 12; i++) { var sg = el('i'); bar.appendChild(sg); segs.push(sg) }
            stage.appendChild(bar)
            var TARGET = 24
            var count = el('div', 'dsu-prodCount dsu-mono', '0 / ' + TARGET)
            stage.appendChild(count)
            var t0 = nowMs()
            var dur = ctx.ms(2400)
            ctx.anim.add(bar, function () {
              var k = Math.min(1, (nowMs() - t0) / dur)
              var filled = Math.floor(k * segs.length)
              for (var j = 0; j < segs.length; j++) {
                if (j < filled && !segs[j].__on) {
                  segs[j].__on = true
                  segs[j].classList.add('on')
                  if (j % 2 === 0) ctx.sfx.tick()
                }
              }
              count.textContent = Math.floor(k * TARGET) + ' / ' + TARGET
            })
            stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('FACTORY', '坦克生产线 · 全速运转')
          }
        },
        {
          id: 'curtain', audio: 'curtain', hold: 2600, sfx: 'pulse',
          zh: '铁幕装置充能完毕', en: 'IRON CURTAIN FULLY CHARGED',
          say: '铁幕装置充能完毕。', sayEn: 'Iron curtain fully charged.',
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var grid = el('div', 'dsu-hexgrid')
            for (var i = 0; i < 5; i++) grid.appendChild(el('b'))
            stage.appendChild(grid)
            ctx.log('IRON CURTAIN', '无敌护盾就绪 · 可部署')
            return p
          }
        },
        {
          id: 'finale', audio: 'finale', hold: 2400, sfx: 'chime', finale: true,
          zh: '欢迎回来', en: 'WELCOME BACK',
          say: null, sayEn: null,
          render: function (stage, ctx) {
            var w = el('div', 'dsu-welcome')
            w.appendChild(document.createTextNode('欢迎回来，'))
            w.appendChild(el('span', 'dsu-welcomeName', ctx.commander()))
            stage.appendChild(w)
            stdZhEn(stage, '', 'WELCOME BACK, ' + ctx.commander().toUpperCase(), ctx)
          }
        }
      ]
    },

    /* ---------------- 厄普西隆军 ---------------- */
    epsilon: {
      zh: '厄普西隆军', en: 'EPSILON ARMY', mark: '◉',
      motto: '心灵即力量 · MIND IS POWER',
      titleZh: '异教', titleEn: 'PROSELYTE',
      commanderDefault: 'PROSELYTE',
      scenes: [
        {
          id: 'beacon', audio: 'beacon', hold: 2200, sfx: 'pulse',
          zh: '心灵信标已启动', en: 'PSYCHIC BEACON ACTIVATED',
          say: '心灵信标已启动。', sayEn: 'Psychic beacon activated.',
          render: function (stage, ctx) {
            stage.appendChild(psiwaveSvg(ctx.anim))
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('BEACON', '心灵波纹扩散中 · 覆盖半径 12km')
            return p
          }
        },
        {
          id: 'link', audio: 'link', hold: 2800, sfx: 'whisper',
          zh: '接入心灵网络', en: 'JOINING THE PSYCHIC NETWORK',
          say: '你的思想，正在接入网络。', sayEn: 'Your mind is joining the network.',
          render: function (stage, ctx) {
            stage.appendChild(eyeSvg(ctx.anim))
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('PSI-LINK', '神经共振频率匹配 … 99.7%')
            return p
          }
        },
        {
          id: 'will', audio: 'will', hold: 1400, sfx: 'whisper',
          zh: '确认异教意志', en: 'PROSELYTE WILL CONFIRMATION',
          say: '证明你的忠诚，异教。', sayEn: 'Prove your devotion, proselyte.',
          interact: { zh: '遵 从 意 志', en: 'OBEY THE WILL', prompt: 'THE WILL AWAITS YOUR ANSWER' },
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var card = el('dl', 'dsu-idcard')
            var rows = [
              ['PROSELYTE', ctx.commander()],
              ['DEVOTION', '绝对忠诚 · ABSOLUTE'],
              ['MASTER', 'YURI']
            ]
            rows.forEach(function (r) {
              card.appendChild(el('dt', 'dsu-mono', r[0]))
              card.appendChild(el('dd', null, r[1]))
            })
            stage.appendChild(card)
            return p
          }
        },
        {
          id: 'dominator', audio: 'dominator', hold: 3200, sfx: 'pulse',
          zh: '心灵支配仪充能中', en: 'PSYCHIC DOMINATOR CHARGING',
          say: '心灵支配仪充能中。', sayEn: 'Psychic dominator charging.',
          render: function (stage, ctx) {
            var bars = el('div', 'dsu-wavebars')
            for (var i = 0; i < 17; i++) {
              var b = el('i')
              b.style.animationDelay = (i * 0.07).toFixed(2) + 's'
              b.style.animationDuration = (0.9 + (i % 5) * 0.11).toFixed(2) + 's'
              bars.appendChild(b)
            }
            stage.appendChild(bars)
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('DOMINATOR', '心灵能量蓄积 · 波形同步上升')
            return p
          }
        },
        {
          id: 'master', audio: 'master', hold: 2400, sfx: 'whisper',
          zh: '尤里即是主宰', en: 'YURI IS MASTER',
          say: '尤里即是主宰。', sayEn: 'Yuri is master.',
          render: function (stage, ctx) {
            stage.appendChild(el('div', 'dsu-glitch', this.zh))
            var p = typeText(el('div', ''), '', 1)
            var enN = el('div', 'dsu-en dsu-mono')
            stage.appendChild(enN)
            p = typeText(enN, this.en, 22, ctx.sfx.tick)
            return p
          }
        },
        {
          id: 'finale', audio: 'finale', hold: 2600, sfx: 'pulse', finale: true,
          zh: '欢迎', en: 'WELCOME',
          say: null, sayEn: null,
          render: function (stage, ctx) {
            var w = el('div', 'dsu-welcome')
            w.appendChild(document.createTextNode('欢迎，'))
            w.appendChild(el('span', 'dsu-welcomeName', ctx.commander()))
            stage.appendChild(w)
            var sub = el('div', 'dsu-en dsu-mono', 'YURI IS WATCHING YOU')
            sub.style.marginTop = '14px'
            stage.appendChild(sub)
          }
        }
      ]
    },

    /* ---------------- 焚风反抗军 ---------------- */
    foehn: {
      zh: '焚风反抗军', en: 'FOEHN REVOLT', mark: '⬡',
      motto: '焚风将席卷世界 · THE WINDS WILL RISE',
      titleZh: '指挥官', titleEn: 'COMMANDER',
      commanderDefault: 'COMMANDER',
      scenes: [
        {
          id: 'signal', audio: 'signal', hold: 2000, sfx: 'wind',
          zh: '捕获加密信号', en: 'ENCRYPTED SIGNAL ACQUIRED',
          say: '捕获加密信号，正在解析。', sayEn: 'Encrypted signal acquired. Decoding.',
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('SIGNAL', '频段 447.2MHz · 信号源锁定')
            return p
          }
        },
        {
          id: 'volknet', audio: 'volknet', hold: 2800, sfx: 'data',
          zh: '接入沃克网', en: 'VOLKNET CONNECTION ESTABLISHED',
          say: '沃克网连接已建立。', sayEn: 'Volknet connection established.',
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var hive = el('div', 'dsu-hive')
            var cells = []
            for (var i = 0; i < 24; i++) { var b = el('b'); hive.appendChild(b); cells.push(b) }
            stage.appendChild(hive)
            var col = el('div', 'dsu-datacol dsu-mono')
            stage.appendChild(col)
            var idx = 0
            var hexChars = '0123456789ABCDEF'
            var timer = setInterval(function () {
              if (idx < cells.length && Math.random() > 0.25) { cells[idx++].classList.add('on') }
              var line = ''
              for (var n = 0; n < 38; n++) line += hexChars[Math.floor(Math.random() * 16)] + (n % 4 === 3 ? ' ' : '')
              col.insertBefore(el('div', null, line), col.firstChild)
              while (col.children.length > 7) col.removeChild(col.lastChild)
              if (Math.random() > 0.6) ctx.sfx.tick()
            }, ctx.ms(110))
            ctx.log('VOLKNET', '节点级联接入 · 24 个蜂格')
            return function () { clearInterval(timer) }
          }
        },
        {
          id: 'sync', audio: 'sync', hold: 1400, sfx: 'cue',
          zh: '指挥官神经同步', en: 'COMMANDER NEURAL SYNC',
          say: '准备神经同步，指挥官。', sayEn: 'Prepare for neural sync, commander.',
          interact: { zh: '开 始 同 步', en: 'BEGIN SYNC', prompt: 'NEURAL LINK STANDING BY' },
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            var card = el('dl', 'dsu-idcard')
            var rows = [
              ['COMMANDER', ctx.commander()],
              ['INTERFACE', '神经直连 · NEURAL-LINK'],
              ['NETWORK', 'VOLKNET / 全球节点']
            ]
            rows.forEach(function (r) {
              card.appendChild(el('dt', 'dsu-mono', r[0]))
              card.appendChild(el('dd', null, r[1]))
            })
            stage.appendChild(card)
            return p
          }
        },
        {
          id: 'nano', audio: 'nano', hold: 3000, sfx: 'data',
          zh: '纳米同步完成', en: 'NANOMACHINE SYNC COMPLETE',
          say: '纳米同步完成。', sayEn: 'Nanomachine synchronization complete.',
          render: function (stage, ctx) {
            stage.appendChild(nanoSvg(ctx.anim))
            stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('NANO', '纳米群向核心汇聚 …')
          }
        },
        {
          id: 'winds', audio: 'winds', hold: 2200, sfx: 'wind',
          zh: '焚风已起', en: 'THE WINDS HAVE RISEN',
          say: '焚风已起。', sayEn: 'The winds have risen.',
          render: function (stage, ctx) {
            var p = stdZhEn(stage, this.zh, this.en, ctx)
            ctx.log('FOEHN', '季风带增强 · 全球阵线待命')
            return p
          }
        },
        {
          id: 'finale', audio: 'finale', hold: 2400, sfx: 'chime', finale: true,
          zh: '欢迎', en: 'WELCOME',
          say: null, sayEn: null,
          render: function (stage, ctx) {
            var w = el('div', 'dsu-welcome')
            w.appendChild(document.createTextNode('欢迎，'))
            w.appendChild(el('span', 'dsu-welcomeName', ctx.commander()))
            stage.appendChild(w)
            stdZhEn(stage, '', 'WELCOME, ' + ctx.commander().toUpperCase(), ctx)
          }
        }
      ]
    }
  }

  /* ==========================================================================
   * 确认交互（四个阵营共用）
   * --------------------------------------------------------------------------
   * 过去是"到点直接 append 一个按钮"，显得突兀、还会把版面顶一下。
   * 现在改成三步渐进，并且渲染在**底部预留区**（gateBox）里，不挤动上方内容：
   *   1) 先打字机打出一行等待提示（各阵营有自己的文案）；
   *   2) **提示行完整打出后停留一拍**（dwellMs），按钮才渐入，光环引导视线；
   *   3) 点击 / Enter / 空格确认 → 按钮淡出 → 下一幕。
   * 全程只用 opacity 类动画，不依赖 border-radius / transform 等特性。
   * ======================================================================== */
  function waitForConfirm(scene, gateBox, sfx, token, dwellMs) {
    return new Promise(function (resolve) {
      var info = scene.interact || {}
      gateBox.innerHTML = ''

      var prompt = el('div', 'dsu-gatePrompt dsu-mono', '')
      var btn = el('button', 'dsu-btn', info.zh || '确认')
      var hint = el('div', 'dsu-btnHint dsu-mono', (info.en || 'CONFIRM') + ' · ENTER / SPACE')
      btn.style.display = 'none'
      hint.style.display = 'none'
      gateBox.appendChild(prompt)
      gateBox.appendChild(btn)
      gateBox.appendChild(hint)

      var finished = false
      var typing = typeText(prompt, info.prompt || 'AWAITING CONFIRMATION', 26, sfx.tick)

      /* 提示行打完 → **先停留一拍让整行读得完**（dwellMs）→ 按钮才渐入。
         提示行不再提前淡出/移除：它留在按钮上方（打完时略微提亮），
         直到确认完成才随整块一起淡出 —— 这样不会出现"提示没显示完就冒出按钮"。 */
      typing.then(function () {
        if (finished || token.cancelled) return
        prompt.classList.add('dsu-gatePromptDone')
        setTimeout(function () {
          if (finished || token.cancelled) return
          btn.style.display = ''
          btn.classList.add('dsu-btnIn')
          hint.style.display = ''
          hint.classList.add('dsu-hintIn')
          btn.focus()
        }, Math.max(400, dwellMs || 700))
      })

      var onKey = function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault()
          confirm()
        }
      }
      /* 整个阶段都接受确认：动画没放完也能直接按，会立刻跳过渐入 */
      function confirm() {
        if (finished) return
        finished = true
        /* 若还在打字阶段就被确认，先把打字机与按钮就位 */
        if (prompt.__timer) { clearInterval(prompt.__timer); prompt.__timer = null }
        prompt.classList.remove('dsu-caret')
        btn.style.display = ''
        btn.classList.add('dsu-btnIn')
        sfx.confirm()
        document.removeEventListener('keydown', onKey)
        gateBox.classList.add('dsu-gateOut')
        setTimeout(function () {
          gateBox.classList.remove('dsu-gateOut')
          gateBox.innerHTML = ''
          resolve()
        }, 240)
      }
      btn.addEventListener('click', confirm)
      document.addEventListener('keydown', onKey)
      if (token.cancelled) { document.removeEventListener('keydown', onKey); resolve() }
    })
  }

  /* ---------- 引擎 ---------- */
  var playing = false
  var cancelToken = null
  var currentFx = null
  var currentAnim = null

  /* 全局唯一的 Esc 监听（模块级，引用当前 token，重播不累积） */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !cancelToken || cancelToken.cancelled) return
    var root = document.getElementById(ROOT_ID)
    if (!root) return
    var cfg = readCfg()
    if (!cfg.allowSkip) return
    cancelToken.cancelled = true
    cancelToken.timers.forEach(clearTimeout)
    stopAudio()
    root.classList.add('dsu-exit')
    setTimeout(function () { teardown(root) }, 700)
  })

  function wait(ms, token) {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve() }, ms)
      if (token) token.timers.push(t)
    })
  }

  function teardown(root) {
    stopAudio()
    if (currentAnim) { currentAnim.stop(); currentAnim = null }
    if (currentFx) { currentFx(); currentFx = null }
    if (root && root.parentNode) root.parentNode.removeChild(root)
    document.documentElement.classList.remove('dsu-lock')
    if (document.body) document.body.style.overflow = ''
    playing = false
  }

  function play() {
    if (playing) return
    playing = true
    var cfg = readCfg()
    var faction = FACTIONS[cfg.faction] ? cfg.faction : 'allied'
    var meta = FACTIONS[faction]
    var sfx = makeSfx(cfg)
    var ms = function (x) { return Math.max(40, Math.round(x / (cfg.speed || 1))) }
    var token = { cancelled: false, timers: [] }
    cancelToken = token

    loadAssetManifest()   /* 预热素材清单：让第一幕之后各幕能立刻判断有没有素材 */

    /* 播了就记上，刷新不重播（session / daily 模式） */
    writeFlag('sessionStorage', 'dsh-mo-startup:shown', '1')
    writeFlag('localStorage', 'dsh-mo-startup:day', new Date().toISOString().slice(0, 10))

    var root = document.getElementById(ROOT_ID)
    if (!root) {
      root = el('div')
      root.id = ROOT_ID
      document.body.appendChild(root)
    }
    root.className = 'dsu-root'
    root.dataset.faction = faction
    /* 背景：档位决定是否模糊，veilOpacity 决定遮罩不透明度（1 = 完全不透明） */
    var backdropMode = BACKDROPS[cfg.backdrop] === undefined ? 'solid' : cfg.backdrop
    var veilAlpha = Number(cfg.veilOpacity)
    if (!isFinite(veilAlpha)) veilAlpha = BACKDROPS[backdropMode]
    veilAlpha = Math.min(1, Math.max(0.1, veilAlpha))
    /* solid 档位强制不透明，避免用户把透明度调乱后界面又透出来 */
    if (backdropMode === 'solid') veilAlpha = 1
    root.dataset.backdrop = backdropMode
    root.style.setProperty('--veil-alpha', String(veilAlpha))
    document.documentElement.classList.add('dsu-lock')
    if (document.body) document.body.style.overflow = 'hidden'

    /* 骨架：遮罩层 → 粒子层 → 内容 */
    root.innerHTML = ''
    root.appendChild(el('div', 'dsu-veil'))
    currentFx = startFx(faction, root)
    var topbar = el('div', 'dsu-topbar')
    var brand = el('div', 'dsu-brand')
    var markBox = el('div', 'dsu-mark')
    var markImg = new Image()
    markImg.src = iconUrl(faction + '.webp')
    markImg.alt = meta.zh
    markImg.draggable = false
    markImg.onerror = function () {
      markBox.innerHTML = ''
      markBox.appendChild(el('span', 'dsu-markFallback', meta.mark))
    }
    markBox.appendChild(markImg)
    brand.appendChild(markBox)
    var brandText = el('div')
    brandText.appendChild(el('div', 'dsu-brandZh', meta.zh))
    brandText.appendChild(el('div', 'dsu-brandEn dsu-mono', meta.en + ' · DEEPSEEK HARNESS'))
    brand.appendChild(brandText)
    topbar.appendChild(brand)
    var topRight = el('div', 'dsu-topRight')
    var badge = el('div', 'dsu-badge dsu-mono', '')
    topRight.appendChild(badge)
    var skipBtn = el('button', 'dsu-skip', 'SKIP ▸')
    topRight.appendChild(skipBtn)
    topbar.appendChild(topRight)
    root.appendChild(topbar)

    var stage = el('div', 'dsu-stage')
    root.appendChild(stage)
    /* 确认交互的预留区：固定在底部，按钮出现在这里，不会把上方内容顶动 */
    var gateBox = el('div', 'dsu-gate')
    root.appendChild(gateBox)

    var status = el('div', 'dsu-status')
    var logBox = el('div', 'dsu-log dsu-mono')
    status.appendChild(logBox)
    status.appendChild(el('div', 'dsu-motto', meta.motto))
    root.appendChild(status)

    function log(tag, text) {
      var line = el('div', 'dsu-logLine')
      var b = el('b', null, '[' + tag + '] ')
      line.appendChild(b)
      line.appendChild(document.createTextNode(text))
      logBox.appendChild(line)
      while (logBox.children.length > 2) logBox.removeChild(logBox.firstChild)
    }

    function finish() {
      if (token.cancelled) return
      token.cancelled = true
      token.timers.forEach(clearTimeout)
      stopAudio()
      root.classList.add('dsu-exit')
      setTimeout(function () { teardown(root) }, Math.min(700, ms(700)))
    }

    if (cfg.allowSkip) {
      skipBtn.addEventListener('click', finish)
    } else {
      skipBtn.style.display = 'none'
    }

    var ctx = {
      cfg: cfg, root: root, sfx: sfx, ms: ms, log: log,
      pending: [],          /* 本幕登记的打字机 Promise（每幕开始清空） */
      anim: null,           /* 本幕的 SVG 动画驱动（每幕新建，幕末停止） */
      commander: function () {
        return cfg.commander || meta.commanderDefault
      }
    }

    /* 图标页（第 0 幕）+ 阵营序列 */
    var scenes = [makeIntroScene(meta, ctx)].concat(meta.scenes)
    var chain = Promise.resolve()

    var currentScene = 0
    scenes.forEach(function (scene, i) {
      chain = chain.then(function () {
        currentScene = i
        if (token.cancelled) return
        badge.textContent = 'PHASE ' + ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + scenes.length).slice(-2)
        stage.innerHTML = ''
        gateBox.innerHTML = ''
        var sceneBox = el('div', 'dsu-scene')
        stage.appendChild(sceneBox)
        if (scene.sfx) sfx[scene.sfx] && sfx[scene.sfx]()

        ctx.pending.length = 0                       /* 本幕的打字机等待队列 */
        if (ctx.anim) ctx.anim.stop()                /* 上一幕的动画驱动收工 */
        ctx.anim = createAnimator()
        currentAnim = ctx.anim
        var cleanup = scene.render(sceneBox, ctx)    /* render 返回 Promise（打字机）或 cleanup 函数 */
        ctx.anim.prime()                             /* 立刻摆到 t=0 姿态，避免第一帧跳动 */
        var base = (cleanup && typeof cleanup.then === 'function') ? cleanup : Promise.resolve()
        var cleanupFn = (typeof cleanup === 'function') ? cleanup : null
        /* 等"返回值"和"本幕所有打字机"都完成，避免文字没打完就切下一幕 */
        var visual = Promise.all([base].concat(ctx.pending))

        /* 语音与视觉并行；停留 = max(视觉基准, 语音时长 + 240ms 收尾) */
        var spoke = voiceLine(scene, faction, cfg, sfx)
        var hold = Promise.all([visual, spoke]).then(function (r) {
          var spokenSec = r[1] || 0
          var target = Math.max(ms(scene.hold), spokenSec * 1000 + ms(240))
          var spent = spokenSec * 1000
          return wait(Math.max(0, target - spent), token)
        })

        var gate = hold.then(function () {
          if (token.cancelled) return
          if (scene.interact && cfg.requireInteraction) {
            return waitForConfirm(scene, gateBox, sfx, token, ms(700))
          }
        })

        return gate.then(function () {
          if (cleanupFn) { try { cleanupFn() } catch (e) { /* noop */ } }
          if (ctx.anim) ctx.anim.stop()              /* 本幕动画到此为止 */
        })
      })
    })

    chain.then(finish).catch(function (err) {
      /* 不要静默吞异常：某一幕渲染/发声出错时留下痕迹，便于定位 */
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[dsh-mo-startup-screen] 第 ' + (currentScene + 1) + ' 幕出错，动画提前收尾：', err)
        }
      } catch (e) { /* 连日志都失败就算了 */ }
      finish()
    })

    /* 首次用户手势补一次 AudioContext resume（浏览器自动播放策略） */
    var unlock = function () { ac(); document.removeEventListener('pointerdown', unlock) }
    document.addEventListener('pointerdown', unlock)
  }

  /* ---------- 对外 API ---------- */
  window.__DSH_MO_STARTUP_API__ = {
    replay: function () {
      /* 取消进行中的旧序列，避免旧链收尾时 stopAudio 掐断新播放 */
      if (cancelToken && !cancelToken.cancelled) {
        cancelToken.cancelled = true
        cancelToken.timers.forEach(clearTimeout)
      }
      var root = document.getElementById(ROOT_ID)
      if (root) teardown(root)
      playing = false
      play()
    },
    stop: function () {
      var root = document.getElementById(ROOT_ID)
      if (root) teardown(root)
    },
    factions: Object.keys(FACTIONS),
    /* 排障/测试用：导出每个阵营的幕序列元信息（图标页是否静默、哪些幕需要确认等） */
    inspect: function () {
      var out = {}
      Object.keys(FACTIONS).forEach(function (f) {
        var meta = FACTIONS[f]
        out[f] = [makeIntroScene(meta, null)].concat(meta.scenes).map(function (sc) {
          return {
            id: sc.id,
            audio: sc.audio || null,
            hasSay: !!(sc.say || sc.sayEn),
            interact: !!sc.interact,
            interactPrompt: (sc.interact && sc.interact.prompt) || null
          }
        })
      })
      return out
    }
  }

  /* 首次用户交互前 AudioContext 可能被挂起；交互后补播当前句由引擎自身保证
     （voice.line 内部 ac() 会尝试 resume）。 */

  /* Host 侧 bootstrap 已判定「这次不播」时直接退出，不占位。 */
  if (window.__DSH_MO_STARTUP_SKIP__) return

  play()
})()
