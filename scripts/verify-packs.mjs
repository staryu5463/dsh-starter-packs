#!/usr/bin/env node
// Verify every pack against the curated registry and a real DSH composition.
//
//   node scripts/verify-packs.mjs            static checks + install each pack and all packs together
//   node scripts/verify-packs.mjs --static   static checks only (no DSH, no network installs)
//
// Installs run in a throwaway DSH_HOME (.scratch-home/), never in ~/.dsh.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadPacks, REGISTRY_URL } from './packs-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const staticOnly = process.argv.includes('--static')
const dshHome = process.env.DSH_HOME ?? join(root, '.scratch-home')
const appDir = process.env.DSH_APP_DIR ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness')

let failures = 0
const fail = (msg) => { failures += 1; console.error(`FAIL ${msg}`) }
const ok = (msg) => console.log(`ok   ${msg}`)

// ---- static: schema + registry -------------------------------------------
const packs = loadPacks(join(root, 'packs'))
ok(`${packs.length} packs parsed: ${packs.map(p => p.id).join(', ')}`)

const res = await fetch(REGISTRY_URL)
if (!res.ok) throw new Error(`registry fetch failed: HTTP ${res.status}`)
const registry = (await res.json()).plugins
const byNpm = new Map(registry.filter(p => p.npm).map(p => [p.npm, p]))

const seen = new Map()
for (const pack of packs) {
  for (const m of pack.plugins) {
    const entry = byNpm.get(m.npm)
    if (!entry) { fail(`${pack.id}: ${m.npm} is not in the curated registry (the market refuses to install it)`); continue }
    if (entry.deprecated) fail(`${pack.id}: ${m.npm} is deprecated in the registry`)
    const red = entry.capabilityRedLines
    if (red === undefined) console.warn(`warn ${pack.id}: ${m.npm} has no capability scan yet`)
    else if (red.length > 0 && !m.optional) fail(`${pack.id}: ${m.npm} has capability red lines and must be optional: ${red.join('; ')}`)
    if (seen.has(m.npm) && seen.get(m.npm) !== m.version) fail(`${m.npm} pinned to ${seen.get(m.npm)} and ${m.version} in different packs`)
    seen.set(m.npm, m.version)
  }
  ok(`${pack.id}: registry checks done`)
}
if (staticOnly) finish()

// ---- dynamic: install into a fresh profile and compose --------------------
function dsh(args) {
  const r = spawnSync(join(appDir, 'DeepSeek Harness.exe'), [
    '--expose-internals',
    join(appDir, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js'),
    ...args,
  ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: dshHome }, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 64 << 20 })
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

function verifyComposition(name, members) {
  const profile = `verify-${name}`
  rmSync(join(dshHome, 'profiles', profile), { recursive: true, force: true })
  const fresh = dsh([profile, '--from-default-profile', 'web', '--dump-config'])
  if (fresh.code !== 0) return fail(`${name}: could not create a fresh profile\n${fresh.out.slice(-800)}`)

  const add = dsh(['plugin', '--profile', profile, 'add', ...members.map(m => `${m.npm}@${m.version}`)])
  if (add.code !== 0) return fail(`${name}: install failed\n${add.out.slice(-1500)}`)

  const manifest = JSON.parse(readFileSync(join(dshHome, 'profiles', profile, 'package.json'), 'utf8'))
  const bundles = manifest.dsh?.profile?.bundles ?? []
  const missing = members.filter(m => !bundles.includes(m.npm)).map(m => m.npm)
  if (missing.length > 0) fail(`${name}: not selected as bundles after install: ${missing.join(', ')}`)

  const dump = dsh([profile, '--dump-config'])
  if (dump.code !== 0) return fail(`${name}: profile does not compose (would not boot)\n${dump.out.slice(-1500)}`)

  // Top-level loader rows sit at two-space indent under the root list.
  const ids = [...dump.out.matchAll(/^- id: (\S+)/gm)].map(m => m[1])
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
  if (dupes.length > 0) fail(`${name}: duplicate top-level loader ids: ${dupes.join(', ')}`)

  const layers = new Set([...dump.out.matchAll(/^# == (.+)$/gm)].flatMap(m => m[1].split(/, patched by /)))
  const silent = members.filter(m => !layers.has(m.npm)).map(m => m.npm)
  if (silent.length > 0) console.warn(`warn ${name}: no rows attributed to ${silent.join(', ')} in the dump (client-only or empty patch?)`)

  ok(`${name}: ${members.length} plugins installed, selected and composed`)
}

if (!existsSync(join(appDir, 'DeepSeek Harness.exe'))) {
  fail(`DeepSeek Harness not found at ${appDir} (set DSH_APP_DIR)`)
  finish()
}
for (const pack of packs) verifyComposition(pack.id, pack.plugins)
verifyComposition('all', [...new Map(packs.flatMap(p => p.plugins).map(m => [m.npm, m])).values()])
finish()

function finish() {
  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}
