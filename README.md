# localize

`localize` is a small web app for managing and translating i18n JSON files in a Docker-backed workspace.
The app now stores users, projects, languages, translations, settings, and project revisions in PostgreSQL while still exporting generated JSON files into the mounted data directory.

## Features

- Create projects with a source language JSON file
- Upload files directly or import existing JSON files from the mounted volume library
- Track translation progress per language
- Edit translations in a two-column source/target layout
- Download one language or all project languages as a ZIP
- User authentication with `admin`, `editor`, and `viewer` roles
- Admin settings for user management, app policies, and SSO configuration placeholders
- Project revisions stored in the database and JSON snapshots exported to disk

## Development

```bash
npm install
npm run db:init
npm run dev
```

This starts:

- Vite on `http://localhost:5173`
- The API server on `http://localhost:3001`
- PostgreSQL-backed API logic after migrations and seed data are applied

Default seeded admin credentials:

- Email: `admin@localize.local`
- Password: `admin123!`

## Docker

```bash
docker compose up --build
```

This starts:

- `postgres`, which stores the application data
- `localize`, which runs migrations/seeding during container startup before launching the server

The app stores exported JSON snapshots and library files in [`data`](./data), mounted into the container at `/app/data`.
Default app port is `3001`.

## Environment

The app container supports these main environment variables:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` as an override if you prefer one connection string
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

App policy settings like registration and delete permissions are initialized in the database on first run and should be managed afterward from the settings page.
