import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, disqualification, NoUsableGeneratorError, resolveGenerator } from './resolve-generator.js'

const healthy = (version) => ({ version, packageCount: 30, internal: { validation: 72 }, firely: { validation: 84 }, hl7: { validation: 82 } })

/** A resolver wired to doubles instead of the network and npm. */
function resolve(entries, { published = entries.map((e) => e.version), deprecated = {}, ...options } = {}) {
  const calls = { deprecation: [] }
  const result = resolveGenerator({
    historyUrl: 'https://parity.test/history-stable.json',
    fetch: async () => new Response(JSON.stringify({ entries })),
    publishedVersions: () => new Set(published),
    deprecationOf: (_pkg, version) => {
      calls.deprecation.push(version)
      return deprecated[version] ?? null
    },
    ...options,
  })
  return { result, calls }
}

describe('resolveGenerator', () => {
  it('takes the newest release that passed parity, not the newest number in the file', async () => {
    const { result } = resolve([healthy('1.6.12'), healthy('1.6.14'), healthy('1.6.13')])
    assert.equal((await result).version, '1.6.14')
  })

  it('vetoes a deprecated release, as 1.6.4 had to be, and asks npm only as far as it must', async () => {
    const { result, calls } = resolve([healthy('1.6.3'), healthy('1.6.4'), healthy('1.6.2')], { deprecated: { '1.6.4': 'fails with TS2688' } })
    assert.equal((await result).version, '1.6.3')
    assert.deepEqual(calls.deprecation, ['1.6.4', '1.6.3'])
  })

  it('skips a parity result for a version that was never published', async () => {
    const { result } = resolve([healthy('1.7.0'), healthy('1.6.14')], { published: ['1.6.14'] })
    assert.equal((await result).version, '1.6.14')
  })

  it('applies the minimum supported release and the optional score floor', async () => {
    const low = { ...healthy('1.6.15'), internal: { validation: 40 } }
    const { result } = resolve([healthy('1.5.10'), healthy('1.6.14'), low], { minSupported: '1.5.18', minValidation: 60 })
    const resolved = await result
    assert.equal(resolved.version, '1.6.14')
    assert.deepEqual(resolved.skipped.map((s) => s.version).sort(), ['1.5.10', '1.6.15'])
  })

  it('fails closed instead of falling back to the newest release', async () => {
    const { result } = resolve([{ version: '1.6.14' }])
    await assert.rejects(result, NoUsableGeneratorError)
  })

  it('fails closed when every candidate is deprecated', async () => {
    const { result } = resolve([healthy('1.6.4')], { deprecated: { '1.6.4': 'broken' } })
    await assert.rejects(result, /deprecated: 1\.6\.4/)
  })
})

describe('disqualification and compareVersions', () => {
  it('names why an entry cannot be used', () => {
    assert.equal(disqualification({ version: 'latest' }), 'no usable version recorded')
    assert.equal(disqualification({ version: '1.6.14' }), 'parity ran but recorded no validation scores')
    assert.equal(disqualification(healthy('1.6.14')), null)
  })

  it('compares numerically, not as text', () => {
    assert.ok(compareVersions('1.6.10', '1.6.9') > 0)
    assert.equal(compareVersions('1.6.0', '1.6'), 0)
  })
})
