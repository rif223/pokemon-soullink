import { useMemo, useState } from "react";

export default function PokemonAutocompleteInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  pokemonNames: string[];
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = props.value.trim().toLowerCase();
    if (!q) return [];

    const starts = props.pokemonNames.filter((name) =>
      name.toLowerCase().startsWith(q)
    );
    const contains = props.pokemonNames.filter(
      (name) => !starts.includes(name) && name.toLowerCase().includes(q)
    );

    return [...starts, ...contains].slice(0, 8);
  }, [props.value, props.pokemonNames]);

  return (
    <div className="autocomplete-wrap">
      <input
        className="input"
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        placeholder={props.placeholder}
      />

      {open && suggestions.length > 0 ? (
        <div className="autocomplete-list">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="autocomplete-item"
              onClick={() => {
                props.onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
