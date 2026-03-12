import { useState } from "react";
import type { FirebaseRuntimeConfig } from "../firebaseRuntime";

export default function FirebaseSetup(props: {
  onSave: (config: FirebaseRuntimeConfig) => void;
}) {
  const [jsonText, setJsonText] = useState(`{
  "apiKey": "",
  "authDomain": "",
  "databaseURL": "",
  "projectId": "",
  "storageBucket": "",
  "messagingSenderId": "",
  "appId": ""
}`);

  function save() {
    try {
      const parsed = JSON.parse(jsonText) as FirebaseRuntimeConfig;

      const required: Array<keyof FirebaseRuntimeConfig> = [
        "apiKey",
        "authDomain",
        "databaseURL",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId"
      ];

      for (const key of required) {
        if (!parsed[key]) {
          window.alert("Missing field: " + key);
          return;
        }
      }

      props.onSave(parsed);
    } catch {
      window.alert("Invalid JSON.");
    }
  }

  return (
    <div className="page">
      <div className="container setup-wrap">
        <div className="card setup-card">
          <h1 style={{ marginTop: 0 }}>Pokemon SoulLink Tracker Setup</h1>
          <p className="muted">
            Paste your own Firebase Web App config JSON here. Nothing is hardcoded.
            The config is stored only in this browser via localStorage.
          </p>

          <div className="setup-grid">
            <label className="label">Firebase config JSON</label>
            <textarea
              className="textarea setup-textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />

            <div className="actions">
              <button className="btn primary" onClick={save}>
                Save config
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
