/**
 * Resolve the BabelFHIR-TS generator release an IG build should use: the newest release that
 * PASSED STABLE PARITY, is published, and has not been deprecated. Never simply the newest.
 *
 * The parity gate (30 IGs against two external validators) runs in the generator's own repo
 * and writes one entry per release to history-stable.json. A hard failure (output that does not
 * compile) leaves no entry, so absence means "did not get through parity". A score floor is
 * optional and off by default: a healthy release scored internal 72 / firely 84 / hl7 82 when
 * this was written, so a plausible-looking floor of 80 would reject a good one.
 *
 * Parity validates IG conformance, not that generated code compiles in a consumer: 1.6.4
 * passed it and failed with TS2688. A deprecation on npm is the maintainer withdrawing a
 * version outright, so it vetoes. Checked lazily, newest first, so the usual cost is one call.
 *
 * Fails closed: if nothing qualifies it throws rather than fall back to the newest release,
 * because one bad generator release would break every IG package built with it.
 */
import { execFileSync } from 'node:child_process'

export const DEFAULT_HISTORY_URL = 'https://babelfhir-ts.github.io/parity-report/history-stable.json'

const VALIDATORS = ['internal', 'firely', 'hl7']

/** @param {string} version */
export function isExactVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version)
}

/** Compare dotted numeric versions; positive when `a` is newer. @param {string} a @param {string} b */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

/**
 * Lowest `validation` percentage across the validators an entry recorded, or null.
 * @param {import('./resolve-generator.js').ParityEntry} entry
 */
export function lowestValidation(entry) {
  const scores = VALIDATORS.map((key) => entry[key]?.validation).filter((n) => typeof n === 'number')
  return scores.length ? Math.min(...scores) : null
}

/**
 * Why an entry cannot be used, or null when it qualifies on its parity record alone.
 * @param {import('./resolve-generator.js').ParityEntry} entry
 * @param {{ minSupported?: string | null, minValidation?: number | null }} rules
 */
export function disqualification(entry, rules = {}) {
  const version = typeof entry.version === 'string' ? entry.version : ''
  if (!isExactVersion(version)) return 'no usable version recorded'
  if (rules.minSupported && compareVersions(version, rules.minSupported) < 0) return `older than the minimum supported ${rules.minSupported}`
  const lowest = lowestValidation(entry)
  if (lowest === null) return 'parity ran but recorded no validation scores'
  if (typeof rules.minValidation === 'number' && lowest < rules.minValidation) {
    return `lowest validation ${lowest}% is below the floor of ${rules.minValidation}%`
  }
  return null
}

export class NoUsableGeneratorError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'NoUsableGeneratorError'
  }
}

/** @param {string} packageName @returns {Set<string>} */
function npmPublishedVersions(packageName) {
  const out = execFileSync('npm', ['view', packageName, 'versions', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  /** @type {unknown} */
  const parsed = JSON.parse(out)
  return new Set((Array.isArray(parsed) ? parsed : [parsed]).filter((v) => typeof v === 'string'))
}

/**
 * The maintainer's deprecation message, or null. An empty answer is the "not deprecated" signal;
 * a lookup failure also returns null, so an unreachable registry cannot veto a release that parity
 * passed (the publish that follows fails on its own if npm is really down).
 * @param {string} packageName @param {string} version
 */
function npmDeprecation(packageName, version) {
  try {
    return (
      execFileSync('npm', ['view', `${packageName}@${version}`, 'deprecated'], {
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    )
  } catch {
    return null
  }
}

/**
 * @param {import('./resolve-generator.js').ResolveGeneratorOptions} [options]
 * @returns {Promise<import('./resolve-generator.js').ResolvedGenerator>}
 */
export async function resolveGenerator(options = {}) {
  const packageName = options.packageName ?? 'babelfhir-ts'
  const historyUrl = options.historyUrl ?? (process.env.PARITY_HISTORY_URL?.trim() || DEFAULT_HISTORY_URL)
  const fetchFn = options.fetch ?? globalThis.fetch
  const publishedVersions = options.publishedVersions ?? npmPublishedVersions
  const deprecationOf = options.deprecationOf ?? npmDeprecation
  const log = options.log ?? (() => undefined)
  const rules = { minSupported: options.minSupported ?? null, minValidation: options.minValidation ?? null }

  log(`score floor: ${rules.minValidation === null ? 'disabled' : `${rules.minValidation}%`}`)
  const res = await fetchFn(historyUrl, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`Cannot read stable parity history (${res.status} ${res.statusText}): ${historyUrl}`)
  /** @type {unknown} */
  const body = await res.json()
  const entries = typeof body === 'object' && body !== null && 'entries' in body && Array.isArray(body.entries) ? body.entries : null
  if (!entries) throw new Error(`Unexpected history shape at ${historyUrl}: expected { entries: [...] }`)
  log(`stable parity history: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`)

  /** @type {Array<{ version: string, reason: string }>} */
  const skipped = []
  const candidates = []
  for (const entry of entries) {
    const reason = disqualification(entry, rules)
    if (reason) {
      skipped.push({ version: String(entry.version ?? '(no version)'), reason })
      log(`  skip ${entry.version ?? '(no version)'}: ${reason}`)
    } else {
      candidates.push(entry)
    }
  }
  if (candidates.length === 0) {
    throw new NoUsableGeneratorError(
      `No ${packageName} release has a usable stable parity result (checked ${entries.length} entries at ${historyUrl}). ` +
        'Refusing to fall back to the newest release, which has not been through parity. ' +
        'Fix: run the "Pipeline Parity Test" workflow on BabelFHIR-TS main to record a result.',
    )
  }
  candidates.sort((a, b) => compareVersions(b.version, a.version))

  const published = await publishedVersions(packageName)
  const withdrawn = []
  for (const candidate of candidates) {
    if (!published.has(candidate.version)) continue
    const deprecation = await deprecationOf(packageName, candidate.version)
    if (deprecation) {
      withdrawn.push(`${candidate.version} (${deprecation})`)
      skipped.push({ version: candidate.version, reason: `deprecated: ${deprecation}` })
      log(`  skip ${candidate.version}: deprecated on npm: ${deprecation}`)
      continue
    }
    if (candidate.version !== candidates[0].version) log(`newest parity-passing ${candidates[0].version} was not usable; using ${candidate.version}`)
    log(`chosen ${candidate.version}: ${candidate.packageCount ?? '?'} IGs, lowest validation ${lowestValidation(candidate)}%`)
    return { version: candidate.version, entry: candidate, skipped }
  }

  const publishedCandidates = candidates.filter((c) => published.has(c.version)).map((c) => c.version)
  throw new NoUsableGeneratorError(
    publishedCandidates.length === 0
      ? `Parity passed for ${candidates.map((c) => c.version).join(', ')}, but none of those are published as ${packageName}. Refusing to guess.`
      : `Every parity-passing, published release is deprecated: ${withdrawn.join(', ')}. ` +
          'Refusing to build with a version its maintainer has withdrawn. ' +
          'Fix: release a version that passes parity, or un-deprecate one above.',
  )
}
