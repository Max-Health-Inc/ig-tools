import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { cachedIgPath, packagedResources, parseIgIdentity } from './compile-ig.js'

describe('compile-ig helpers', () => {
  it('reads the IG id and version from sushi-config, so no script restates them', () => {
    assert.deepEqual(parseIgIdentity('id: max-health.core\ncanonical: https://x\nversion: 0.4.2\n'), { id: 'max-health.core', version: '0.4.2' })
    assert.throws(() => parseIgIdentity('canonical: https://x\n'), /no id and version/)
  })

  it('packs JSON resources and leaves out the ImplementationGuide unless asked', () => {
    const files = ['StructureDefinition-a.json', 'ImplementationGuide-ig.json', 'notes.md']
    assert.deepEqual(packagedResources(files, 'ig', false), ['StructureDefinition-a.json'])
    assert.deepEqual(packagedResources(files, 'ig', true), ['StructureDefinition-a.json', 'ImplementationGuide-ig.json'])
  })

  it('evicts exactly this IG from the package cache, never the whole cache', () => {
    assert.equal(cachedIgPath('ig', '1.0.0', '/home/u'), join('/home/u', '.fhir', 'packages', 'ig@1.0.0'))
  })
})
