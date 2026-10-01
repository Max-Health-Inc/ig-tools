/** One validator's averages, as BabelFHIR-TS's scripts/update-history.js writes them. */
export interface ValidatorScores {
  empty?: number
  random?: number
  validation?: number
  emptyTotal?: number
  randomTotal?: number
  validationTotal?: number
  excluded?: number
}

/** One release's record in history-stable.json (written by BabelFHIR-TS scripts/update-history.js). */
export interface ParityEntry {
  date?: string
  version?: unknown
  packageCount?: number
  firelyVersion?: string
  hl7Version?: string
  internal?: ValidatorScores
  firely?: ValidatorScores
  hl7?: ValidatorScores
  [key: string]: unknown
}

export interface ResolveGeneratorOptions {
  /** npm package to resolve, e.g. `babelfhir-ts` (npmjs) or `@babelfhir-ts/codegen` (GitHub Packages). Default `babelfhir-ts`. */
  packageName?: string
  /** Default: `PARITY_HISTORY_URL`, else {@link DEFAULT_HISTORY_URL}. */
  historyUrl?: string
  /** Oldest release the caller can build with at all. */
  minSupported?: string | null
  /** Optional floor (percent) on the lowest per-validator `validation` score. */
  minValidation?: number | null
  fetch?: typeof globalThis.fetch
  /** Default: `npm view <package> versions --json`. */
  publishedVersions?: (packageName: string) => Set<string> | Promise<Set<string>>
  /** Default: `npm view <package>@<version> deprecated`. */
  deprecationOf?: (packageName: string, version: string) => string | null | Promise<string | null>
  /** Receives the reasoning, one line per decision. */
  log?: (line: string) => void
}

export interface ResolvedGenerator {
  version: string
  entry: ParityEntry & { version: string }
  /** Every release passed over, and why. */
  skipped: Array<{ version: string; reason: string }>
}

export declare const DEFAULT_HISTORY_URL: string
export declare function isExactVersion(version: string): boolean
/** Compare dotted numeric versions; positive when `a` is newer. */
export declare function compareVersions(a: string, b: string): number
export declare function lowestValidation(entry: ParityEntry): number | null
/** Why an entry cannot be used, or null when its parity record qualifies. */
export declare function disqualification(entry: ParityEntry, rules?: { minSupported?: string | null; minValidation?: number | null }): string | null
/** Thrown when nothing qualifies; the build must stop rather than guess. */
export declare class NoUsableGeneratorError extends Error {}
/** The newest release that passed stable parity, is published, and is not deprecated. */
export declare function resolveGenerator(options?: ResolveGeneratorOptions): Promise<ResolvedGenerator>
