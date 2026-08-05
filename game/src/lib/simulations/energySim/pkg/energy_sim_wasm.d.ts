/* tslint:disable */
/* eslint-disable */

/**
 * Long-lived simulation session for browser hosts (game control room, holo trials).
 *
 * Create from plant or station JSON, then call `start`, `advance` / `tick`,
 * `applyCommands`, and `snapshot` repeatedly. Dropping the handle frees WASM
 * memory (or call `.free()` from JS).
 *
 * Mirrors the HTTP session contract in `energy-sim-server` so hosts can swap
 * transports via a thin adapter.
 */
export class Session {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Advance simulation time by `duration_secs`.
     *
     * Optional `commands_json` is a JSON array of `Command` objects applied
     * before the advance (same shape as HTTP `POST .../advance`).
     */
    advance(duration_secs: number, commands_json?: string | null): any;
    /**
     * Apply a JSON array of commands; returns snapshot.
     */
    applyCommands(commands_json: string): any;
    /**
     * Full checkpoint document as a JS object (for save / transfer).
     */
    checkpoint(): any;
    /**
     * Checkpoint as a JSON string (handy for localStorage).
     */
    checkpointJson(): string;
    /**
     * Restore a session from a checkpoint document JSON string.
     */
    static fromCheckpoint(checkpoint_json: string): Session;
    /**
     * Events + samples, optionally filtered by sim-time range.
     *
     * Returns `{ events, samples }` with camelCase fields.
     */
    history(from_secs?: number | null, to_secs?: number | null): any;
    /**
     * Create a session from plant or full station JSON (not yet started).
     */
    constructor(config_json: string);
    /**
     * Current phase string: `configured` | `running` | `stopped`.
     */
    phase(): string;
    /**
     * Current simulation time in seconds.
     */
    simTimeS(): number;
    /**
     * Point-in-time snapshot (any phase).
     */
    snapshot(): any;
    /**
     * Start the session; returns the current snapshot.
     */
    start(): any;
    /**
     * Stop the session (gate closed, offline ramp targets); returns snapshot.
     */
    stop(): any;
    /**
     * Single live tick of `dt_secs`; returns snapshot.
     */
    tick(dt_secs: number): any;
}

/**
 * Evaluate a hydro plant JSON string with optional operator overrides.
 *
 * `operator_json` may be `null`/omitted for defaults (gate open, online).
 * Returns a JS object matching `HydroEvaluation` camelCase fields.
 */
export function evaluateHydro(plant_json: string, operator_json?: string | null): any;

/**
 * Create a session from plant or station JSON, start it, advance, return report.
 *
 * Prefer [`WasmSession`] for multi-step control-room or holo trials.
 */
export function runSession(config_json: string, duration_secs: number, commands_json?: string | null): any;

/**
 * One-shot session status helper: configure + optional start without advance.
 */
export function sessionSnapshot(config_json: string, start: boolean): any;

/**
 * Install better panic messages in the browser console.
 */
export function start(): void;

/**
 * Library version string.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_session_free: (a: number, b: number) => void;
    readonly evaluateHydro: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly runSession: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly sessionSnapshot: (a: number, b: number, c: number) => [number, number, number];
    readonly session_advance: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly session_applyCommands: (a: number, b: number, c: number) => [number, number, number];
    readonly session_checkpoint: (a: number) => [number, number, number];
    readonly session_checkpointJson: (a: number) => [number, number, number, number];
    readonly session_fromCheckpoint: (a: number, b: number) => [number, number, number];
    readonly session_history: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly session_new: (a: number, b: number) => [number, number, number];
    readonly session_phase: (a: number) => [number, number];
    readonly session_simTimeS: (a: number) => number;
    readonly session_snapshot: (a: number) => [number, number, number];
    readonly session_start: (a: number) => [number, number, number];
    readonly session_stop: (a: number) => [number, number, number];
    readonly session_tick: (a: number, b: number) => [number, number, number];
    readonly version: () => [number, number];
    readonly start: () => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
