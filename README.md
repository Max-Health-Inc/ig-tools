# @max-health-inc/ig-tools

Build tooling for the repos that compile a FHIR Implementation Guide into a typed TypeScript
package (fhir-igs, maxhealth.tech, trust, dicom-viewer). It replaces the copies each of them
carried.

## Resolve the generator release

The newest BabelFHIR-TS release that **passed stable parity**, is **published**, and is **not
deprecated**. Never simply the newest: one bad generator release breaks every IG built with it.
Parity validates IG conformance, not that generated code compiles, so a deprecation on npm (how
1.6.4 was withdrawn) vetoes too. Fails closed when nothing qualifies.

```sh
npx resolve-babelfhir --min-supported 1.5.18 --explain
```

```js
import { resolveGenerator } from '@max-health-inc/ig-tools'

const { version } = await resolveGenerator()
```

History source: the public parity report lists only releases minted on npmjs, so
`babelfhir-ts` reads it and `@babelfhir-ts/codegen` reads the private history on BabelFHIR-TS's
gh-pages branch through the GitHub API, with `PARITY_HISTORY_TOKEN` (else `GH_PACKAGES_TOKEN`,
`NODE_AUTH_TOKEN`, `GITHUB_TOKEN`). Without a token it fails closed rather than fall back to the
public report. `PARITY_HISTORY_URL` overrides both.

Options: `packageName` (default `@babelfhir-ts/codegen`, the org's generator on GitHub Packages: map
the `@babelfhir-ts` scope to `https://npm.pkg.github.com` with a token that can read it), `minSupported`, `minValidation` (a floor on the
lowest per-validator validation score, off by default), `historyUrl` (default `PARITY_HISTORY_URL`,
else BabelFHIR-TS's history-stable.json), and injectable `fetch` / `publishedVersions` /
`deprecationOf` for tests.

## Compile an IG

SUSHI, pack the generated resources as a FHIR package, **evict this IG's entry from
`~/.fhir/packages`** (babelfhir-ts reuses a cached id@version, so without it a recompile silently
reads the previous package and new artifacts never appear), then run the generator.

```js
import { compileIg, resolveGenerator } from '@max-health-inc/ig-tools'

const { version } = await resolveGenerator()
compileIg({
  generator: { packageName: '@babelfhir-ts/codegen', version },
  generatorArgs: ['--fhir-version', 'r4', '--no-client', '--skip-install'],
})
```

Options: `igDir` (default `fhir`), `packageDir` (default `<igDir>/package`),
`includeImplementationGuide` (default false), `sushi` (default `fsh-sushi@latest`), and
`manifest`: fields for the FHIR package's package.json. Name, version and canonical always come
from sushi-config; `fhirVersions` and `dependencies` from the ImplementationGuide resource SUSHI
writes, so they are never restated. With a manifest the staging dir is cleared first, so a deleted
profile cannot linger in the package.

## Depend on another first-party IG

FHIR tooling cannot read GitHub Packages, so an IG published only as `@max-health-inc/<x>-fhir`
cannot be a SUSHI dependency by version. Instead:

- The IG being depended on sets `embedFhirPackage: true`: its FHIR package ships inside the
  generated npm package (`fhir-package/`, babelfhir-ts `--embed-fhir-package`).
- The dependent IG adds that npm package as a devDependency and declares it in sushi-config as
  `<id>: dev`. `compileIg` sees the `dev` dependency and runs `babelfhir-ts seed-cache` before SUSHI,
  installing it into the FHIR cache as `<id>#dev`. The lockfile pins which build that is.

`seedCache` forces the seed step on or off.

## Decide the release version

Whether to publish a generated IG package, and as what. The npm version **follows the IG**: major.minor
are the IG's own and the patch is the package's revision, as `@types/*` does with its upstream. So
IG 0.2.0 publishes as 0.2.0, a generator-only rebuild as 0.2.1 (the IG version stays), and a raised
IG version lands as itself rather than counting on from the last package.

"Already published" is a `bk-<sha1>` dist-tag of the build key, because GitHub Packages drops custom
package.json fields, so a hash stored in the manifest never reads back. The tag format is the one
fhir-igs has always written. Each publish also gets `ig-<IG version>` and `babelfhir-<generator>`
dist-tags, and takes `latest` only when it is newer than the current `latest`.

```sh
npx --yes --package @max-health-inc/ig-tools@^0.6.0 release-plan   --package @max-health-inc/core-fhir --ig-version 0.2.0   --build-key "fsh:<hash>|babelfhir@1.6.21|r4" --generator 1.6.21 >> "$GITHUB_OUTPUT"
# publish=true  version=0.2.0  latest=true  tags=bk-… ig-0.2.0 babelfhir-1.6.21
```

The build key is everything the output depends on (IG source, generator version, flags); the same
key never publishes twice. With two bins in this package, call each one through `--package`.

## Releasing

Bump `version` in package.json; a merge to `main` publishes it to GitHub Packages and tags it.
