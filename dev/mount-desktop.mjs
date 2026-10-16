/* ============================================================================
 * dsh-mo-startup-screen — 把插件挂进 DSH 桌面端 profile（免 dsh CLI）
 * ----------------------------------------------------------------------------
 * 为什么需要它：`dsh plugin add` 依赖 CLI 与 pnpm 解析，而你这台机器的
 * ~/.dsh/profiles/node_modules/@deepseek-ai/* 全是指向
 * C:\Windows\System32\node_modules（已不存在）的断链，CLI 因此频频失败。
 * 本插件零运行时依赖，不需要 pnpm 解析 —— 直接用目录联接 + bundles 列表即可。
 *
 * 做三件事（幂等、可逆）：
 *   1) 备份 profile 的 package.json 为 package.json.mo-backup（仅首次）
 *   2) 建目录联接 profiles/desktop/node_modules/dsh-mo-startup-screen → 本插件目录
 *   3) 把 dsh-mo-startup-screen 加进 profile package.json 的 dsh.profile.bundles
 *
 * 用法：
 *   node dev/mount-desktop.mjs            挂载
 *   node dev/mount-desktop.mjs --unmount  卸载（还原 package.json + 删联接）
 *   node dev/mount-desktop.mjs --status   只看当前状态
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG_NAME = 'dsh-mo-startup-screen'
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

const args = process.argv.slice(2)
const mode = args.includes('--unmount') ? 'unmount' : args.includes('--status') ? 'status' : 'mount'
const profileArg = (() => {
  const i = args.indexOf('--profile')
  return i >= 0 ? args[i + 1] : 'desktop'
})()

const PROFILE = path.join(DSH_HOME, 'profiles', profileArg)
const PROFILE_PKG = path.join(PROFILE, 'package.json')
const BACKUP = PROFILE_PKG + '.mo-backup'
const LINK = path.join(PROFILE, 'node_modules', PKG_NAME)

function log(...a) { console.log(...a) }

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function linkState() {
  try {
    const st = fs.lstatSync(LINK)
    if (st.isSymbolicLink()) {
      const target = fs.realpathSync(LINK)
      return { exists: true, kind: 'junction/symlink', target }
    }
    return { exists: true, kind: 'real-dir', target: LINK }
  } catch (err) {
    return { exists: false }
  }
}

function main() {
  if (!fs.existsSync(PROFILE)) {
    console.error(`✗ 找不到 profile 目录：${PROFILE}`)
    console.error('  确认 DSH 桌面端至少启动过一次，或改用 --profile <名字>')
    process.exit(1)
  }
  const pkg = readJson(PROFILE_PKG)
  const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
  const deps = pkg.dependencies || {}
  const linked = linkState()
  const inBundles = bundles.includes(PKG_NAME)

  if (mode === 'status') {
    log('profile      :', PROFILE)
    log('node_modules :', linked.exists ? `已存在（${linked.kind}${linked.target ? ' → ' + linked.target : ''}）` : '不存在')
    log('bundles 列表 :', inBundles ? '已包含 ' + PKG_NAME : '未包含 ' + PKG_NAME)
    log('dependencies :', deps[PKG_NAME] ? deps[PKG_NAME] : '(无)')
    log('备份文件     :', fs.existsSync(BACKUP) ? BACKUP : '(无)')
    return
  }

  if (mode === 'unmount') {
    if (!fs.existsSync(BACKUP) && inBundles) log('· 没有备份文件，将按记录直接移除条目')
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, PROFILE_PKG)
      log('✓ 已还原 package.json ←', BACKUP)
    } else {
      const idx = bundles.indexOf(PKG_NAME)
      if (idx >= 0) bundles.splice(idx, 1)
      delete deps[PKG_NAME]
      pkg.dependencies = deps
      if (pkg.dsh && pkg.dsh.profile) pkg.dsh.profile.bundles = bundles
      writeJson(PROFILE_PKG, pkg)
      log('✓ 已从 package.json 移除条目')
    }
    if (linked.exists) {
      try {
        if (linked.kind === 'real-dir') fs.rmSync(LINK, { recursive: true, force: true })
        else fs.unlinkSync(LINK)
        log('✓ 已删除 node_modules/' + PKG_NAME)
      } catch (err) {
        console.error('✗ 删除联接失败：', err.message)
      }
    } else {
      log('· 联接本来就不存在')
    }
    log('')
    log('完全退出并重新打开 DSH 桌面端即可生效。')
    return
  }

  /* ---- 挂载 ---- */
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(PROFILE_PKG, BACKUP)
    log('✓ 已备份 profile 配置 →', BACKUP)
  } else {
    log('· 备份已存在，跳过（保留最早的一份）')
  }

  if (!linked.exists) {
    fs.mkdirSync(path.dirname(LINK), { recursive: true })
    fs.symlinkSync(PLUGIN_ROOT, LINK, 'junction')
    log('✓ 已建立目录联接：', LINK, '→', PLUGIN_ROOT)
  } else if (linked.kind === 'real-dir') {
    log('! node_modules/' + PKG_NAME + ' 是实体目录（可能是之前 pnpm 装的），改用该目录内容，不改联接')
  } else {
    log('· 联接已存在 →', linked.target)
  }

  let changed = false
  if (!inBundles) {
    bundles.push(PKG_NAME)
    changed = true
  }
  if (!deps[PKG_NAME]) {
    deps[PKG_NAME] = 'link:' + PLUGIN_ROOT.replace(/\\/g, '/')
    changed = true
  }
  pkg.dependencies = deps
  if (!pkg.dsh) pkg.dsh = {}
  if (!pkg.dsh.profile) pkg.dsh.profile = {}
  pkg.dsh.profile.bundles = bundles
  writeJson(PROFILE_PKG, pkg)
  log(changed ? '✓ 已写入 package.json（dependencies + bundles）' : '· package.json 已是最新')

  log('')
  log('bundles 顺序：', bundles.join('  →  '))
  log('')
  log('下一步：')
  log('  1) 完全退出 DSH 桌面端（托盘也退掉），重新打开')
  log('  2) 刷新页面应看到开屏动画；设置页多出「开屏动画 · 心灵终结」')
  log('  3) 改完插件代码后重启桌面端即可生效（Host 按 mtime 读文件，改 CSS/JS 有时刷新就够）')
  log('  4) 不想要了：node dev/mount-desktop.mjs --unmount')
}

main()
