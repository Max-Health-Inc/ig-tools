/**
 * Compile a repo's own FHIR IG into a typed TypeScript package: SUSHI, pack the generated
 * resources as a FHIR NPM package, evict the stale cache entry, run babelfhir-ts.
 *
 * THE CACHE EVICTION IS THE STEP THAT MATTERS. babelfhir-ts caches an unpacked package under
 * `~/.fhir/packages/<id>@<version>` and reuses it whenever that directory exists. Right for a
 * published upstream IG (us-core@8.0.0 never changes), a trap for the IG being edited here:
 * sushi-config's `version` only moves on a release, so a recompile reads back the previous
 * package, reports success, and the artifacts just written are silently missing from the output.
 * Only this IG's id@version is removed; the core packages are expensive and not the ones changing.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * The IG's id and version as sushi-config.yaml states them, so no script restates them.
 * @param {string} sushiConfig the file's text
 */
export function parseIgIdentity(sushiConfig) {
  const id = /^id:\s*(\S+)/m.exec(sushiConfig)?.[1]
  const version = /^version:\s*(\S+)/m.exec(sushiConfig)?.[1]
  if (!id || !version) throw new Error('sushi-config.yaml states no id and version')
  return { id, version }
}

/** @param {string} igDir */
export function igIdentity(igDir) {
  return parseIgIdentity(readFileSync(join(igDir, 'sushi-config.yaml'), 'utf8'))
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

/** @param {string} command @param {string[]} args @param {string} [cwd] */
function run(command, args, cwd) {
  execFileSync(command, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' })
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
  const { id, version } = igIdentity(igDir)
  const tarball = join(igDir, `${id}-${version}.tgz`)

  log(`\n[1/3] SUSHI: ${id}@${version}`)
  run('npx', ['--yes', options.sushi ?? 'fsh-sushi@latest', igDir])

  log('\n[2/3] Packing the IG as a FHIR NPM package')
  mkdirSync(packageDir, { recursive: true })
  for (const file of packagedResources(readdirSync(generatedDir), id, options.includeImplementationGuide ?? false)) {
    copyFileSync(join(generatedDir, file), join(packageDir, file))
  }
  run('tar', ['-czf', tarball, '-C', packageDir, '.'])

  rmSync(cachedIgPath(id, version), { recursive: true, force: true })

  const { packageName, version: generatorVersion } = options.generator
  log(`\n[3/3] ${packageName}@${generatorVersion}: typed interfaces, validators and vocabulary constants`)
  run('npx', ['--yes', '--package', `${packageName}@${generatorVersion}`, 'babelfhir-ts', 'install', `./${tarball.split('\\').join('/')}`, ...(options.generatorArgs ?? [])])

  return { id, version, tarball }
}
