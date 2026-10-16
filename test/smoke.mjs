/* dsh-mo-startup-screen — 冒烟测试
 * 跑法：node test/smoke.mjs
 * 覆盖：文件齐备性、package.json 契约、Host normalize、四阵营定义完整性、
 *       音频槽位与 AUDIO.md 一致性、客户端 bundle 注册形状。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0

function ok(cond, label) {
  if (cond) {
    console.log('  ✓ ' + label)
  } else {
    failures++
    console.error('  ✗ ' + label)
  }
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

/* 1. 文件齐备 */
console.log('1. 文件齐备')
const pkgForFiles = JSON.parse(read('package.json'))
function pkgFiles() { return pkgForFiles.files || [] }
for (const f of [
  'package.json', 'cordis.patch.yml', 'cordis.dev.yml',
  'lib/index.js', 'lib/client.js', 'lib/splash.js', 'lib/splash.css',
  'preview/index.html', 'README.md', 'AUDIO.md',
  'lib/assets/allied', 'lib/assets/soviet', 'lib/assets/epsilon', 'lib/assets/foehn',
  'dev/harness.mjs', 'dev/mount-desktop.mjs', 'dev/check-audio.mjs', 'dev/dump-scenes.mjs',
  'dev/fix-audio.mjs', 'dev/audio-format.mjs',
  'test/backdrop.test.mjs', 'test/dom-stub.mjs', 'test/confirm.test.mjs', 'test/anim.test.mjs',
  'LICENSE', '.gitignore'
]) {
  ok(fs.existsSync(path.join(ROOT, f)), f)
}
/* package.json 的 files 列表必须都真实存在（否则 npm pack / 发布时会缺文件） */
for (const f of pkgFiles()) {
  ok(fs.existsSync(path.join(ROOT, f)), 'package.json files → ' + f)
}

