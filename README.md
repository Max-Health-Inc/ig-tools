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
`manifest`: fields for the FHIR package's package.json (`fhirVersions`, `type`, `dependencies`).
Name, version and canonical always come from sushi-config. With a manifest the staging dir is
cleared first, so a deleted profile cannot linger in the package.

## Releasing

Bump `version` in package.json; a merge to `main` publishes it to GitHub Packages and tags it.
