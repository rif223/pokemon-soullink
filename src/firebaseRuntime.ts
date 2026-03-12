import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

export type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Database | null = null;

export function initFirebaseRuntime(config: FirebaseRuntimeConfig) {
  if (!getApps().length) {
    appInstance = initializeApp(config);
  } else {
    appInstance = getApp();
  }

  dbInstance = getDatabase(appInstance);

  return {
    app: appInstance,
    db: dbInstance
  };
}