/* 2. package.json 契约 */
console.log('2. package.json 契约')
const pkg = pkgForFiles
ok(pkg.name === 'dsh-mo-startup-screen', 'name = dsh-mo-startup-screen')
ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch 指向 cordis.patch.yml')
ok(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform = web')
ok(pkg.exports?.['./client'] === './lib/client.js', 'exports["./client"] 指向 lib/client.js')
ok(fs.existsSync(path.join(ROOT, pkg.dsh.bundle.patch)), 'bundle patch 文件存在')

/* 3. cordis.patch.yml */
console.log('3. cordis.patch.yml')
const patch = read('cordis.patch.yml')
ok(patch.includes('id: dsh-mo-startup-screen'), 'patch 含 loader 条目 id')
ok(patch.includes('name: dsh-mo-startup-screen'), 'patch 以包名引用插件')

/* 4. Host 半侧 */
console.log('4. Host 半侧 (lib/index.js)')
const host = read('lib/index.js')
ok(host.includes("const FACTIONS = ['allied', 'soviet', 'epsilon', 'foehn']"), 'FACTIONS 白名单含四阵营')
ok(/wav\|mp3/i.test(host), 'asset 路由同时放行 .wav 与 .mp3')
ok(host.includes("faction: 'allied'"), 'DEFAULTS 含 faction 字段')
ok(host.includes("backdrop: 'solid'") && host.includes('veilOpacity: 1'), 'DEFAULTS 含 backdrop/veilOpacity（默认不透明）')
ok(host.includes("backdrop: ['solid', 'soft', 'veil', 'clear']"), 'backdrop 枚举含四档')
ok(/veilOpacity: \[0\.1, 1\]/.test(host), 'veilOpacity 有合法区间约束')
ok(host.includes('/dsh-mo-startup'), '路由前缀 /dsh-mo-startup')
ok(host.includes('tapIndex'), '使用 tapIndex 注入首屏')
ok(host.includes('dsh-mo-startup.json'), '配置持久化到 ~/.dsh/dsh-mo-startup.json')
ok(!/export\s+default/.test(host), '不导出 default（避免 unwrapExports 坑）')

/* 5. 运行时四阵营定义 */
console.log('5. splash.js 四阵营定义')
const splash = read('lib/splash.js')
const factionRe = /\/\* -+ .+? -+ \*\/\s*(\w+): \{/g
const factionBlocks = []
let m
while ((m = factionRe.exec(splash))) factionBlocks.push({ id: m[1], start: m.index })
const FACTION_IDS = ['allied', 'soviet', 'epsilon', 'foehn']
ok(JSON.stringify(factionBlocks.map((b) => b.id)) === JSON.stringify(FACTION_IDS), '按序定义四个阵营: ' + factionBlocks.map((b) => b.id).join(', '))

const audioSlots = {} // faction -> [slot]
for (let i = 0; i < factionBlocks.length; i++) {
  const start = factionBlocks[i].start
  const end = i + 1 < factionBlocks.length ? factionBlocks[i + 1].start : splash.indexOf('/* ---------- 引擎')
  const block = splash.slice(start, end)
  const scenes = [...block.matchAll(/id: '(\w+)', audio: ('(\w+)'|null)/g)]
  const fid = factionBlocks[i].id
  ok(scenes.length >= 5, `${fid} 至少 5 幕（实际 ${scenes.length} 幕）`)
  audioSlots[fid] = scenes.map((s) => s[3]).filter(Boolean)
  const finale = scenes.find((s) => s[1] === 'finale')
  ok(!!finale, `${fid} 有终幕 finale`)
  const interacts = (block.match(/interact: \{/g) || []).length
  ok(interacts >= 1, `${fid} 至少一幕需要人工确认（实际 ${interacts} 幕）`)
}
ok(splash.includes('__DSH_MO_STARTUP_API__'), '暴露 __DSH_MO_STARTUP_API__')
ok(splash.includes('inspect: function ()'), '暴露 inspect()（导出各阵营幕元信息，供测试与排障）')
ok(splash.includes("var raf = (typeof window"), '动画帧/计时统一走 raf/caf/nowMs 助手（带非浏览器环境回落）')
ok(!/^\s*(raf|rafId) = requestAnimationFrame/m.test(splash) && !splash.includes('cancelAnimationFrame(raf)'),
  '不再裸调 requestAnimationFrame / cancelAnimationFrame')
ok(splash.includes('幕出错，动画提前收尾'), '播放中断时输出现场信息（不静默吞异常）')
/* 确认交互：渐进出现 + 底部预留区（四个阵营共用同一实现） */
ok(splash.includes('function waitForConfirm'), '确认交互由统一的 waitForConfirm 实现（四阵营共用）')
ok(splash.includes("el('div', 'dsu-gate')") && splash.includes('gateBox.innerHTML = \'\''),
  '确认按钮渲染在底部预留区 .dsu-gate（不挤动画面）')
ok(splash.includes('dsu-btnIn') && splash.includes('dsu-gateOut') && splash.includes('dsu-hintIn') &&
  splash.includes('dsu-gatePromptDone'),
  '按钮/提示行按"渐入 + 淡出"节奏出现，提示行打完后保留并提亮')
const promptCount = (splash.match(/prompt: '/g) || []).length
ok(promptCount === 5, `五个确认幕都配了等待提示文案（实得 ${promptCount}）`)
const gateCss = read('lib/splash.css')
ok(gateCss.includes('.dsu-gate') && gateCss.includes('dsuBtnIn') && gateCss.includes('dsuBtnRing') &&
  gateCss.includes('dsuGateOut') && gateCss.includes('dsuHintIn') && gateCss.includes('dsu-gatePromptDone'),
  'CSS 含预留区与全部渐进动画（含呼吸光环 dsuBtnRing）')
/* 提示行必须"打完 + 停留"之后才让按钮渐入 */
ok(splash.includes('Math.max(400, dwellMs || 700)') && splash.includes('ms(700)'),
  '提示行打完后停留一拍（≥400ms）才渐入按钮')
ok(host.includes("lastIndexOf('asset')"), '素材路由兼容"前缀被剥离/未剥离"两种形态')
ok(splash.includes("speechSynthesis"), '含 TTS 回落')
ok(splash.includes('function playAsset'), '含素材播放 playAsset')

/* 6. 样式四阵营主题 */
console.log('6. splash.css 四阵营主题')
const css = read('lib/splash.css')
for (const f of FACTION_IDS) {
  ok(css.includes(`[data-faction="${f}"]`), `含 [data-faction="${f}"] 主题`)
}
ok(css.includes('.dsu-radarSvg') && css.includes('.dsu-gearsSvg') && css.includes('.dsu-psiwaveSvg') &&
  css.includes('.dsu-nanoSvg') && css.includes('.dsu-hive'),
  '四个阵营各有专属视觉组件类（焚风只保留粒子类图形：纳米汇聚 / 蜂格 / 数据瀑布）')
/* 圆形/弧形图形全部改用内联 SVG 显式绘制，不再依赖 border-radius */
ok(splash.includes('function radarSvg') && splash.includes('function gearsSvg') &&
  splash.includes('function psiwaveSvg') && splash.includes('function eyeSvg') &&
  splash.includes('function nanoSvg'),
  '五个几何图形均由 SVG 工厂显式绘制（雷达/齿轮/波纹/瞳/纳米）')
/* 焚风：线条类视觉已整体移除，只保留粒子类图形 */
ok(!splash.includes('function windSvg') && !splash.includes('curveSeg') && !splash.includes('WIND_LINES') &&
  !splash.includes('dsu-fxWisp'),
  '焚风风带（曲线线条）在运行时已彻底移除')
ok(!splash.includes("el('div', 'dsu-wind')"),
  '更早的直线风带实现也确认无残留')
ok(!read('lib/splash.css').includes('dsu-windSvg') && !read('lib/splash.css').includes('fxWisp'),
  'CSS 中已无风带相关样式')
/* 焚风背景粒子：与盟军/苏联同一套方案（上升光尘），仅换焚风配色 */
ok(splash.includes("count: 96, type: 'mote'"), '焚风背景为光尘粒子 mote（与盟军/苏联同一套观感）')
ok(splash.includes("colors: ['#2fe0c0', '#9ff5e4', '#7fe9d6', '#ffffff']"), '焚风配色（青绿系）正确')
ok(!splash.includes("type: 'wind'") && !splash.includes("type: 'gust'") && !splash.includes("type: 'streak'"),
  '已彻底移除"流动风线"方案（wind / gust / streak 全无残留）')
ok(!splash.includes('p.pts = []') && !splash.includes('dsu-fxEddy'),
  '相关气流绘制分支与圆弧涡旋代码已清理')
/* 三个阵营的背景粒子共用同一套绘制（mote / ember 圆点） */
ok(splash.includes("count: 90, type: 'mote'") && splash.includes("count: 120, type: 'ember'"),
  '盟军光尘 / 苏联火星配置保留')
/* 动画一律 JS 逐帧驱动：SMIL 在部分渲染器里不执行 → 齿轮/雷达会定格 */
ok(splash.includes('function createAnimator') && splash.includes('ctx.anim.add('),
  '图形动画由 createAnimator 逐帧改写属性驱动')
ok(!splash.includes('<animateTransform') && !splash.includes("'<animate "),
  '运行时不使用 SMIL（animate / animateTransform）')
ok(splash.includes("setAttribute('transform', 'rotate(") , '旋转通过 setAttribute 写 transform')
ok(splash.includes('var t = (nowMs() - t0) / 1000'),
  '动画时钟统一用 nowMs()（不与 rAF 时间戳混用）')
/* 齿轮与进度条都挂在动画驱动上 */
ok(splash.includes('anim.add(g, function (t, e)') && splash.includes('cog(88, 78, 50, 7, false)'),
  '齿轮组交给动画驱动（主/副齿轮反向旋转）')
ok((splash.match(/ctx\.anim\.add\(bar, function/g) || []).length >= 2,
  '两个进度条（战场控制 / 生产线）都由动画驱动按时间推进')
ok(!/dsu-gear\b/.test(splash) && !/class="dsu-blip"/.test(splash),
  '旧的 border-radius 圆形元素已全部移除')

/* 7. 客户端 bundle */
console.log('7. client.js 设置面板')
const client = read('lib/client.js')
ok(client.includes("id: 'dsh-mo-startup-screen'"), 'ModuleLoader 注册 id 与包名一致')
ok(client.includes("__ModuleLoader__.load"), '手写 lazy-CJS bundle 格式')
ok(client.includes("name: 'settings.section'"), '注册 settings.section')
ok(client.includes('mo-startup-screen'), '设置区 id = mo-startup-screen')
for (const f of FACTION_IDS) {
  ok(client.includes(`id: '${f}'`), `面板含阵营选项 ${f}`)
}

/* 8. 音频槽位与 AUDIO.md 一致性 */
console.log('8. 音频槽位 ↔ AUDIO.md')
const audioDoc = read('AUDIO.md')
for (const fid of FACTION_IDS) {
  for (const slot of audioSlots[fid]) {
    ok(audioDoc.includes(`lib/assets/${fid}/${slot}.wav`), `AUDIO.md 记载了 ${fid}/${slot}.wav`)
  }
  /* 图标页已改为静默（audio: null），AUDIO.md 不应再记载 intro 槽位 */
  ok(!audioDoc.includes(`lib/assets/${fid}/intro.wav`), `${fid} 图标页保持静默（AUDIO.md 无 intro 槽位）`)
}

/* 8b. 图标与阵营标志素材 */
console.log('8b. 图标素材')
for (const icon of ['deepseek.svg', 'allied.webp', 'soviet.webp', 'epsilon.webp', 'foehn.webp']) {
  ok(fs.existsSync(path.join(ROOT, 'lib/assets/icons', icon)), 'lib/assets/icons/' + icon)
}
ok(host.includes('isIconGroup') && /svg\|webp\|png/.test(host), 'Host 路由放行 icons/(svg|webp|png)')
ok(read('lib/assets/icons/deepseek.svg').includes('currentColor'), 'deepseek.svg 使用 currentColor 动态配色')

/* 8c. 图标页 + 粒子背景 + 遮罩层 */
console.log('8c. 图标页 / 粒子 / 遮罩')
ok(splash.includes('function makeIntroScene'), '含图标页场景 makeIntroScene')
ok(splash.includes("id: 'intro', audio: null"), '图标页不出声（audio: null，去掉突兀的 TTS 欢迎语）')
ok(!splash.includes('introSay'), '已移除图标页 TTS 台词字段 introSay')
ok(!splash.includes('dsu-flash'), '已移除图标页整屏闪白')
ok(splash.includes('dsu-introOut'), '图标页改为柔和叠化淡出')
ok(!css.includes('dsu-flash') && !css.includes('dsuFlash'), 'CSS 中闪白样式已清除')
ok(css.includes('dsuIntroOut'), 'CSS 含柔和淡出动画')
ok(splash.includes('function loadAssetManifest') && splash.includes('function assetState'), '运行时含素材清单预取与判定')
/* 音频：区分"没素材"与"有素材但解不了码" —— 后者不再用 TTS 冒充 */
ok(splash.includes('if (sec === -2)') && splash.includes('语音素材无法解码'),
  '素材解不了码时静默 + 告警（不回落 TTS 冒充）')
ok(splash.includes("return grab('.wav')") && splash.includes("return buf || grab('.mp3')"),
  '素材按 .wav → .mp3 顺序尝试')
/* 每幕的打字机必须全部等完（避免文字没打完就切幕/出按钮） */
ok(splash.includes('pending: []') && splash.includes("ctx.pending.length = 0") &&
  splash.includes('Promise.all([base].concat(ctx.pending))'),
  '引擎等待本幕全部打字机（不只看 render 返回值）')
ok(splash.includes('if (known === false && !hasSay) return Promise.resolve(0)'), '无素材且无台词时整幕静默（不出提示音）')
ok(splash.includes('function startFx'), '含粒子背景引擎 startFx')
ok(splash.includes("var FX_CFG"), '四阵营粒子配置 FX_CFG')
for (const fx of ["allied:", "soviet:", "epsilon:", "foehn:"]) {
  ok(splash.slice(splash.indexOf('var FX_CFG'), splash.indexOf('function startFx')).includes(fx), `FX_CFG 含 ${fx}`)
}
ok(splash.includes("dsu-veil"), '运行时挂遮罩层 dsu-veil')
ok(splash.includes('var BACKDROPS = { solid: 1'), '运行时含背景档位预设表')
ok(splash.includes("root.dataset.backdrop = backdropMode"), '按配置写入 data-backdrop')
ok(splash.includes("setProperty('--veil-alpha'"), '按配置写入 --veil-alpha')
ok(splash.includes("if (backdropMode === 'solid') veilAlpha = 1"), 'solid 档强制不透明（防配置漂移）')
ok(splash.includes("iconUrl(faction + '.webp')"), '左上角使用阵营标志图')
ok(css.includes('.dsu-intro') && css.includes('dsuIntroOut'), 'CSS 含图标页与柔和过场样式（无闪白）')
ok(css.includes('.dsu-veil') && css.includes('.dsu-fx'), 'CSS 含遮罩层与粒子画布样式')
ok(css.includes('.dsu-mark img'), 'CSS 含标志图尺寸样式')
ok(css.includes('background: transparent'), '根背景透明（可见性交给遮罩层）')
ok(css.includes('opacity: var(--veil-alpha, 1)'), '遮罩层不透明度由 --veil-alpha 控制（默认 1 = 不透明）')
for (const bd of ['soft', 'veil', 'clear']) {
  ok(css.includes(`[data-backdrop="${bd}"]`), `CSS 含 ${bd} 档位的模糊规则`)
}
ok(css.includes('#dsh-mo-startup-root .dsu-veil::before') && css.includes('mask-image'), '遮罩层含网格底纹')
ok(css.includes('dsuAurora'), '遮罩层含阵营光晕动画')
ok(!css.includes('dsuFadeIn'), '根节点不做整层淡入（否则不透明遮罩会渐显、期间露出应用界面）')
ok(css.includes('dsuTextureIn'), '底纹单独淡入，开场不生硬')
ok(client.includes('__mo_factionImg') && client.includes("/asset/icons/"), '设置面板阵营卡片使用标志图')
ok(client.includes('var BACKDROP_PRESETS') && client.includes('var BACKDROP_OPTIONS'), '设置面板含背景档位预设与选项')
ok(client.includes('veilOpacity: BACKDROP_PRESETS[v]'), '选档位时同步写入推荐不透明度')

/* 9. README 手动测试说明 */
console.log('9. README')
const readme = read('README.md')
ok(readme.includes('dsh web --patch'), 'README 含 dsh web --patch 开发挂载方法')
ok(readme.includes('dsh plugin --profile web add'), 'README 含打包安装方法')
ok(readme.includes('preview/index.html') || readme.includes('打开预览'), 'README 含静态预览方法')

/* 10. 测试台（dev/harness.mjs）端到端自检 —— 真实挂载 Host 半侧跑一遍全部路由 */
console.log('10. 测试台端到端自检')
{
  const port0 = 4522 + (process.pid % 200)
  const harness = spawn(process.execPath, ['dev/harness.mjs', '--port', String(port0)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  let hout = ''
  harness.stdout.on('data', (d) => { hout += d })
  harness.stderr.on('data', (d) => { hout += d })
  const port = await new Promise((resolve) => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      const m = hout.match(/127\.0\.0\.1:(\d+)/)
      if (m) { clearInterval(iv); resolve(Number(m[1])) }
      else if (Date.now() - t0 > 10000) { clearInterval(iv); resolve(0) }
    }, 100)
  })
  ok(port > 0, `测试台已启动（端口 ${port}）`)

  const get = (pp) => new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: pp }, (r) => {
      let b = ''
      r.on('data', (c) => { b += c })
      r.on('end', () => resolve({ code: r.statusCode, type: r.headers['content-type'] || '', body: b }))
    })
    req.on('error', () => resolve({ code: 0, type: '', body: '' }))
  })
  const post = (payload) => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/dsh-mo-startup/config', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (r) => {
      let b = ''
      r.on('data', (c) => { b += c })
      r.on('end', () => resolve(b))
    })
    req.on('error', () => resolve('{}'))
    req.end(JSON.stringify(payload))
  })

  if (port > 0) {
    /* 顺序很关键：先访问 / —— 早期版本在这里会把插件路由全部注销，属于回归点 */
    const home = await get('/')
    ok(home.code === 200 && home.body.includes('dsh-mo-startup-root'), '宿主页返回且已注入首屏根节点')
    ok(home.body.includes('__DSH_MO_STARTUP__') && home.body.includes('dsh-mo-startup/splash.js'), '配置对象与运行时脚本已注入')
    ok(home.body.includes('__DSH_MO_STARTUP_BOOT__'), '首屏兜底标记已注入')
    const css = await get('/dsh-mo-startup/splash.css')
    ok(css.code === 200 && css.type.includes('css'), 'splash.css 路由 200（先访问 / 后仍然可用）')
    const js = await get('/dsh-mo-startup/splash.js')
    ok(js.code === 200 && js.type.includes('javascript'), 'splash.js 路由 200')
    const cfg = await get('/dsh-mo-startup/config')
    ok(cfg.code === 200 && JSON.parse(cfg.body).ok === true, 'config API 可读')
    const man = await get('/dsh-mo-startup/assets-manifest')
    ok(man.code === 200 && JSON.parse(man.body).ok === true, '音频清单 API 可读')
    const webp = await get('/dsh-mo-startup/asset/icons/allied.webp')
    ok(webp.code === 200 && webp.type === 'image/webp', '阵营标志 .webp 按 image/webp 下发')
    const svg = await get('/dsh-mo-startup/asset/icons/deepseek.svg')
    ok(svg.code === 200 && svg.type.includes('svg'), 'DeepSeek 图标 .svg 按 image/svg+xml 下发')
    const miss = await get('/dsh-mo-startup/asset/allied/__no_such_slot__.wav')
    ok(miss.code === 404, '缺失语音槽位 404（前端据此回落 TTS）')
    if (fs.existsSync(path.join(ROOT, 'lib/assets/allied/boot.wav'))) {
      const real = await get('/dsh-mo-startup/asset/allied/boot.wav')
      ok(real.code === 200 && real.type === 'audio/wav', '已有语音素材按 audio/wav 下发')
    }
    const badExt = await get('/dsh-mo-startup/asset/allied/payload.js')
    ok(badExt.code === 404, '非白名单扩展名的素材请求被拒')
    const evil = await get('/dsh-mo-startup/asset/../../package.json')
    ok(evil.code === 404, '目录穿越请求被拒')
    const cfg0 = JSON.parse((await get('/dsh-mo-startup/config')).body).config
    ok(cfg0.backdrop === 'solid' && Number(cfg0.veilOpacity) === 1, '默认背景为「不透明」（开屏不受应用界面干扰）')
    await post({ patch: { backdrop: 'veil', veilOpacity: 0.72 } })
    const cfg1 = JSON.parse((await get('/dsh-mo-startup/config')).body).config
    ok(cfg1.backdrop === 'veil' && Number(cfg1.veilOpacity) === 0.72, '背景档位/不透明度可写入并读回')
    await post({ patch: { backdrop: 'solid', veilOpacity: 1 } })
    ok(JSON.parse((await get('/dsh-mo-startup/config')).body).config.backdrop === 'solid', '背景配置已还原为不透明')
    const before = JSON.parse((await get('/dsh-mo-startup/config')).body).config.faction
    const written = await post({ patch: { faction: 'soviet' } })
    ok(JSON.parse(written).config.faction === 'soviet', 'config API 可写（阵营切换）')
    const reread = JSON.parse((await get('/dsh-mo-startup/config')).body).config.faction
    ok(reread === 'soviet', '写入后读回一致（落盘生效）')
    await post({ patch: { faction: before } })
    ok(JSON.parse((await get('/dsh-mo-startup/config')).body).config.faction === before, '测试后已还原配置')
  }
  harness.kill()
}

