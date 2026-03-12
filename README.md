# Pokemon SoulLink Tracker

A Vite + React + TypeScript app for tracking Pokemon SoulLink runs with optional Firebase Realtime sync.

## Features

- Switchable light and dark mode
- Theme is saved in localStorage
- Improved Firebase setup screen with taller JSON textarea
- Pokemon autocomplete via PokeAPI
- Pokemon sprites
- Runtime Firebase config
- No fixed Firebase credentials in code
- Long random session IDs
- Stable full app state sync
- LocalStorage fallback
- Team view
- Round tracking
- Automatic run increment on full round wipe
- Split file structure for easier maintenance

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Firebase setup

This app does not contain hardcoded Firebase credentials.

Each user pastes a Firebase Web App config JSON into the app at runtime. The config is stored only in that browser via localStorage.

### 1. Create a Firebase project
- Open Firebase Console
- Create a new project

### 2. Register a Web App
- In the project overview, click the Web icon
- Register a web app
- Firebase will show you a config object

Example:

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "databaseURL": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}
```

### 3. Create the Realtime Database
- Go to Build -> Realtime Database
- Click Create Database
- Choose a region
- For first tests, choose Test mode

### 4. Test rules

```json
{
  "rules": {
    "sessions": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 5. Recommended usage
Player 1:
- paste Firebase config
- click Create session
- copy invite link
- send the same config and the link to Player 2

Player 2:
- paste the same config
- open the same invite link
- do not create a second session

## GitHub Pages with docs folder

The Vite base path is already set for:

```
/pokemon-soullink/
```

If you deploy with docs:
1. Run `npm run build`
2. Copy dist contents into docs
3. Push to GitHub
4. In GitHub Pages use:
   - Branch: main
   - Folder: /docs
