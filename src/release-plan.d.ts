export interface RegistryState {
  versions: string[]
  distTags: Record<string, string>
}

export interface ReleasePlanOptions {
  /** The IG's version from sushi-config.yaml, x.y.z. */
  igVersion: string
  /** Everything the build depends on, e.g. `fsh:<hash>|babelfhir@1.6.21|r4`. Same key, same package. */
  buildKey: string
  /** The generator release used, recorded as a `babelfhir-<version>` dist-tag. */
  generatorVersion?: string
  registry: RegistryState
}

export interface ReleasePlan {
  publish: boolean
  /** The version to publish, or the one already published for this build key. */
  version: string
  /** Whether the new version should take the `latest` dist-tag (false for an older line). */
  latest: boolean
  /** Dist-tags to add after publishing: the build key, `ig-<version>`, `babelfhir-<version>`. */
  tags: string[]
  keyTag: string
}

/** The `bk-<hash>` dist-tag that marks a build key as published. */
export declare function buildKeyTag(buildKey: string): string
/** The IG version, or the next patch after this IG line's newest published build. */
export declare function nextVersion(igVersion: string, published: readonly string[]): string
export declare function planRelease(options: ReleasePlanOptions): ReleasePlan
/** Versions and dist-tags from `npm view`; empty for a package never published. */
export declare function readRegistry(packageName: string): RegistryState
/** Parse `npm view <pkg> versions dist-tags --json`, which npm may wrap in an array. */
export declare function parseRegistryView(json: string): RegistryState