/* 11. 背景档位映射单测（DOM 桩，无浏览器） */
console.log('11. 背景档位映射单测')
{
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['test/backdrop.test.mjs'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (code) => resolve({ code, out }))
  })
  ok(r.code === 0, '背景档位映射单测通过（默认不透明 / solid 强制 100% / 非法档位回落）')
  ok(r.out.includes('图标页在四个阵营中均为静默'), '图标页在四个阵营中均为静默（无 TTS 合成音）')
  if (r.code !== 0) console.error(r.out)
}

/* 12. 确认交互时序（DOM 桩 + 事件派发） */
console.log('12. 确认交互时序自检')
{
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['test/confirm.test.mjs', 'allied'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (code) => resolve({ code, out }))
  })
  ok(r.code === 0, '确认按钮"提示行 → 渐入 → 淡出推进"时序正确')
  ok(r.out.includes('播放期间无幕级报错'), '整段播放无幕级报错（含充能环等复杂幕）')
  ok(r.out.includes('按钮出现时提示行是完整文案'), '按钮出现时提示行已完整显示且仍在屏幕上')
  if (r.code !== 0) console.error(r.out)
}

/* 13. 动画驱动（齿轮转动 / 进度推进）—— 针对"齿轮不动"的回归 */
console.log('13. 动画驱动自检')
{
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['test/anim.test.mjs', 'soviet'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (code) => resolve({ code, out }))
  })
  ok(r.code === 0, '齿轮确实在转动（transform 逐帧变化）')
  ok(r.out.includes('副齿轮反向旋转'), '副齿轮反向旋转')
  ok(r.out.includes('进度条在推进'), '战争工厂生产线进度在推进')
  ok(r.out.includes('播放期间无幕级报错'), '动画驱动测试期间无幕级报错')
  if (r.code !== 0) console.error(r.out)
}

console.log('')
if (failures) {
  console.error(`✗ ${failures} 项断言失败`)
  process.exit(1)
} else {
  console.log('✓ 全部断言通过')
}
