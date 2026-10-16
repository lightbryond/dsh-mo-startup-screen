/**
 * dsh-mo-startup-screen — 浏览器半侧（设置页「开屏动画 · 心灵终结」）
 * ----------------------------------------------------------------------------
 * 以 dsh.client bundle 格式加载（手写 ModuleLoader bundle，无需构建）：
 * 在 DSH 设置里注册一个 `settings.section`，可切换四大阵营、改指挥官名称、
 * 播放时机、语音与音效等。
 *
 * 数据走 Host 半侧自带的 HTTP API（GET/POST /dsh-mo-startup/config）。
 * 注册 id 必须等于 loader entry 名（dsh-mo-startup-screen），否则
 * ModuleLoader 会报 "loaded without registering dsh-mo-startup-screen"。
 */
window.__ModuleLoader__.load({
  id: 'dsh-mo-startup-screen',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-mo-startup/config'
    var MANIFEST_API = '/dsh-mo-startup/assets-manifest'

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__mo_root{max-width:640px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__mo_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__mo_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_field{display:flex;flex-direction:column;gap:5px}',
      '.__mo_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__mo_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__mo_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__mo_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__mo_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__mo_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:200px}',
      '.__mo_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__mo_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__mo_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__mo_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__mo_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__mo_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__mo_btn:disabled{opacity:.5;cursor:default}',
      '.__mo_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__mo_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__mo_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__mo_factions{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__mo_faction{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px;background:var(--dsw-alias-bg-layer-3)}',
      '.__mo_faction:hover{border-color:var(--dsw-alias-state-business-primary)}',
      '.__mo_factionOn{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary) inset}',
      '.__mo_factionName{font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}',
      '.__mo_factionEn{font-family:ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.14em;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_factionDesc{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_dot{width:10px;height:10px;border-radius:50%;flex:none}',
      '.__mo_factionImg{width:30px;height:30px;object-fit:contain;filter:drop-shadow(0 0 5px rgba(0,0,0,0.4))}',
      '.__mo_assets{border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.8;color:var(--dsw-alias-label-tertiary)}',
      '.__mo_assets code{font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-primary)}',
      '.__mo_slotOk{color:var(--dsw-alias-state-business-primary)}',
      '.__mo_slotMiss{opacity:.55}'
    ].join('')
    var tagId = 'dsh-mo-startup-screen/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-mo-startup-screen'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 阵营元数据（与 splash.js 的 FACTIONS 对齐） ─────────────────────── */
    var FACTION_META = [
      { id: 'allied', zh: '同盟国联军', en: 'ALLIED NATIONS', color: '#4da3ff', title: '指挥官',
        desc: '蓝白全息终端：卫星链路、身份核验、超时空传送仪充能、作战控制连线。副官为冷静清晰的盟军 EVA 女声。' },
      { id: 'soviet', zh: '苏维埃联盟', en: 'SOVIET UNION', color: '#e0301e', title: '将军同志',
        desc: '红黑重工业：战斗警报、战场控制、战争工厂、铁幕充能。副官为坚定有力的苏联女声。' },
      { id: 'epsilon', zh: '厄普西隆军', en: 'EPSILON ARMY', color: '#a64dff', title: '异教',
        desc: '幽紫心灵网络：心灵信标、凝视之瞳、支配仪充能、「尤里即是主宰」。副官为低沉耳语感的厄普西隆声线。' },
      { id: 'foehn', zh: '焚风反抗军', en: 'FOEHN REVOLT', color: '#2fe0c0', title: '指挥官',
        desc: '青绿数据流：加密信号、沃克网级联、神经同步、纳米汇聚。副官为中性冷静的焚风 AI 声线。' }
    ]
    function factionMeta(id) {
      for (var i = 0; i < FACTION_META.length; i++) if (FACTION_META[i].id === id) return FACTION_META[i]
      return FACTION_META[0]
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__mo_field' },
        h('label', { className: '__mo_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__mo_hint' }, props.hint) : null
      )
    }

    function TextInput(props) {
      return h('input', {
        className: '__mo_input' + (props.mono ? ' __mo_inputMono' : ''),
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Select(props) {
      return h('select', {
        className: '__mo_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }

    function Check(props) {
      return h('label', { className: '__mo_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__mo_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__mo_hint' }, props.hint) : null
        )
      )
    }

    function Range(props) {
      return h('div', { className: '__mo_row' },
        h('input', {
          type: 'range', min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          disabled: !!props.disabled,
          style: { flex: '1 1 200px', opacity: props.disabled ? 0.5 : 1 },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__mo_status' }, props.display)
      )
    }

    /* 背景档位预设：与 lib/splash.js 的 BACKDROPS 保持一致 */
    var BACKDROP_PRESETS = { solid: 1, soft: 0.93, veil: 0.72, clear: 0.32 }
    var BACKDROP_OPTIONS = [
      ['solid', '不透明（默认，完全盖住 DSH 界面）'],
      ['soft', '几乎不透明（隐约透出）'],
      ['veil', '半透明 + 背景模糊'],
      ['clear', '明显透出应用界面']
    ]

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    var FALLBACK = {
      backdrop: 'solid', veilOpacity: 1,
      voice: true, voiceSource: 'asset', voiceVolume: 0.9, voiceCue: true, voiceLead: 240,
      voiceRate: 0.9, voicePitch: 0.9, voiceLang: 'zh',
      sound: true, soundVolume: 0.5, faction: 'allied', commander: ''
    }
    function num(v, d) {
      var n = Number(v)
      return isFinite(n) ? n : d
    }

    var FALLBACK_VERSION = '1.0.0'
    function readInjectedVersion() {
      try {
        var v = window.__DSH_MO_STARTUP_VERSION__
        return v ? String(v) : ''
      } catch (e) { return '' }
    }

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [manifest, setManifest] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setFile(j.file || '')
            if (j.version) setVersion(String(j.version))
          })
          .catch((e) => setError('读取配置失败：' + String(e && e.message ? e.message : e)))
      }

      function loadManifest() {
        fetch(MANIFEST_API, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => { if (j && j.ok) setManifest(j.manifest) })
          .catch(() => { /* 清单只是提示，拿不到就算了 */ })
      }

      react.useEffect(() => { load(); loadManifest() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft((d) => Object.assign({}, d, { [key]: value }))
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(j.config)
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看效果。')
          })
          .catch((e) => setError('保存失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(j.config)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      /** 用宿主里已经注入好的配置做一次即时预览；没有就退回刷新页面。 */
      function preview() {
        var api = window.__DSH_MO_STARTUP_API__
        if (api && typeof api.replay === 'function') {
          /* 预览前先让运行时吃到当前草稿（未保存也能看效果） */
          window.__DSH_MO_STARTUP__ = Object.assign({}, window.__DSH_MO_STARTUP__ || {}, draft)
          api.replay()
          return
        }
        window.location.reload()
      }

      var versionLine = h('div', { className: '__mo_version' },
        'v' + (version || FALLBACK_VERSION) + ' · 《红色警戒2：心灵终结》主题开屏动画')

      if (!draft) {
        return h('div', { className: '__mo_root' },
          versionLine,
          h('div', { className: '__mo_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__mo_actions' },
            h('button', { className: '__mo_btn', onClick: load }, '重试')
          ) : null
        )
      }

      var meta = factionMeta(draft.faction)

      /* 语音素材占位提示 */
      var assetsBlock = null
      if (manifest) {
        var files = manifest[draft.faction] || []
        assetsBlock = h('div', { className: '__mo_assets' },
          files.length
            ? h('div', null,
                '当前阵营「' + meta.zh + '」已检测到 ' + files.length + ' 个语音素材：',
                files.map((f) => h('div', { key: f }, h('code', { className: '__mo_slotOk' }, 'lib/assets/' + draft.faction + '/' + f)))
              )
            : h('div', null,
                '当前阵营「' + meta.zh + '」还没有语音素材（语音槽位全部为空占位，播放时自动回落 TTS / 静默）。',
                h('br'),
                '把你的副官语音放到 ', h('code', null, 'lib/assets/' + draft.faction + '/'),
                ' 目录下即可，命名与推荐台词见插件目录里的 ', h('code', null, 'AUDIO.md'), '。'
              )
        )
      }

      return h('div', { className: '__mo_root' },
        versionLine,

        /* 阵营 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '阵营'),
          h('div', { className: '__mo_factions' },
            FACTION_META.map((f) => h('div', {
              key: f.id,
              className: '__mo_faction' + (draft.faction === f.id ? ' __mo_factionOn' : ''),
              onClick: () => set('faction', f.id)
            },
              h('div', { className: '__mo_factionName' },
                h('img', {
                  className: '__mo_factionImg',
                  src: '/dsh-mo-startup/asset/icons/' + f.id + '.webp',
                  alt: f.zh,
                  onError: function (e) {
                    /* 标志图缺失时回落为阵营色圆点 */
                    var img = e.currentTarget
                    var dot = document.createElement('i')
                    dot.className = '__mo_dot'
                    dot.style.background = f.color
                    dot.style.boxShadow = '0 0 8px ' + f.color
                    img.parentNode.replaceChild(dot, img)
                  }
                }),
                f.zh,
                h('span', { className: '__mo_factionEn' }, f.en)
              ),
              h('div', { className: '__mo_factionDesc' }, f.desc)
            ))
          ),
          h(Field, {
            label: '指挥官名称',
            hint: '终幕「欢迎回来，xxx」里的名字。留空则用阵营默认称谓（' + meta.title + ' / ' +
              (draft.faction === 'epsilon' ? 'PROSELYTE' : draft.faction === 'soviet' ? 'COMRADE GENERAL' : 'COMMANDER') + '）。'
          }, h(TextInput, {
            value: draft.commander,
            placeholder: '例如：' + (draft.faction === 'epsilon' ? '异教' : meta.title),
            maxLength: 32,
            onChange: (v) => set('commander', v)
          }))
        ),

        /* 播放 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '播放'),
          h(Check, {
            label: '启用开屏动画',
            hint: '关闭后直接进入主界面。',
            checked: draft.enabled,
            onChange: (v) => set('enabled', v)
          }),
          h(Field, { label: '播放时机' },
            h(Select, {
              value: draft.mode,
              options: [
                ['session', '每个浏览器会话一次'],
                ['daily', '每天一次'],
                ['always', '每次打开都播放']
              ],
              onChange: (v) => set('mode', v)
            })
          ),
          h(Field, { label: '速度倍率', hint: '0.35 慢放 · 1 原速 · 3 快放。各阵营全套约 12–18 秒。' },
            h(Range, {
              value: num(draft.speed, 1), min: 0.35, max: 3, step: 0.05,
              display: num(draft.speed, 1).toFixed(2) + '×',
              onChange: (v) => set('speed', v)
            })
          )
        ),

        /* 背景 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '背景'),
          h(Field, {
            label: '背景档位',
            hint: '默认「不透明」—— 开屏时完全盖住 DSH 界面，动画与粒子不受应用界面干扰。' +
              '需要透出应用界面时再选其它档位（会自动配一个合适的透明度，可用下面的滑杆微调）。'
          },
            h(Select, {
              value: draft.backdrop || 'solid',
              options: BACKDROP_OPTIONS,
              onChange: (v) => {
                setDraft((d) => Object.assign({}, d, { backdrop: v, veilOpacity: BACKDROP_PRESETS[v] }))
                setNotice(null)
              }
            })
          ),
          h(Field, {
            label: '背景不透明度',
            hint: (draft.backdrop || 'solid') === 'solid'
              ? '当前是「不透明」档位，恒为 100%（想调低请先切换档位）。'
              : '越小越能看见背后的应用界面；建议 0.7 以上，否则动画主体会被界面干扰。'
          },
            h(Range, {
              value: num(draft.veilOpacity, 1), min: 0.1, max: 1, step: 0.01,
              display: Math.round(num(draft.veilOpacity, 1) * 100) + '%',
              disabled: (draft.backdrop || 'solid') === 'solid',
              onChange: (v) => set('veilOpacity', v)
            })
          )
        ),

        /* 交互 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '交互'),
          h(Check, {
            label: '需要人工确认',
            hint: '身份核验 / 接管战场等关键幕会停下来等按钮 / Enter / 空格；关闭则整段自动播放。',
            checked: draft.requireInteraction,
            onChange: (v) => set('requireInteraction', v)
          }),
          h(Check, {
            label: '允许跳过',
            hint: '右上角显示 SKIP，按 Esc 也能直接进主界面。',
            checked: draft.allowSkip,
            onChange: (v) => set('allowSkip', v)
          })
        ),

        /* 语音 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '副官语音'),
          h(Check, {
            label: '副官语音播报',
            hint: '每一幕文字出现的同一时刻由阵营副官念出台词；动画会等这句念完再推进，不会掐断语音。' +
              '浏览器要求先有一次点击才准出声，所以点过按钮之后才会听到声音。',
            checked: draft.voice,
            onChange: (v) => set('voice', v)
          }),
          draft.voice ? h(Field, {
            label: '语音来源',
            hint: '素材 = lib/assets/<阵营>/ 目录下你的副官 .wav（推荐，用你自己的生成模型产出）；' +
              'TTS = 系统语音合成；静默 = 只有画面。素材缺失时无论选哪个都会自动回落 TTS。'
          },
            h(Select, {
              value: draft.voiceSource || 'asset',
              options: [['asset', '副官语音素材（推荐）'], ['tts', '系统 TTS 合成'], ['off', '静默']],
              onChange: (v) => set('voiceSource', v)
            })
          ) : null,
          draft.voice ? h(Field, { label: 'TTS 回落时的播报语言' },
            h(Select, {
              value: draft.voiceLang,
              options: [['zh', '中文'], ['en', '英语'], ['both', '中英各念一遍']],
              onChange: (v) => set('voiceLang', v)
            })
          ) : null,
          draft.voice ? h(Field, { label: '音量' },
            h(Range, { value: num(draft.voiceVolume, 0.9), min: 0, max: 1, display: Math.round(num(draft.voiceVolume, 0.9) * 100) + '%', onChange: (v) => set('voiceVolume', v) })
          ) : null,
          draft.voice ? h(Check, {
            label: '播报前提示音',
            hint: '念台词之前先响两声轻提示 —— 更像「系统在播报」。',
            checked: draft.voiceCue,
            onChange: (v) => set('voiceCue', v)
          }) : null,
          draft.voice && draft.voiceCue ? h(Field, { label: '开口前留白', hint: '提示音响过之后停多久再开口。' },
            h(Range, {
              value: num(draft.voiceLead, 240), min: 0, max: 800, step: 20,
              display: Math.round(num(draft.voiceLead, 240)) + ' ms',
              onChange: (v) => set('voiceLead', v)
            })
          ) : null,
          draft.voice ? h('div', { className: '__mo_hint' },
            'TTS 回落参数（语速 ' + num(draft.voiceRate, 0.9).toFixed(2) + '× / 音调 ' + num(draft.voicePitch, 0.9).toFixed(2) +
            '）暂在配置文件里改：' + (file || '~/.dsh/dsh-mo-startup.json')
          ) : null,
          assetsBlock
        ),

        /* 音效 */
        h('div', { className: '__mo_group' },
          h('div', { className: '__mo_groupTitle' }, '界面音效'),
          h(Check, {
            label: '界面音效',
            hint: '打字机滴答 / 确认双音 / 警报 / 风声等，全部 WebAudio 现场合成，不含音频文件。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          }),
          draft.sound ? h(Field, { label: '音效音量' },
            h(Range, { value: num(draft.soundVolume, 0.5), min: 0, max: 1, display: Math.round(num(draft.soundVolume, 0.5) * 100) + '%', onChange: (v) => set('soundVolume', v) })
          ) : null
        ),

        /* 预览 + 操作 */
        h('div', { className: '__mo_actions' },
          h('button', { className: '__mo_btn', onClick: preview }, '▶ 立即预览（用当前面板里的配置）'),
          file ? h('span', { className: '__mo_status' }, '配置文件：' + file) : null
        ),

        h('div', { className: '__mo_actions' },
          h('button', {
            className: '__mo_btn __mo_btnPrimary',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__mo_btn', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__mo_btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__mo_ok' }, notice) : null,
          error ? h('span', { className: '__mo_err' }, error) : null
        )
      )
    }

    /* ── 桌面端自举 ──────────────────────────────────────────────────────── */
    /* Host 半侧靠 ctx.webServer.tapIndex 往 index.html 里注入启动界面。
       web profile 一定走这条路；但 Electron 也可能改用 file:// + IPC 直接下发
       前端，那时 index 注入整条不生效。所以浏览器半侧自己兜一层：
       没被 Host 接管时，由本侧建根节点 + 拉 splash.css/splash.js 自举。 */
    var BOOT_ROUTE = '/dsh-mo-startup'

    function readFlag(store, key) {
      try {
        var s = window[store]
        return s ? s.getItem(key) : null
      } catch (e) { return null }
    }

    function writeFlag(store, key, value) {
      try {
        var s = window[store]
        if (s) s.setItem(key, value)
      } catch (e) { /* 隐私模式下可能抛，忽略 */ }
    }

    function markBooted() {
      try { window.__DSH_MO_STARTUP_BOOT__ = 'client' } catch (e) { /* noop */ }
    }

    function loadScript(src, fail) {
      var s = document.createElement('script')
      s.src = src
      s.async = false
      if (typeof fail === 'function') {
        s.addEventListener('load', function () { fail(null) })
        s.addEventListener('error', function () { fail(new Error('script load failed: ' + src)) })
      }
      ;(document.head || document.documentElement).appendChild(s)
    }

    function loadCss(href, fail) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      if (typeof fail === 'function') {
        link.addEventListener('load', function () { fail(null) })
        link.addEventListener('error', function () { fail(new Error('css load failed: ' + href)) })
      }
      ;(document.head || document.documentElement).appendChild(link)
    }

    function release(ok) {
      if (ok) return
      try {
        var r = document.getElementById('dsh-mo-startup-root')
        if (r && r.parentNode) r.parentNode.removeChild(r)
        if (document.documentElement.classList) document.documentElement.classList.remove('dsu-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_MO_STARTUP_FAILED__ = true
      } catch (e) { /* 兜底不再抛 */ }
    }

    function injectRoot(cfg) {
      var root = document.getElementById('dsh-mo-startup-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'dsh-mo-startup-root'
        document.body.appendChild(root)
      }
      root.className = 'dsu-root dsu-boot'
      if (document.documentElement.classList) document.documentElement.classList.add('dsu-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      var failed = false
      var cssReady = false
      var scriptReady = false
      function guard(err) {
        if (err) {
          if (!failed && typeof console !== 'undefined' && console.warn) {
            console.warn('[dsh-mo-startup-screen] 启动界面自举失败，已放开页面：', err.message)
          }
          failed = true
          release(false)
          return
        }
        if (cssReady && scriptReady) release(true)
      }

      loadCss(BOOT_ROUTE + '/splash.css', function (err) {
        if (err) { guard(err); return }
        cssReady = true
        guard(null)
      })

      window.__DSH_MO_STARTUP__ = cfg || {}
      try {
        delete window.__DSH_MO_STARTUP_LOADED__
      } catch (e) { window.__DSH_MO_STARTUP_LOADED__ = undefined }
      loadScript(BOOT_ROUTE + '/splash.js?t=' + Date.now(), function (err) {
        if (err) { guard(err); return }
        scriptReady = true
        guard(null)
      })

      setTimeout(function () {
        try {
          var r = document.getElementById('dsh-mo-startup-root')
          if (r && r.className && r.className.indexOf('dsu-boot') !== -1) release(false)
        } catch (e) { /* 兜底不再抛 */ }
      }, 9000)
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_MO_STARTUP_BOOT__) return          /* 已被 Host 或本侧接管 */
        if (window.__DSH_MO_STARTUP__) return               /* 配置已在页面上：Host 注入过 */
        if (document.getElementById('dsh-mo-startup-root')) return
        if (window.__DSH_MO_STARTUP_FAILED__ === true) return
        markBooted()
        fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) { return j && j.ok === true ? j.config : null })
          .catch(function () { return null })
          .then(function (cfg) {
            cfg = cfg || { enabled: true, mode: 'session', speed: 1, faction: 'allied' }
            if (cfg.enabled === false) return
            var today = new Date().toISOString().slice(0, 10)
            if (cfg.mode === 'session' && readFlag('sessionStorage', 'dsh-mo-startup:shown') === '1') return
            if (cfg.mode === 'daily' && readFlag('localStorage', 'dsh-mo-startup:day') === today) return
            if (cfg.mode === 'session') writeFlag('sessionStorage', 'dsh-mo-startup:shown', '1')
            if (cfg.mode === 'daily') writeFlag('localStorage', 'dsh-mo-startup:day', today)
            return injectRoot(cfg)
          })
          .catch(function () { /* 自举失败就算了，页面本来就是好的 */ })
      } catch (e) { /* 自举是兜底，绝不许把宿主带崩 */ }
    }

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      /* 桌面端兜底：Host 的 index 注入不生效时，由这里自举启动界面。
         正常 web 流程下 __DSH_MO_STARTUP__/__DSH_MO_STARTUP_BOOT__ 已就位，本调用直接返回。 */
      selfBoot()
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'mo-startup-screen', order: 26, label: '开屏动画 · 心灵终结' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
