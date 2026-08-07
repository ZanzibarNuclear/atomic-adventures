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
