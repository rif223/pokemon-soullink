import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { initFirebaseRuntime, type FirebaseRuntimeConfig } from "./firebaseRuntime";
import type {
  AppState,
  DeadBy,
  FirebaseSessionPayload,
  LinkedPair,
  PlayerId,
  PokemonListResponse,
  TeamFilter,
  ThemeMode
} from "./types";
import {
  clamp,
  getDefaultState,
  getSessionFromUrl,
  normalizePokemonName,
  randomSessionId,
  removeUndefinedDeep,
  sanitizeState,
  setSessionInUrl,
  titleCaseSlug,
  uid
} from "./utils";
import {
  clearFirebaseConfig,
  loadFirebaseConfig,
  loadLocalState,
  loadPokemonNamesCache,
  loadTheme,
  saveFirebaseConfig,
  saveLocalState,
  savePokemonNamesCache,
  saveTheme
} from "./storage";
import Badge from "./components/Badge";
import FirebaseSetup from "./components/FirebaseSetup";
import PokemonAutocompleteInput from "./components/PokemonAutocompleteInput";
import PairCard from "./components/PairCard";

export default function SoulLinkUI() {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseRuntimeConfig | null>(() => loadFirebaseConfig());
  const [firebaseReady, setFirebaseReady] = useState(false);

  const [state, setState] = useState<AppState>(() => loadLocalState());
  const [pokemonNames, setPokemonNames] = useState<string[]>(() => loadPokemonNamesCache());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [search, setSearch] = useState("");

  const [round, setRound] = useState("1");
  const [slot, setSlot] = useState("1");
  const [aName, setAName] = useState("");
  const [aNick, setANick] = useState("");
  const [bName, setBName] = useState("");
  const [bNick, setBNick] = useState("");
  const [notes, setNotes] = useState("");

  const [deathModalPairId, setDeathModalPairId] = useState<string | null>(null);

  const [sessionIdInput, setSessionIdInput] = useState(() => getSessionFromUrl());
  const [activeSessionId, setActiveSessionId] = useState(() => getSessionFromUrl());
  const [syncStatus, setSyncStatus] = useState<"local" | "connecting" | "live">(
    getSessionFromUrl() ? "connecting" : "local"
  );

  const clientId = useMemo(() => uid(), []);
  const lastLocalWriteRef = useRef<number>(0);
  const lastAppliedRemoteRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!firebaseConfig) {
      setFirebaseReady(false);
      return;
    }

    try {
      initFirebaseRuntime(firebaseConfig);
      setFirebaseReady(true);
    } catch (err) {
      console.error(err);
      setFirebaseReady(false);
      window.alert("Firebase init failed. Check your config JSON.");
    }
  }, [firebaseConfig]);

  useEffect(() => {
    saveLocalState(state);
  }, [state]);

  useEffect(() => {
    if (!editingId) {
      setRound(String(state.currentRound));
    }
  }, [state.currentRound, editingId]);

  useEffect(() => {
    if (pokemonNames.length > 0) return;

    let cancelled = false;

    async function loadPokemonNames() {
      try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=2000");
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as PokemonListResponse;

        const names = data.results
          .map((p) => titleCaseSlug(p.name))
          .sort((a, b) => a.localeCompare(b));

        if (!cancelled) {
          setPokemonNames(names);
          savePokemonNamesCache(names);
        }
      } catch {
        if (!cancelled) {
          const cached = loadPokemonNamesCache();
          if (cached.length > 0) setPokemonNames(cached);
        }
      }
    }

    loadPokemonNames();

    return () => {
      cancelled = true;
    };
  }, [pokemonNames.length]);

  useEffect(() => {
    if (!firebaseReady || !firebaseConfig || !activeSessionId) return;

    setSyncStatus("connecting");
    const runtime = initFirebaseRuntime(firebaseConfig);
    const sessionRef = ref(runtime.db, "sessions/" + activeSessionId);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const payload = snapshot.val() as FirebaseSessionPayload | null;

      if (!payload || !payload.state) {
        setSyncStatus("connecting");
        return;
      }

      const remoteTs = Number(payload.updatedAt || 0);

      if (payload.clientId === clientId && remoteTs === lastLocalWriteRef.current) {
        setSyncStatus("live");
        return;
      }

      if (remoteTs > 0 && remoteTs <= lastAppliedRemoteRef.current) {
        setSyncStatus("live");
        return;
      }

      lastAppliedRemoteRef.current = remoteTs;
      const nextState = sanitizeState(payload.state);

      setState(nextState);
      saveLocalState(nextState);
      setSyncStatus("live");
    });

    return () => {
      unsubscribe();
      setSyncStatus("local");
    };
  }, [firebaseReady, firebaseConfig, activeSessionId, clientId]);

  function pushState(nextState: AppState) {
    setState(nextState);
    saveLocalState(nextState);

    if (firebaseReady && firebaseConfig && activeSessionId) {
      const runtime = initFirebaseRuntime(firebaseConfig);
      const sessionRef = ref(runtime.db, "sessions/" + activeSessionId);
      const timestamp = Date.now();

      lastLocalWriteRef.current = timestamp;

      const payload: FirebaseSessionPayload = {
        state: nextState,
        updatedAt: timestamp,
        clientId
      };

      void set(sessionRef, removeUndefinedDeep(payload));
    }
  }

  const aliveCount = useMemo(() => {
    return state.pairs.filter((p) => p.status === "alive").length;
  }, [state.pairs]);

  const deadCount = useMemo(() => {
    return state.pairs.filter((p) => p.status === "dead").length;
  }, [state.pairs]);

  const filteredPairs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...state.pairs]
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.slot - b.slot;
      })
      .filter((p) => {
        if (teamFilter === "alive" && p.status !== "alive") return false;
        if (teamFilter === "dead" && p.status !== "dead") return false;

        if (!q) return true;

        const hay = [
          String(p.round),
          String(p.slot),
          p.a.name,
          p.a.nickname ?? "",
          p.b.name,
          p.b.nickname ?? "",
          p.notes ?? ""
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
  }, [state.pairs, teamFilter, search]);

  const groupedPairs = useMemo(() => {
    const map = new Map<number, LinkedPair[]>();

    for (const pair of filteredPairs) {
      if (!map.has(pair.round)) {
        map.set(pair.round, []);
      }
      map.get(pair.round)?.push(pair);
    }

    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filteredPairs]);

  function createSession() {
    if (!firebaseReady || !firebaseConfig) {
      window.alert("Firebase is not ready.");
      return;
    }

    const id = randomSessionId();
    const runtime = initFirebaseRuntime(firebaseConfig);
    const sessionRef = ref(runtime.db, "sessions/" + id);

    const initialState = loadLocalState();
    const timestamp = Date.now();

    lastLocalWriteRef.current = timestamp;

    const payload: FirebaseSessionPayload = {
      state: initialState,
      updatedAt: timestamp,
      clientId
    };

    void set(sessionRef, removeUndefinedDeep(payload));

    setSessionInUrl(id);
    setSessionIdInput(id);
    setActiveSessionId(id);
    setSyncStatus("connecting");
  }

  function joinSession() {
    const trimmed = sessionIdInput.trim();
    if (!trimmed) return;

    setSessionInUrl(trimmed);
    setActiveSessionId(trimmed);
    setSyncStatus("connecting");
  }

  async function copyInviteLink() {
    const id = activeSessionId || sessionIdInput.trim();
    if (!id) return;
    const url = new URL(window.location.href);
    url.searchParams.set("session", id);
    await navigator.clipboard.writeText(url.toString());
    window.alert("Invite link copied.");
  }

  async function copyFirebaseConfig() {
    if (!firebaseConfig) return;
    await navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2));
    window.alert("Firebase config copied.");
  }

  function resetFirebaseConfig() {
    const ok = window.confirm("Clear saved Firebase config in this browser?");
    if (!ok) return;
    clearFirebaseConfig();
    setFirebaseConfig(null);
    setFirebaseReady(false);
    setSyncStatus("local");
  }

  function bumpPokemonDeaths(player: PlayerId, delta: number) {
    pushState({
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...state.players[player],
          pokemonDeaths: clamp(state.players[player].pokemonDeaths + delta, 0, 9999)
        }
      }
    });
  }

  function bumpRunFails(player: PlayerId, delta: number) {
    pushState({
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...state.players[player],
          runFails: clamp(state.players[player].runFails + delta, 0, 9999)
        }
      }
    });
  }

  function setPlayerLabel(player: PlayerId, label: string) {
    pushState({
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...state.players[player],
          label
        }
      }
    });
  }

  function setRunNumber(nextRun: number) {
    pushState({
      ...state,
      runNumber: clamp(nextRun, 1, 9999)
    });
  }

  function clearForm() {
    setEditingId(null);
    setRound(String(state.currentRound));
    setSlot("1");
    setAName("");
    setANick("");
    setBName("");
    setBNick("");
    setNotes("");
  }

  function resetAll() {
    const ok = window.confirm("Reset everything? This clears run, rounds, counters and all pairs.");
    if (!ok) return;

    pushState({
      ...getDefaultState(),
      players: {
        A: {
          ...getDefaultState().players.A,
          label: state.players.A.label || "Player A"
        },
        B: {
          ...getDefaultState().players.B,
          label: state.players.B.label || "Player B"
        }
      }
    });

    clearForm();
  }

  function startEdit(id: string) {
    const pair = state.pairs.find((p) => p.id === id);
    if (!pair) return;

    setEditingId(id);
    setRound(String(pair.round));
    setSlot(String(pair.slot));
    setAName(pair.a.name);
    setANick(pair.a.nickname ?? "");
    setBName(pair.b.name);
    setBNick(pair.b.nickname ?? "");
    setNotes(pair.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitPair() {
    const roundNum = clamp(
      parseInt(round || String(state.currentRound), 10) || state.currentRound,
      1,
      9999
    );
    const slotNum = clamp(parseInt(slot || "1", 10) || 1, 1, 9999);
    const nextA = normalizePokemonName(aName);
    const nextB = normalizePokemonName(bName);

    if (!nextA || !nextB) {
      window.alert("Please enter both Pokemon names.");
      return;
    }

    const existingPair = editingId
      ? state.pairs.find((p) => p.id === editingId)
      : undefined;

    const nextPair: LinkedPair = {
      id: editingId ?? uid(),
      round: roundNum,
      slot: slotNum,
      a: {
        name: nextA,
        nickname: aNick.trim() || undefined
      },
      b: {
        name: nextB,
        nickname: bNick.trim() || undefined
      },
      status: existingPair?.status ?? "alive",
      deadBy: existingPair?.deadBy,
      notes: notes.trim() || undefined
    };

    const nextPairs = editingId
      ? state.pairs.map((p) => (p.id === editingId ? nextPair : p))
      : [...state.pairs, nextPair];

    pushState({
      ...state,
      pairs: nextPairs
    });

    clearForm();
  }

  function maybeAdvanceRoundAndShowGameOver(nextState: AppState) {
    const currentRoundPairs = nextState.pairs.filter((p) => p.round === nextState.currentRound);
    if (currentRoundPairs.length === 0) return nextState;

    const allDead = currentRoundPairs.every((p) => p.status === "dead");
    if (!allDead) return nextState;

    const finishedRound = nextState.currentRound;
    const nextRound = finishedRound + 1;
    const nextRun = nextState.runNumber + 1;

    window.setTimeout(() => {
      window.alert(
        "Game Over! All Pokemon in round " +
          finishedRound +
          " are dead. Moving to round " +
          nextRound +
          " and run #" +
          nextRun +
          "."
      );
    }, 0);

    return {
      ...nextState,
      currentRound: nextRound,
      runNumber: nextRun
    };
  }

  function applyDeadSelection(deadBy: DeadBy | null) {
    const id = deathModalPairId;
    setDeathModalPairId(null);
    if (!id) return;

    const next = structuredClone(state) as AppState;
    const pair = next.pairs.find((p) => p.id === id);
    if (!pair) return;

    pair.status = "dead";
    pair.deadBy = deadBy ?? undefined;

    if (next.settings.autoPokemonDeathsOnPairDeath && deadBy) {
      if (deadBy === "both") {
        next.players.A.pokemonDeaths = clamp(next.players.A.pokemonDeaths + 1, 0, 9999);
        next.players.B.pokemonDeaths = clamp(next.players.B.pokemonDeaths + 1, 0, 9999);
      } else {
        next.players[deadBy].pokemonDeaths = clamp(next.players[deadBy].pokemonDeaths + 1, 0, 9999);
      }
    }

    pushState(maybeAdvanceRoundAndShowGameOver(next));
  }

  function toggleDead(id: string) {
    const pair = state.pairs.find((p) => p.id === id);
    if (!pair) return;

    if (pair.status === "dead") {
      const next = structuredClone(state) as AppState;
      const found = next.pairs.find((p) => p.id === id);
      if (!found) return;

      if (next.settings.autoPokemonDeathsOnPairDeath && found.deadBy) {
        if (found.deadBy === "both") {
          next.players.A.pokemonDeaths = clamp(next.players.A.pokemonDeaths - 1, 0, 9999);
          next.players.B.pokemonDeaths = clamp(next.players.B.pokemonDeaths - 1, 0, 9999);
        } else {
          next.players[found.deadBy].pokemonDeaths = clamp(next.players[found.deadBy].pokemonDeaths - 1, 0, 9999);
        }
      }

      found.status = "alive";
      found.deadBy = undefined;
      pushState(next);
      return;
    }

    if (state.settings.autoPokemonDeathsOnPairDeath) {
      setDeathModalPairId(id);
      return;
    }

    const next = structuredClone(state) as AppState;
    const found = next.pairs.find((p) => p.id === id);
    if (!found) return;
    found.status = "dead";
    pushState(maybeAdvanceRoundAndShowGameOver(next));
  }

  function deletePair(id: string) {
    pushState({
      ...state,
      pairs: state.pairs.filter((p) => p.id !== id)
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pokemon-soullink-run-" + state.runNumber + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = sanitizeState(parsed);
        pushState(next);
      } catch {
        window.alert("Could not import file.");
      }
    };

    reader.readAsText(file);
  }

  if (!firebaseConfig) {
    return (
      <div>
        <div className="theme-floating">
          <button
            className="btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </button>
        </div>

        <FirebaseSetup
          onSave={(config) => {
            saveFirebaseConfig(config);
            setFirebaseConfig(config);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div className="title-wrap">
            <div className="eyebrow">Pokemon Randomizer • SoulLink</div>
            <h1>Pokemon SoulLink Tracker</h1>
            <div className="badges">
              <Badge>Pairs: {state.pairs.length}</Badge>
              <Badge>Alive: {aliveCount}</Badge>
              <Badge>Dead: {deadCount}</Badge>
              <Badge>Current round: {state.currentRound}</Badge>
              <Badge>Pokemon list: {pokemonNames.length > 0 ? pokemonNames.length : "loading..."}</Badge>
            </div>
          </div>

          <div className="actions">
            <button
              className="btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>

            <button className="btn" onClick={exportJson}>
              Export
            </button>

            <label className="btn">
              Import
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importJson(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button className="btn danger" onClick={resetAll}>
              Reset
            </button>
          </div>
        </header>

        <div className="card session-card">
          <h3>Firebase Runtime Config</h3>

          <div className="actions">
            <Badge>Using browser-provided Firebase config</Badge>
            <button className="btn small" onClick={copyFirebaseConfig}>
              Copy config
            </button>
            <button className="btn small danger" onClick={resetFirebaseConfig}>
              Clear config
            </button>
          </div>

          <div className="muted">
            This page does not contain fixed credentials. Each user pastes their own Firebase config JSON.
          </div>
        </div>

        <div className="card session-card">
          <h3>Realtime Session</h3>

          <div className="session-row">
            <input
              className="input"
              value={sessionIdInput}
              onChange={(e) => setSessionIdInput(e.target.value)}
              placeholder="Session ID"
            />
            <button className="btn" onClick={joinSession}>
              Join session
            </button>
            <button className="btn primary" onClick={createSession}>
              Create session
            </button>
          </div>

          <div className="actions">
            {activeSessionId ? (
              <>
                <Badge>
                  <span className={"status-dot " + (syncStatus === "live" ? "online" : "")} />
                  {syncStatus === "live" ? "Live sync" : syncStatus === "connecting" ? "Connecting..." : "Local only"}
                </Badge>
                <Badge>
                  Session: <span className="code">{activeSessionId}</span>
                </Badge>
                <button className="btn small" onClick={copyInviteLink}>
                  Copy invite link
                </button>
              </>
            ) : (
              <Badge>Currently local-only mode</Badge>
            )}
          </div>
        </div>

        <div className="grid-top">
          <div className="card">
            <h3>Run</h3>
            <div className="stat-number">#{state.runNumber}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Tracks your current attempt • Current round: {state.currentRound}
            </div>

            <div className="section stat-controls">
              <button className="btn small" onClick={() => setRunNumber(state.runNumber - 1)}>
                -
              </button>
              <button className="btn small" onClick={() => setRunNumber(state.runNumber + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Players</h3>

            <div className="toggle">
              <div>
                <strong>Auto tracking</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  Ask who died first and auto-add Pokemon deaths
                </div>
              </div>

              <button
                type="button"
                className={"switch " + (state.settings.autoPokemonDeathsOnPairDeath ? "on" : "")}
                onClick={() =>
                  pushState({
                    ...state,
                    settings: {
                      ...state.settings,
                      autoPokemonDeathsOnPairDeath: !state.settings.autoPokemonDeathsOnPairDeath
                    }
                  })
                }
              >
                <span className="switch-knob" />
              </button>
            </div>

            <div className="player-card">
              <div className="count-box">
                <strong>Player A</strong>
                <Badge>{state.players.A.label}</Badge>
              </div>

              <label className="label">Name</label>
              <input
                className="input"
                value={state.players.A.label}
                onChange={(e) => setPlayerLabel("A", e.target.value)}
              />

              <div className="section">
                <div className="count-box">
                  <span>Pokemon deaths</span>
                  <Badge>{state.players.A.pokemonDeaths}</Badge>
                </div>
                <div className="control-row">
                  <button className="btn small" onClick={() => bumpPokemonDeaths("A", -1)}>
                    -1
                  </button>
                  <button className="btn small" onClick={() => bumpPokemonDeaths("A", 1)}>
                    +1
                  </button>
                </div>
              </div>

              <div className="section">
                <div className="count-box">
                  <span>Run fails</span>
                  <Badge>{state.players.A.runFails}</Badge>
                </div>
                <div className="control-row">
                  <button className="btn small" onClick={() => bumpRunFails("A", -1)}>
                    -1
                  </button>
                  <button className="btn small" onClick={() => bumpRunFails("A", 1)}>
                    +1
                  </button>
                </div>
              </div>
            </div>

            <div className="player-card">
              <div className="count-box">
                <strong>Player B</strong>
                <Badge>{state.players.B.label}</Badge>
              </div>

              <label className="label">Name</label>
              <input
                className="input"
                value={state.players.B.label}
                onChange={(e) => setPlayerLabel("B", e.target.value)}
              />

              <div className="section">
                <div className="count-box">
                  <span>Pokemon deaths</span>
                  <Badge>{state.players.B.pokemonDeaths}</Badge>
                </div>
                <div className="control-row">
                  <button className="btn small" onClick={() => bumpPokemonDeaths("B", -1)}>
                    -1
                  </button>
                  <button className="btn small" onClick={() => bumpPokemonDeaths("B", 1)}>
                    +1
                  </button>
                </div>
              </div>

              <div className="section">
                <div className="count-box">
                  <span>Run fails</span>
                  <Badge>{state.players.B.runFails}</Badge>
                </div>
                <div className="control-row">
                  <button className="btn small" onClick={() => bumpRunFails("B", -1)}>
                    -1
                  </button>
                  <button className="btn small" onClick={() => bumpRunFails("B", 1)}>
                    +1
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>{editingId ? "Edit pair" : "New SoulLink pair"}</h3>

            <div className="form-grid-2">
              <div>
                <label className="label">Round #</label>
                <input
                  className="input"
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>

              <div>
                <label className="label">Encounter / Slot #</label>
                <input
                  className="input"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <div className="section form-grid-2">
              <div>
                <label className="label">{state.players.A.label} Pokemon</label>
                <PokemonAutocompleteInput
                  value={aName}
                  onChange={setAName}
                  pokemonNames={pokemonNames}
                  placeholder="e.g. Pikachu"
                />
              </div>

              <div>
                <label className="label">{state.players.B.label} Pokemon</label>
                <PokemonAutocompleteInput
                  value={bName}
                  onChange={setBName}
                  pokemonNames={pokemonNames}
                  placeholder="e.g. Charmander"
                />
              </div>
            </div>

            <div className="section form-grid-2">
              <div>
                <label className="label">Nickname A</label>
                <input className="input" value={aNick} onChange={(e) => setANick(e.target.value)} />
              </div>

              <div>
                <label className="label">Nickname B</label>
                <input className="input" value={bNick} onChange={(e) => setBNick(e.target.value)} />
              </div>
            </div>

            <div className="section">
              <label className="label">Notes</label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Route 3"
              />
            </div>

            <div className="section actions">
              <button className="btn primary" onClick={submitPair}>
                {editingId ? "Save changes" : "Add pair"}
              </button>
              <button className="btn" onClick={clearForm}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="card section">
          <div className="search-row">
            <div className="team-tabs">
              <button
                className={"team-tab " + (teamFilter === "all" ? "active" : "")}
                onClick={() => setTeamFilter("all")}
              >
                All
              </button>
              <button
                className={"team-tab " + (teamFilter === "alive" ? "active" : "")}
                onClick={() => setTeamFilter("alive")}
              >
                Alive
              </button>
              <button
                className={"team-tab " + (teamFilter === "dead" ? "active" : "")}
                onClick={() => setTeamFilter("dead")}
              >
                Dead
              </button>
            </div>

            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, nickname, notes, round..."
            />

            <div className="muted" style={{ textAlign: "right", fontWeight: 700 }}>
              Viewing round {state.currentRound}
            </div>
          </div>

          {groupedPairs.length === 0 ? (
            <div className="empty section">No pairs match the current filter.</div>
          ) : (
            groupedPairs.map(([roundNumber, pairs]) => (
              <div key={roundNumber}>
                <h3 className="round-group-title">Round {roundNumber}</h3>

                <div className="list">
                  {pairs.map((pair) => (
                    <PairCard
                      key={pair.id}
                      pair={pair}
                      playerA={state.players.A.label}
                      playerB={state.players.B.label}
                      onEdit={startEdit}
                      onDelete={deletePair}
                      onToggleDead={toggleDead}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="footer">
          Auto-saves in localStorage • Realtime sync uses runtime Firebase config from the user
        </div>
      </div>

      {deathModalPairId ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Who died first?</h3>
            <p className="muted">
              This decides which player's Pokemon death counter gets increased.
            </p>

            <div className="modal-actions">
              <button className="btn" onClick={() => applyDeadSelection("A")}>
                Player A
              </button>
              <button className="btn" onClick={() => applyDeadSelection("B")}>
                Player B
              </button>
              <button className="btn" onClick={() => applyDeadSelection("both")}>
                Both
              </button>
              <button className="btn danger" onClick={() => applyDeadSelection(null)}>
                No counter change
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
