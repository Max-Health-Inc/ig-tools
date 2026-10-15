import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildKeyTag, nextVersion, parseRegistryView, planRelease } from './release-plan.js'

const registry = (versions = [], distTags = {}) => ({ versions, distTags })

describe('nextVersion', () => {
  it('publishes an IG version as itself the first time', () => {
    assert.equal(nextVersion('0.2.0', []), '0.2.0')
  })

  it('gives a generator-only rebuild the next patch, leaving the IG version alone', () => {
    assert.equal(nextVersion('0.2.0', ['0.2.0']), '0.2.1')
    assert.equal(nextVersion('0.2.0', ['0.2.0', '0.2.1']), '0.2.2')
  })

  it('jumps to a raised IG version instead of counting on from the last package', () => {
    assert.equal(nextVersion('0.5.1', ['0.4.4', '0.4.5']), '0.5.1')
    assert.equal(nextVersion('0.2.0', ['0.1.11', '0.1.12']), '0.2.0')
  })

  it('takes the next free patch when rebuilds already passed the IG patch', () => {
    assert.equal(nextVersion('0.2.1', ['0.2.0', '0.2.1', '0.2.2']), '0.2.3')
  })

  it('compares patches as numbers', () => {
    assert.equal(nextVersion('0.1.0', ['0.1.9', '0.1.10']), '0.1.11')
  })

  it('refuses an IG version that is not x.y.z', () => {
    assert.throws(() => nextVersion('0.2', []))
  })
})

describe('planRelease', () => {
  it('skips a build key that is already published', () => {
    const key = 'fsh:abc|babelfhir@1.6.21|r4'
    const plan = planRelease({ igVersion: '0.2.0', buildKey: key, registry: registry(['0.2.0'], { [buildKeyTag(key)]: '0.2.0' }) })
    assert.deepEqual(plan, { publish: false, version: '0.2.0', latest: false, tags: [], keyTag: buildKeyTag(key) })
  })

  it('tags a new build with its key, IG version and generator', () => {
    const plan = planRelease({ igVersion: '0.2.0', buildKey: 'k', generatorVersion: '1.6.21', registry: registry(['0.2.0'], { latest: '0.2.0' }) })
    assert.equal(plan.publish, true)
    assert.equal(plan.version, '0.2.1')
    assert.equal(plan.latest, true)
    assert.deepEqual(plan.tags, [buildKeyTag('k'), 'ig-0.2.0', 'babelfhir-1.6.21'])
  })

  it('does not hand latest to a rebuild of an older IG line', () => {
    const plan = planRelease({ igVersion: '0.1.0', buildKey: 'k', registry: registry(['0.1.0', '0.2.0'], { latest: '0.2.0' }) })
    assert.equal(plan.version, '0.1.1')
    assert.equal(plan.latest, false)
  })
})

describe('buildKeyTag', () => {
  it('matches the tag fhir-igs has always written (sha1, first 16 hex)', () => {
    assert.equal(buildKeyTag('abc'), 'bk-a9993e364706816a')
  })
})

describe('parseRegistryView', () => {
  it('reads the array npm wraps a multi-field answer in', () => {
    const json = JSON.stringify([{ versions: ['0.4.4', '0.4.5'], 'dist-tags': { latest: '0.4.5' } }])
    assert.deepEqual(parseRegistryView(json), { versions: ['0.4.4', '0.4.5'], distTags: { latest: '0.4.5' } })
  })

  it('reads a bare object and a single version given as a string', () => {
    const json = JSON.stringify({ versions: '0.1.0', 'dist-tags': { latest: '0.1.0' } })
    assert.deepEqual(parseRegistryView(json), { versions: ['0.1.0'], distTags: { latest: '0.1.0' } })
  })
})
