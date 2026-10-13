export interface CompileIgOptions {
  /** Directory holding sushi-config.yaml. Default `fhir`. */
  igDir?: string
  /** Where the resources are staged before packing. Default `<igDir>/package`. */
  packageDir?: string
  /**
   * Write the FHIR package's package.json. Name, version and canonical come from sushi-config,
   * fhirVersions and dependencies from SUSHI's ImplementationGuide resource; fields here add to or
   * override those. When given, the staging dir is cleared first so a deleted profile cannot linger.
   */
  manifest?: Record<string, unknown>
  /**
   * Ship the FHIR package inside the generated npm package (`fhir-package/`), so another IG can
   * depend on this one through npm. Implies a manifest (`type: 'fhir.ig'` when none is given).
   */
  embedFhirPackage?: boolean
  /**
   * Run `babelfhir-ts seed-cache` before SUSHI, installing IGs embedded in node_modules into the FHIR
   * cache as `<id>#dev`. Default: when sushi-config declares a `dev` dependency.
   */
  seedCache?: boolean
  /** Keep the ImplementationGuide resource in the package. Default false. */
  includeImplementationGuide?: boolean
  /** SUSHI package spec for npx. Default `fsh-sushi@latest`. */
  sushi?: string
  /** The generator to run, e.g. `{ packageName: 'babelfhir-ts', version: '1.6.14' }`. */
  generator: { packageName: string; version: string }
  /** Extra `babelfhir-ts install` flags, e.g. `['--fhir-version', 'r4', '--no-client', '--skip-install']`. */
  generatorArgs?: string[]
  log?: (line: string) => void
}

export interface CompiledIg {
  id: string
  version: string
  /** Path of the packed FHIR package. */
  tarball: string
}

export interface IgIdentity {
  id: string
  version: string
  canonical?: string
}

/** The IG's id, version and canonical from sushi-config.yaml text. */
export declare function parseIgIdentity(sushiConfig: string): IgIdentity
export declare function igIdentity(igDir: string): IgIdentity
/** The FHIR package manifest: the caller's fields under the IG's own identity. */
export declare function packageManifest(identity: IgIdentity, extra: Record<string, unknown>): Record<string, unknown>
/** Whether sushi-config declares a first-party dependency seeded from npm (`<id>: dev`). */
export declare function hasDevDependency(sushiConfig: string): boolean
/** fhirVersions and dependencies (dependsOn) from SUSHI's ImplementationGuide resource. */
export declare function manifestFromImplementationGuide(implementationGuide: unknown): { fhirVersions?: string[]; dependencies?: Record<string, string> }
/** Generated files that go into the package. */
export declare function packagedResources(files: string[], id: string, includeImplementationGuide: boolean): string[]
/** Where babelfhir-ts caches an unpacked package. */
export declare function cachedIgPath(id: string, version: string, home?: string): string
/** Seed first-party dependencies, SUSHI, pack, evict this IG's stale cache entry, generate. */
export declare function compileIg(options: CompileIgOptions): CompiledIg
