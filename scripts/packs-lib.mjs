// Shared pack loading and validation for the build and verify scripts.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const REGISTRY_URL = 'https://awesome-dsh-plugin.com/plugins.json'

const ID_RE = /^[a-z][a-z0-9-]{0,31}$/
const NPM_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const EXACT_SEMVER_RE = /^\d+\.\d+\.\d+$/

function localized(value, where) {
  if (typeof value !== 'object' || value === null || typeof value.zh !== 'string' || typeof value.en !== 'string'
    || value.zh.trim() === '' || value.en.trim() === '') {
    throw new Error(`${where} needs non-empty "zh" and "en" strings`)
  }
}

/** Read and validate every packs/*.json, sorted by `order`. Throws on the first invalid field. */
export function loadPacks(dir) {
  const packs = readdirSync(dir).filter(f => f.endsWith('.json')).map((file) => {
    const pack = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    const where = `packs/${file}`
    if (!ID_RE.test(pack.id ?? '')) throw new Error(`${where}: invalid id`)
    if (file !== `${pack.id}.json`) throw new Error(`${where}: file name must be ${pack.id}.json`)
    if (!Number.isInteger(pack.order)) throw new Error(`${where}: order must be an integer`)
    localized(pack.title, `${where} title`)
    localized(pack.description, `${where} description`)
    if (!Array.isArray(pack.plugins) || pack.plugins.length === 0) throw new Error(`${where}: plugins must be a non-empty list`)
    const names = new Set()
    for (const [i, m] of pack.plugins.entries()) {
      const at = `${where} plugins[${i}]`
      if (!NPM_RE.test(m.npm ?? '')) throw new Error(`${at}: invalid npm name`)
      if (!EXACT_SEMVER_RE.test(m.version ?? '')) throw new Error(`${at}: version must be an exact x.y.z release`)
      if (m.optional !== undefined && typeof m.optional !== 'boolean') throw new Error(`${at}: optional must be boolean`)
      localized(m.why, `${at} why`)
      if (names.has(m.npm)) throw new Error(`${at}: ${m.npm} listed twice`)
      names.add(m.npm)
    }
    return pack
  })
  const ids = packs.map(p => p.id)
  if (new Set(ids).size !== ids.length) throw new Error('duplicate pack ids')
  return packs.sort((a, b) => a.order - b.order)
}
