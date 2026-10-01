export interface CompileIgOptions {
  /** Directory holding sushi-config.yaml. Default `fhir`. */
  igDir?: string
  /** Where the resources are staged before packing. Default `<igDir>/package`. */
  packageDir?: string
  /**
   * Write the FHIR package's package.json (name, version and canonical come from sushi-config; add
   * fhirVersions, type, dependencies here). When given, the staging dir is owned by this step and
   * cleared first, so a deleted profile cannot linger in the package.
   */
  manifest?: Record<string, unknown>
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
/** Generated files that go into the package. */
export declare function packagedResources(files: string[], id: string, includeImplementationGuide: boolean): string[]
/** Where babelfhir-ts caches an unpacked package. */
export declare function cachedIgPath(id: string, version: string, home?: string): string
/** SUSHI, pack, evict this IG's stale cache entry, generate. */
export declare function compileIg(options: CompileIgOptions): CompiledIg
