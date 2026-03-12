import type { LinkedPair } from "../types";
import Badge from "./Badge";
import PokemonBox from "./PokemonBox";

export default function PairCard(props: {
  pair: LinkedPair;
  playerA: string;
  playerB: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDead: (id: string) => void;
}) {
  const isDead = props.pair.status === "dead";

  return (
    <div className={"pair-card " + (isDead ? "dead" : "")}>
      <div className="pair-header">
        <div className="pair-badges">
          <Badge>Round {props.pair.round}</Badge>
          <Badge>Slot #{props.pair.slot}</Badge>
          <Badge>{isDead ? "☠ Dead" : "✅ Alive"}</Badge>
          {props.pair.deadBy ? <Badge>by {props.pair.deadBy}</Badge> : null}
          {props.pair.notes ? <Badge>{props.pair.notes}</Badge> : null}
        </div>

        <div className="pair-actions">
          <button className="btn small" onClick={() => props.onToggleDead(props.pair.id)}>
            {isDead ? "Revive" : "Mark dead"}
          </button>
          <button className="btn small" onClick={() => props.onEdit(props.pair.id)}>
            Edit
          </button>
          <button className="btn small danger" onClick={() => props.onDelete(props.pair.id)}>
            Delete
          </button>
        </div>
      </div>

      <div className="pair-main">
        <PokemonBox playerLabel={props.playerA} pokemon={props.pair.a} />
        <PokemonBox playerLabel={props.playerB} pokemon={props.pair.b} />
      </div>
    </div>
  );
}
