/**
 * Decide whether and as what to publish a generated IG package.
 *
 * The npm version follows the IG: major.minor are the IG's own, and the patch is the package's
 * revision, as `@types/*` does with its upstream. So a generator-only rebuild publishes the next
 * patch without anyone touching the IG version, and an IG version bump lands as that version.
 *
 * "Already published" is a `bk-<hash>` dist-tag of the build key (IG source, generator, flags),
 * because GitHub Packages drops custom package.json fields, so a key stored in the manifest
 * cannot be read back. The hash matches what fhir-igs has always tagged with.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { compareVersions, isExactVersion } from './resolve-generator.js'

/** @param {string} buildKey */
export function buildKeyTag(buildKey) {
  return `bk-${createHash('sha1').update(buildKey).digest('hex').slice(0, 16)}`
}

/** @param {string} version */
function line(version) {
  const [major, minor] = version.split('.')
  return `${major}.${minor}`
}

/** @param {string} version */
function nextPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

/**
 * The version for a new build of `igVersion`: the IG version itself, unless this IG's
 * major.minor already has a published build at or above it, then the next patch after that.
 * @param {string} igVersion
 * @param {readonly string[]} published
 */
export function nextVersion(igVersion, published) {
  if (!isExactVersion(igVersion)) throw new Error(`IG version must be x.y.z, got "${igVersion}"`)
  const sameLine = published.filter((v) => isExactVersion(v) && line(v) === line(igVersion)).sort(compareVersions)
  const highest = sameLine.at(-1)
  if (!highest || compareVersions(igVersion, highest) > 0) return igVersion
  return nextPatch(highest)
}

/**
 * @param {import('./release-plan.js').ReleasePlanOptions} options
 * @returns {import('./release-plan.js').ReleasePlan}
 */
export function planRelease({ igVersion, buildKey, generatorVersion, registry }) {
  const keyTag = buildKeyTag(buildKey)
  const existing = registry.distTags[keyTag]
  if (existing) return { publish: false, version: existing, latest: false, tags: [], keyTag }

  const version = nextVersion(igVersion, registry.versions)
  const currentLatest = registry.distTags.latest
  const latest = !currentLatest || !isExactVersion(currentLatest) || compareVersions(version, currentLatest) > 0
  const tags = [keyTag, `ig-${igVersion}`, ...(generatorVersion ? [`babelfhir-${generatorVersion}`] : [])]
  return { publish: true, version, latest, tags, keyTag }
}

/**
 * Published versions and dist-tags of a package, empty for one never published. Any other
 * registry failure throws: guessing "unpublished" would republish an existing version.
 * @param {string} packageName
 * @returns {import('./release-plan.js').RegistryState}
 */
export function readRegistry(packageName) {
  let out
  try {
    out = execFileSync('npm', ['view', packageName, 'versions', 'dist-tags', '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr) : ''
    if (stderr.includes('E404')) return { versions: [], distTags: {} }
    throw new Error(`Cannot read ${packageName} from the registry: ${stderr.trim() || String(err)}`)
  }
  return parseRegistryView(out)
}

/**
 * `npm view <pkg> versions dist-tags --json` output. npm wraps a multi-field answer in an array,
 * and a single published version arrives as a string rather than a list.
 * @param {string} json
 * @returns {import('./release-plan.js').RegistryState}
 */
export function parseRegistryView(json) {
  /** @type {unknown} */
  const parsed = JSON.parse(json)
  const record = Array.isArray(parsed) ? parsed.at(-1) : parsed
  if (typeof record !== 'object' || record === null) return { versions: [], distTags: {} }
  const rawVersions = 'versions' in record ? record.versions : []
  const rawTags = 'dist-tags' in record ? record['dist-tags'] : {}
  const versions = (Array.isArray(rawVersions) ? rawVersions : [rawVersions]).filter((v) => typeof v === 'string')
  /** @type {Record<string, string>} */
  const distTags = {}
  if (typeof rawTags === 'object' && rawTags !== null) {
    for (const [tag, version] of Object.entries(rawTags)) if (typeof version === 'string') distTags[tag] = version
  }
  return { versions, distTags }
}
