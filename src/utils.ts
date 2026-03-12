import type { AppState } from "./types";

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function randomSessionId(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let out = "";
  for (let i = 0; i < array.length; i++) {
    out += chars[array[i] % chars.length];
  }
  return out;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function normalizePokemonName(name: string) {
  const t = name.trim().replace(/\s+/g, " ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

export function titleCaseSlug(name: string) {
  return name
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join("-");
}

export function toPokeApiSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[.'’:]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m");
}

export function getDefaultState(): AppState {
  return {
    runNumber: 1,
    currentRound: 1,
    settings: {
      autoPokemonDeathsOnPairDeath: true
    },
    players: {
      A: { label: "Player A", pokemonDeaths: 0, runFails: 0 },
      B: { label: "Player B", pokemonDeaths: 0, runFails: 0 }
    },
    pairs: []
  };
}

export function sanitizeState(input: Partial<AppState> | null | undefined): AppState {
  const base = getDefaultState();

  if (!input) return base;

  return {
    runNumber: input.runNumber ?? base.runNumber,
    currentRound: input.currentRound ?? base.currentRound,
    settings: {
      autoPokemonDeathsOnPairDeath:
        input.settings?.autoPokemonDeathsOnPairDeath ??
        base.settings.autoPokemonDeathsOnPairDeath
    },
    players: {
      A: {
        label: input.players?.A?.label ?? base.players.A.label,
        pokemonDeaths: input.players?.A?.pokemonDeaths ?? base.players.A.pokemonDeaths,
        runFails: input.players?.A?.runFails ?? base.players.A.runFails
      },
      B: {
        label: input.players?.B?.label ?? base.players.B.label,
        pokemonDeaths: input.players?.B?.pokemonDeaths ?? base.players.B.pokemonDeaths,
        runFails: input.players?.B?.runFails ?? base.players.B.runFails
      }
    },
    pairs: (input.pairs ?? []).map((p) => ({
      id: p.id ?? uid(),
      round: p.round ?? 1,
      slot: p.slot ?? 1,
      a: {
        name: p.a?.name ?? "",
        nickname: p.a?.nickname
      },
      b: {
        name: p.b?.name ?? "",
        nickname: p.b?.nickname
      },
      status: p.status === "dead" ? "dead" : "alive",
      deadBy: p.deadBy,
      notes: p.notes
    }))
  };
}

export function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = removeUndefinedDeep(val);
      }
    }

    return result as T;
  }

  return value;
}

export function getSessionFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("session") ?? "";
}

export function setSessionInUrl(sessionId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url.toString());
}
