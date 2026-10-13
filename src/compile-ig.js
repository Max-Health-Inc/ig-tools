/**
 * Compile a repo's own FHIR IG into a typed TypeScript package: seed first-party dependencies,
 * SUSHI, pack as a FHIR NPM package, evict this IG's stale cache entry (babelfhir-ts reuses a
 * cached id@version, so a recompile would read the previous build), run babelfhir-ts.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * The IG's id, version and canonical as sushi-config.yaml states them, so no script restates them.
 * @param {string} sushiConfig the file's text
 */
export function parseIgIdentity(sushiConfig) {
  const id = /^id:\s*(\S+)/m.exec(sushiConfig)?.[1]
  const version = /^version:\s*(\S+)/m.exec(sushiConfig)?.[1]
  const canonical = /^canonical:\s*(\S+)/m.exec(sushiConfig)?.[1]
  if (!id || !version) throw new Error('sushi-config.yaml states no id and version')
  return { id, version, ...(canonical ? { canonical } : {}) }
}

/** @param {string} igDir */
export function igIdentity(igDir) {
  return parseIgIdentity(readFileSync(join(igDir, 'sushi-config.yaml'), 'utf8'))
}

/**
 * Whether sushi-config declares a dependency on a first-party IG seeded from npm (`<id>: dev`).
 * @param {string} sushiConfig the file's text
 */
export function hasDevDependency(sushiConfig) {
  const block = /^dependencies:[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m.exec(sushiConfig)?.[1] ?? ''
  return /^[ \t]+[\w.-]+:[ \t]*(?:dev|\{[ \t]*version:[ \t]*dev[ \t]*\})[ \t]*\r?$/m.test(block) || /^[ \t]+version:[ \t]*dev[ \t]*\r?$/m.test(block)
}

/**
 * The FHIR package's package.json: the caller's fields (fhirVersions, type, dependencies) under
 * the IG's own identity, which always wins.
 * @param {{ id: string, version: string, canonical?: string }} identity
 * @param {Record<string, unknown>} extra
 */
export function packageManifest(identity, extra) {
  return { ...extra, name: identity.id, version: identity.version, ...(identity.canonical ? { canonical: identity.canonical } : {}) }
}

/**
 * The manifest fields SUSHI already decided, read from the ImplementationGuide resource it wrote:
 * `fhirVersions` and `dependencies` (its dependsOn), so the package states what sushi-config says.
 * @param {unknown} implementationGuide
 * @returns {{ fhirVersions?: string[], dependencies?: Record<string, string> }}
 */
export function manifestFromImplementationGuide(implementationGuide) {
  if (typeof implementationGuide !== 'object' || implementationGuide === null) return {}
  const fhirVersion = Reflect.get(implementationGuide, 'fhirVersion')
  const dependsOn = Reflect.get(implementationGuide, 'dependsOn')
  const fhirVersions = Array.isArray(fhirVersion) ? fhirVersion.filter((v) => typeof v === 'string') : []
  /** @type {Record<string, string>} */
  const dependencies = {}
  for (const dep of Array.isArray(dependsOn) ? dependsOn : []) {
    const packageId = typeof dep === 'object' && dep !== null ? Reflect.get(dep, 'packageId') : undefined
    const version = typeof dep === 'object' && dep !== null ? Reflect.get(dep, 'version') : undefined
    if (typeof packageId === 'string' && typeof version === 'string') dependencies[packageId] = version
  }
  return {
    ...(fhirVersions.length > 0 ? { fhirVersions } : {}),
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
  }
}

/**
 * Which generated files go into the package: JSON resources, optionally without the
 * ImplementationGuide resource (it describes the publication, and babelfhir-ts has no use for it).
 * @param {string[]} files @param {string} id @param {boolean} includeImplementationGuide
 */
export function packagedResources(files, id, includeImplementationGuide) {
  return files.filter((file) => file.endsWith('.json') && (includeImplementationGuide || file !== `ImplementationGuide-${id}.json`))
}

/** Where babelfhir-ts caches an unpacked package. @param {string} id @param {string} version */
export function cachedIgPath(id, version, home = homedir()) {
  return join(home, '.fhir', 'packages', `${id}@${version}`)
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {string} command @param {string[]} args */
function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

/** @param {{ packageName: string, version: string }} generator @param {string[]} args */
function babelfhir(generator, args) {
  run('npx', ['--yes', '--package', `${generator.packageName}@${generator.version}`, 'babelfhir-ts', ...args])
}

/**
 * @param {import('./compile-ig.js').CompileIgOptions} options
 * @returns {import('./compile-ig.js').CompiledIg}
 */
export function compileIg(options) {
  const igDir = options.igDir ?? 'fhir'
  const generatedDir = join(igDir, 'fsh-generated', 'resources')
  const packageDir = options.packageDir ?? join(igDir, 'package')
  const log = options.log ?? ((line) => console.log(line))
  const identity = igIdentity(igDir)
  const { id, version } = identity
  const tarball = join(igDir, `${id}-${version}.tgz`)
  const embed = options.embedFhirPackage ?? false
  const manifest = options.manifest ?? (embed ? { type: 'fhir.ig' } : undefined)

  if (options.seedCache ?? hasDevDependency(readFileSync(join(igDir, 'sushi-config.yaml'), 'utf8'))) {
    log('\n[1/4] Seeding first-party IG dependencies installed through npm (<id>#dev)')
    babelfhir(options.generator, ['seed-cache'])
  }

  log(`\n[2/4] SUSHI: ${id}@${version}`)
  run('npx', ['--yes', options.sushi ?? 'fsh-sushi@latest', igDir])

  log('\n[3/4] Packing the IG as a FHIR NPM package')
  if (manifest) rmSync(packageDir, { recursive: true, force: true })
  mkdirSync(packageDir, { recursive: true })
  const generated = readdirSync(generatedDir)
  for (const file of packagedResources(generated, id, options.includeImplementationGuide ?? false)) {
    copyFileSync(join(generatedDir, file), join(packageDir, file))
  }
  if (manifest) {
    const igFile = `ImplementationGuide-${id}.json`
    const derived = generated.includes(igFile) ? manifestFromImplementationGuide(JSON.parse(readFileSync(join(generatedDir, igFile), 'utf8'))) : {}
    const dependencies = { ...derived.dependencies, ...(isRecord(manifest.dependencies) ? manifest.dependencies : {}) }
    const fields = { ...derived, ...manifest, ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}) }
    writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(packageManifest(identity, fields), null, 2)}\n`)
  }
  run('tar', ['-czf', tarball, '-C', packageDir, '.'])

  rmSync(cachedIgPath(id, version), { recursive: true, force: true })

  log(`\n[4/4] ${options.generator.packageName}@${options.generator.version}: typed interfaces, validators and vocabulary constants`)
  babelfhir(options.generator, ['install', `./${tarball.split('\\').join('/')}`, ...(embed ? ['--embed-fhir-package'] : []), ...(options.generatorArgs ?? [])])

  return { id, version, tarball }
}
