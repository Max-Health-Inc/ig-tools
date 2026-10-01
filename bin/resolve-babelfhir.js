#!/usr/bin/env node
// Prints the generator release to build with. Usage:
//   resolve-babelfhir [--package <name>] [--min-supported <x.y.z>] [--min-validation <percent>] [--explain]
import { NoUsableGeneratorError, resolveGenerator } from '../src/resolve-generator.js'

const args = process.argv.slice(2)
/** @param {string} flag */
const value = (flag) => {
  const index = args.indexOf(flag)
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined
}
const explain = args.includes('--explain')
const floor = value('--min-validation')

try {
  const { version } = await resolveGenerator({
    packageName: value('--package'),
    minSupported: value('--min-supported') ?? null,
    minValidation: floor === undefined || floor === '' || floor === 'null' ? null : Number(floor),
    log: explain ? (line) => console.error(line) : undefined,
  })
  console.log(version)
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(err instanceof NoUsableGeneratorError ? 1 : 2)
}
