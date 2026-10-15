#!/usr/bin/env node
// Decides whether and as what to publish a generated IG package. Usage:
//   release-plan --package <name> --ig-version <x.y.z> --build-key <key> [--generator <x.y.z>]
// Prints key=value lines for $GITHUB_OUTPUT: publish, version, latest, tags (space-separated).
import { planRelease, readRegistry } from '../src/release-plan.js'

const args = process.argv.slice(2)
/** @param {string} flag */
const value = (flag) => {
  const index = args.indexOf(flag)
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined
}

const packageName = value('--package')
const igVersion = value('--ig-version')
const buildKey = value('--build-key')
if (!packageName || !igVersion || !buildKey) {
  console.error('usage: release-plan --package <name> --ig-version <x.y.z> --build-key <key> [--generator <x.y.z>]')
  process.exit(2)
}

try {
  const plan = planRelease({ igVersion, buildKey, generatorVersion: value('--generator'), registry: readRegistry(packageName) })
  console.error(
    plan.publish
      ? `${packageName}: publishing ${plan.version} for IG ${igVersion}${plan.latest ? '' : ' (not latest)'}`
      : `${packageName}: build ${plan.keyTag} already published as ${plan.version}`,
  )
  console.log(`publish=${plan.publish}`)
  console.log(`version=${plan.version}`)
  console.log(`latest=${plan.latest}`)
  console.log(`tags=${plan.tags.join(' ')}`)
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
