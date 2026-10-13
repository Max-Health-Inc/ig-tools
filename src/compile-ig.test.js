import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { cachedIgPath, hasDevDependency, manifestFromImplementationGuide, packageManifest, packagedResources, parseIgIdentity } from './compile-ig.js'

const yaml = (...lines) => `${lines.join('\n')}\n`

describe('compile-ig helpers', () => {
  it('reads the IG identity from sushi-config, so no script restates it', () => {
    assert.deepEqual(parseIgIdentity('id: max-health.core\ncanonical: https://x\nversion: 0.4.2\n'), { id: 'max-health.core', version: '0.4.2', canonical: 'https://x' })
    assert.deepEqual(parseIgIdentity('id: a\nversion: 1.0.0\n'), { id: 'a', version: '1.0.0' })
    assert.throws(() => parseIgIdentity('canonical: https://x\n'), /no id and version/)
  })

  it('packs JSON resources and leaves out the ImplementationGuide unless asked', () => {
    const files = ['StructureDefinition-a.json', 'ImplementationGuide-ig.json', 'notes.md']
    assert.deepEqual(packagedResources(files, 'ig', false), ['StructureDefinition-a.json'])
    assert.deepEqual(packagedResources(files, 'ig', true), ['StructureDefinition-a.json', 'ImplementationGuide-ig.json'])
  })

  it('writes the package manifest under the IG identity, which the caller cannot override', () => {
    const manifest = packageManifest({ id: 'ig', version: '1.0.0', canonical: 'https://x' }, { name: 'other', fhirVersions: ['4.0.1'], dependencies: { 'hl7.fhir.uv.ips': '2.0.0-ballot' } })
    assert.deepEqual(manifest, { name: 'ig', version: '1.0.0', canonical: 'https://x', fhirVersions: ['4.0.1'], dependencies: { 'hl7.fhir.uv.ips': '2.0.0-ballot' } })
  })

  it('evicts exactly this IG from the package cache, never the whole cache', () => {
    assert.equal(cachedIgPath('ig', '1.0.0', '/home/u'), join('/home/u', '.fhir', 'packages', 'ig@1.0.0'))
  })

  it('seeds the cache only for an IG that depends on a first-party IG through npm', () => {
    assert.equal(hasDevDependency(yaml('id: t', 'dependencies:', '  maxhealth.core: dev', 'parameters:', '  x: y')), true)
    assert.equal(hasDevDependency(yaml('id: t', 'dependencies:', '  maxhealth.core: dev').replaceAll('\n', '\r\n')), true)
    assert.equal(hasDevDependency(yaml('dependencies:', '  maxhealth.core:', '    version: dev')), true)
    assert.equal(hasDevDependency(yaml('dependencies:', '  hl7.fhir.uv.ips: 2.0.0-ballot')), false)
    assert.equal(hasDevDependency(yaml('id: t', 'version: dev')), false)
  })

  it('takes fhirVersions and dependencies from what SUSHI wrote, not from a second copy', () => {
    const ig = { resourceType: 'ImplementationGuide', fhirVersion: ['4.0.1'], dependsOn: [{ packageId: 'maxhealth.core', version: 'dev', uri: 'https://maxhealth.tech/fhir/core' }] }
    assert.deepEqual(manifestFromImplementationGuide(ig), { fhirVersions: ['4.0.1'], dependencies: { 'maxhealth.core': 'dev' } })
    assert.deepEqual(manifestFromImplementationGuide({ fhirVersion: ['4.0.1'] }), { fhirVersions: ['4.0.1'] })
    assert.deepEqual(manifestFromImplementationGuide(null), {})
  })
})
