import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { cachedIgPath, packageManifest, packagedResources, parseIgIdentity } from './compile-ig.js'

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
})
