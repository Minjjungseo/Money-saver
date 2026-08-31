import { LocalStorageDataRepository } from "./localStorageRepository";
import type { DataRepository } from "./types";

/**
 * Single instantiation point for the active data repository.
 * Swap this line to point at a Supabase-backed implementation later.
 */
export const repository: DataRepository = new LocalStorageDataRepository();

export type { DataRepository } from "./types";
export { DEFAULT_SETTINGS, DEFAULT_MONEY_PLAN_BUCKET_CONFIG } from "./localStorageRepository";
