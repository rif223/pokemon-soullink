export type ThemeMode = "dark" | "light";
export type PlayerId = "A" | "B";
export type TeamFilter = "all" | "alive" | "dead";
export type DeadBy = PlayerId | "both";

export type PokemonListResponse = {
  results: Array<{ name: string }>;
};

export type LinkedPair = {
  id: string;
  round: number;
  slot: number;
  a: { name: string; nickname?: string };
  b: { name: string; nickname?: string };
  status: "alive" | "dead";
  deadBy?: DeadBy;
  notes?: string;
};

export type AppState = {
  runNumber: number;
  currentRound: number;
  settings: {
    autoPokemonDeathsOnPairDeath: boolean;
  };
  players: {
    A: { label: string; pokemonDeaths: number; runFails: number };
    B: { label: string; pokemonDeaths: number; runFails: number };
  };
  pairs: LinkedPair[];
};

export type FirebaseSessionPayload = {
  state: AppState;
  updatedAt: number;
  clientId: string;
};
