// Browser half of dsh-starter-packs. Plain JS for the DSH client module loader;
// scripts/build.mjs replaces the PACKS placeholder and writes ../client.js.
window.__ModuleLoader__.load({
  id: 'dsh-starter-packs',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState, useSyncExternalStore } = React

    const NS = 'dsh-starter-packs'
    const PACKS = /*__PACKS__*/[]

    const zh = {
      nav: '整合包',
      intro: '一键装好一组经过实测能一起运行的插件。版本已锁定，可以取消勾选不想要的插件。',
      loading: '正在读取插件状态…',
      needMarket: '没有检测到插件市场（dshmarket），将改用官方安装对话框逐个安装。',
      registryError: '暂时读不到插件目录：{0}',
      installed: '已安装',
      installedOther: '已安装 {0}',
      notInstalled: '未安装',
      optional: '可选',
      redLine: '风险提示',
      installSelected: '安装选中的 {0} 个',
      allInstalled: '这一组已全部安装',
      selectedInstalled: '选中的插件都已安装',
      installing: '正在安装 {0}（{1}/{2}）…',
      installOne: '安装',
      stateDone: '已安装并生效',
      stateRestart: '已安装，重启后生效',
      stateFailed: '安装失败：{0}',
      stateBusy: '有 Agent 正在运行，等它结束后再点安装',
      stateSkipped: '未在插件目录中找到，已跳过',
      restartHint: '部分插件需要重启 DeepSeek Harness 后才会生效。',
      restartNow: '立即重启',
      capsLabel: '需要的权限',
      plugins: '{0} 个插件',
      cap: {
        shell: '执行命令', 'fs-read': '读文件', 'fs-write': '写文件', network: '联网', env: '读环境变量',
        credentials: '读取凭据', llm: '调用模型', subagent: '子代理', 'host-runtime': '宿主运行时', 'dynamic-code': '动态代码',
      },
    }
    const en = {
      nav: 'Packs',
      intro: 'Install a set of plugins that were tested together, in one click. Versions are pinned; untick anything you do not want.',
      loading: 'Reading plugin status…',
      needMarket: 'dshmarket is not installed, so plugins install one at a time through the official dialog.',
      registryError: 'Cannot read the plugin catalog right now: {0}',
      installed: 'Installed',
      installedOther: 'Installed {0}',
      notInstalled: 'Not installed',
      optional: 'Optional',
      redLine: 'Risk',
      installSelected: 'Install {0} selected',
      allInstalled: 'Everything in this pack is installed',
      selectedInstalled: 'All selected plugins are installed',
      installing: 'Installing {0} ({1}/{2})…',
      installOne: 'Install',
      stateDone: 'Installed and running',
      stateRestart: 'Installed; restart to apply',
      stateFailed: 'Install failed: {0}',
      stateBusy: 'An agent is running. Install again once it finishes',
      stateSkipped: 'Not in the plugin catalog; skipped',
      restartHint: 'Some plugins take effect after DeepSeek Harness restarts.',
      restartNow: 'Restart now',
      capsLabel: 'Permissions',
      plugins: '{0} plugins',
      cap: {
        shell: 'Run commands', 'fs-read': 'Read files', 'fs-write': 'Write files', network: 'Network', env: 'Environment',
        credentials: 'Credentials', llm: 'Model calls', subagent: 'Sub-agents', 'host-runtime': 'Host runtime', 'dynamic-code': 'Dynamic code',
      },
    }

    const fmt = (text, ...args) => args.reduce((s, a, i) => s.replace(`{${i}}`, String(a)), text)

    // Same mount-point rule the market uses: the page is not path-routed, so
    // the document base is where the host serves plugin routes.
    function api(path) {
      return new URL(path.replace(/^\/+/, ''), document.baseURI).pathname
    }

    async function getJson(path) {
      const res = await fetch(api(path), { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      return { status: res.status, body }
    }

    async function postJson(path, payload) {
      const res = await fetch(api(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      return { status: res.status, body }
    }

    /** Market install outcome → one of our row states. */
    function outcomeOf({ status, body }) {
      if (status === 200 && body.ok === true) return { state: body.hot === true ? 'done' : 'restart' }
      if (status === 409 && body.agentsBusy === true) return { state: 'busy' }
      return { state: 'failed', detail: String(body.error ?? body.message ?? `HTTP ${status}`).slice(0, 200) }
    }

    /**
     * Correct a failed row from what the profile actually holds. Each install
     * makes the host recompose the profile, which can restart the market itself
     * while it is still answering: pnpm finished and the plugin is running, but
     * the response reports "cannot get required service ... in inactive context".
     */
    function reconcile(result, npm, snapshot) {
      if (result.state !== 'failed' || snapshot.installed?.[npm] === undefined) return result
      return { state: snapshot.activation?.[npm]?.state === 'live' ? 'done' : 'restart' }
    }

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 24px', color: 'var(--dsw-alias-label-primary)' },
      intro: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', margin: 0 },
      note: { fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-secondary)' },
      warnNote: { fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'var(--dsw-alias-state-warn-tertiary)', color: 'var(--dsw-alias-label-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      card: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
      head: { display: 'flex', alignItems: 'baseline', gap: 10 },
      title: { fontSize: 16, fontWeight: 600, margin: 0 },
      count: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      desc: { fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', margin: 0 },
      list: { display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--dsw-alias-border-l2)' },
      row: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' },
      check: { marginTop: 3, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
      body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
      nameLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      name: { fontSize: 13, fontWeight: 600, fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)' },
      ver: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      why: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' },
      chips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
      chip: { fontSize: 11, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-tertiary)' },
      badge: (tone) => ({ fontSize: 11, padding: '1px 6px', borderRadius: 4, color: `var(--dsw-alias-state-${tone}-primary)`, border: `1px solid var(--dsw-alias-state-${tone}-primary)` }),
      red: { fontSize: 12, color: 'var(--dsw-alias-state-warn-primary)' },
      status: (tone) => ({ fontSize: 12, color: tone ? `var(--dsw-alias-state-${tone}-primary)` : 'var(--dsw-alias-label-tertiary)' }),
      foot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      progress: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      button: (primary, disabled) => ({
        fontSize: 13, padding: '6px 14px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: primary ? 'none' : '1px solid var(--dsw-alias-border-l3)',
        background: primary ? 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary))' : 'transparent',
        color: primary ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-primary)',
      }),
    }

    const STATE_TONE = { done: 'success', restart: 'warn', failed: 'error', busy: 'warn', skipped: 'warn' }
    const STATE_KEY = { done: 'stateDone', restart: 'stateRestart', failed: 'stateFailed', busy: 'stateBusy', skipped: 'stateSkipped' }

    function MemberRow({ m, L, lang, entry, installedSpec, checked, onToggle, result, disabled, onInstallOne }) {
      const isInstalled = installedSpec !== undefined
      const caps = entry?.capabilities ?? []
      const red = entry?.capabilityRedLines ?? []
      let status
      if (result) status = h('span', { style: S.status(STATE_TONE[result.state]) }, fmt(L[STATE_KEY[result.state]], result.detail ?? ''))
      else if (isInstalled) status = h('span', { style: S.status('success') }, installedSpec.replace(/^[\^~]/, '') === m.version ? L.installed : fmt(L.installedOther, installedSpec))
      else status = h('span', { style: S.status() }, L.notInstalled)
      return h('div', { style: S.row },
        h('input', {
          type: 'checkbox', style: S.check, checked: checked && !isInstalled, disabled: isInstalled || disabled,
          onChange: onToggle, 'aria-label': m.npm,
        }),
        h('div', { style: S.body },
          h('div', { style: S.nameLine },
            h('span', { style: S.name }, m.npm),
            h('span', { style: S.ver }, `@${m.version}`),
            m.optional ? h('span', { style: S.badge('warn') }, L.optional) : null,
            status),
          h('div', { style: S.why }, m.why[lang]),
          caps.length > 0 ? h('div', { style: S.chips, title: L.capsLabel }, caps.map(c => h('span', { key: c, style: S.chip }, L.cap[c] ?? c))) : null,
          red.length > 0 ? h('div', { style: S.red }, `${L.redLine}：${red.join('；')}`) : null),
        onInstallOne && !isInstalled
          ? h('button', { type: 'button', style: S.button(false, disabled), disabled, onClick: onInstallOne }, L.installOne)
          : null)
    }

    function PackCard({ pack, L, lang, ctx }) {
      const { registry, installed, market, busy, setBusy, refresh, setNeedsRestart, owner } = ctx
      const [selected, setSelected] = useState(() => new Set(pack.plugins.filter(m => !m.optional).map(m => m.npm)))
      const [results, setResults] = useState({})
      const [progress, setProgress] = useState(null)

      const pending = pack.plugins.filter(m => selected.has(m.npm) && installed[m.npm] === undefined)
      const allInstalled = pack.plugins.every(m => installed[m.npm] !== undefined)
      const toggle = (npm) => setSelected(prev => {
        const next = new Set(prev)
        if (next.has(npm)) next.delete(npm)
        else next.add(npm)
        return next
      })

      const installAll = useCallback(async () => {
        setBusy(true)
        setResults({})
        const done = {}
        try {
          for (const [i, m] of pending.entries()) {
            setProgress(fmt(L.installing, m.npm, i + 1, pending.length))
            const entry = registry.get(m.npm)
            done[m.npm] = entry === undefined
              ? { state: 'skipped' }
              : outcomeOf(await postJson('/dsh-market/install', { url: entry.url, version: m.version }).catch(e => ({ status: 0, body: { error: e.message } })))
            setResults({ ...done })
            // A busy agent blocks every later install the same way; stop here.
            if (done[m.npm].state === 'busy') break
          }
        } finally {
          const snapshot = await refresh()
          if (snapshot) for (const npm of Object.keys(done)) done[npm] = reconcile(done[npm], npm, snapshot)
          setResults({ ...done })
          if (Object.values(done).some(r => r.state === 'restart')) setNeedsRestart(true)
          setProgress(null)
          setBusy(false)
        }
      }, [pending, registry, L])

      const installOne = (m) => owner.install({ spec: `${m.npm}@${m.version}`, title: m.npm, version: m.version })

      return h('section', { style: S.card },
        h('div', { style: S.head },
          h('h3', { style: S.title }, pack.title[lang]),
          h('span', { style: S.count }, fmt(L.plugins, pack.plugins.length))),
        h('p', { style: S.desc }, pack.description[lang]),
        h('div', { style: S.list }, pack.plugins.map(m => h(MemberRow, {
          key: m.npm, m, L, lang,
          entry: registry.get(m.npm),
          installedSpec: installed[m.npm],
          checked: selected.has(m.npm),
          onToggle: () => toggle(m.npm),
          result: results[m.npm],
          disabled: busy,
          onInstallOne: market === 'missing' && typeof owner?.install === 'function' ? () => installOne(m) : null,
        }))),
        market === 'ok'
          ? h('div', { style: S.foot },
              h('span', { style: S.progress }, progress ?? (pending.length > 0 ? '' : allInstalled ? L.allInstalled : L.selectedInstalled)),
              h('button', {
                type: 'button', style: S.button(true, busy || pending.length === 0),
                disabled: busy || pending.length === 0, onClick: installAll,
              }, fmt(L.installSelected, pending.length)))
          : null)
    }

    function PacksTab({ t, locale, owner }) {
      const snap = useSyncExternalStore(cb => locale.subscribe(cb), () => locale.getSnapshot())
      const lang = String(snap?.active ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
      const L = lang === 'zh' ? zh : en
      const [market, setMarket] = useState('loading')
      const [error, setError] = useState(null)
      const [registry, setRegistry] = useState(() => new Map())
      const [installed, setInstalled] = useState({})
      const [busy, setBusy] = useState(false)
      const [needsRestart, setNeedsRestart] = useState(false)
      const [canRestart, setCanRestart] = useState(false)

      /** Re-read profile state; returns the /installed payload, or null when it is unavailable. */
      const refresh = useCallback(async () => {
        try {
          const inst = await getJson('/dsh-market/installed')
          if (inst.status === 404) { setMarket('missing'); return null }
          setInstalled(inst.body.installed ?? {})
          const reg = await getJson('/dsh-market/registry')
          if (reg.status !== 200) throw new Error(reg.body.error ?? `HTTP ${reg.status}`)
          setRegistry(new Map((reg.body.registry?.plugins ?? []).filter(p => p.npm).map(p => [p.npm, p])))
          const caps = await getJson('/dsh-market/api/v1/capabilities').catch(() => null)
          setCanRestart(caps?.body?.restart?.supported === true)
          setMarket('ok')
          return inst.body
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          setMarket(prev => (prev === 'loading' ? 'error' : prev))
          return null
        }
      }, [])
      useEffect(() => { refresh() }, [refresh])

      const restart = () => postJson('/dsh-market/restart', {})

      if (market === 'loading') return h('div', { style: S.page }, h('div', { style: S.note }, L.loading))
      const ctx = { registry, installed, market, busy, setBusy, refresh, setNeedsRestart, owner }
      return h('div', { style: S.page },
        h('p', { style: S.intro }, L.intro),
        market === 'missing' ? h('div', { style: S.note }, L.needMarket) : null,
        error ? h('div', { style: S.note }, fmt(L.registryError, error)) : null,
        needsRestart
          ? h('div', { style: S.warnNote }, h('span', null, L.restartHint),
              canRestart ? h('button', { type: 'button', style: S.button(true, busy), disabled: busy, onClick: restart }, L.restartNow) : null)
          : null,
        PACKS.map(pack => h(PackCard, { key: pack.id, pack, L, lang, ctx })))
    }

    return {
      name: NS,
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: { nav: zh.nav }, en: { nav: en.nav } }), `${NS}: dictionaries`)
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('plugins.tab', () => ctx.slots.register({
          name: 'plugins.tab',
          id: NS,
          // After the market's own tab (-1), before the host's Discover tab.
          order: -0.5,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({ t }),
        }, (owner = {}) => h(PacksTab, { t, locale: ctx.locale, owner })))
      },
    }
  },
})
