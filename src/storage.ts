import type { AppState, ThemeMode } from "./types";
import type { FirebaseRuntimeConfig } from "./firebaseRuntime";
import { getDefaultState, sanitizeState } from "./utils";

export const STORAGE_KEY = "pokemon_soullink_runtime_firebase_v9";
export const FIREBASE_CONFIG_STORAGE_KEY = "pokemon_soullink_runtime_firebase_config_v9";
export const POKEMON_NAMES_CACHE_KEY = "pokemon_soullink_pokemon_names_cache_v1";
export const THEME_STORAGE_KEY = "pokemon_soullink_theme_v1";

export function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no state");
    return sanitizeState(JSON.parse(raw));
  } catch {
    return getDefaultState();
  }
}

export function saveLocalState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function saveFirebaseConfig(config: FirebaseRuntimeConfig) {
  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function loadFirebaseConfig(): FirebaseRuntimeConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FirebaseRuntimeConfig;
  } catch {
    return null;
  }
}

export function clearFirebaseConfig() {
  localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
}

export function loadPokemonNamesCache(): string[] {
  try {
    const raw = localStorage.getItem(POKEMON_NAMES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePokemonNamesCache(names: string[]) {
  localStorage.setItem(POKEMON_NAMES_CACHE_KEY, JSON.stringify(names));
}

export function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
