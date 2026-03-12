import { useEffect, useState } from "react";
import { toPokeApiSlug } from "../utils";

function usePokemonSprite(name: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const slug = toPokeApiSlug(name);
    if (!slug) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon/" + encodeURIComponent(slug));
        if (!res.ok) throw new Error("not found");

        const data = await res.json();
        const nextUrl =
          data?.sprites?.other?.["official-artwork"]?.front_default ||
          data?.sprites?.other?.home?.front_default ||
          data?.sprites?.front_default ||
          null;

        if (!cancelled) {
          setUrl(nextUrl);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [name]);

  return url;
}

export default function PokemonBox(props: {
  playerLabel: string;
  pokemon: { name: string; nickname?: string };
}) {
  const sprite = usePokemonSprite(props.pokemon.name);

  return (
    <div className="pokemon-box">
      <div className="sprite">
        {sprite ? <img src={sprite} alt={props.pokemon.name} /> : <span className="muted">No img</span>}
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12 }}>
          {props.playerLabel}
        </div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {props.pokemon.nickname
            ? `${props.pokemon.nickname} (${props.pokemon.name})`
            : props.pokemon.name}
        </div>
      </div>
    </div>
  );
}
