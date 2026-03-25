# localize

`localize` is a small web app for managing and translating i18n JSON files in a Docker-backed workspace.

## Features

- Create projects with a source language JSON file
- Upload files directly or import existing JSON files from the mounted volume library
- Track translation progress per language
- Edit translations in a two-column source/target layout
- Download one language or all project languages as a ZIP
- Dark mode with a topbar switch

## Development

```bash
npm install
npm run dev
```

This starts:

- Vite on `http://localhost:5173`
- The API server on `http://localhost:3001`

## Docker

```bash
docker compose up --build
```

The app stores all project data in [`data`](./data), mounted into the container at `/app/data`.
