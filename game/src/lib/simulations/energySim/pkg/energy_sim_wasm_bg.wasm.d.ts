/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_session_free: (a: number, b: number) => void;
export const evaluateHydro: (a: number, b: number, c: number, d: number) => [number, number, number];
export const runSession: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
export const sessionSnapshot: (a: number, b: number, c: number) => [number, number, number];
export const session_advance: (a: number, b: number, c: number, d: number) => [number, number, number];
export const session_applyCommands: (a: number, b: number, c: number) => [number, number, number];
export const session_checkpoint: (a: number) => [number, number, number];
export const session_checkpointJson: (a: number) => [number, number, number, number];
export const session_fromCheckpoint: (a: number, b: number) => [number, number, number];
export const session_history: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
export const session_new: (a: number, b: number) => [number, number, number];
export const session_phase: (a: number) => [number, number];
export const session_simTimeS: (a: number) => number;
export const session_snapshot: (a: number) => [number, number, number];
export const session_start: (a: number) => [number, number, number];
export const session_stop: (a: number) => [number, number, number];
export const session_tick: (a: number, b: number) => [number, number, number];
export const version: () => [number, number];
export const start: () => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
