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

### Live frontend changes without rebuilding

If you want a live stack for development or staging on this machine, use the separate Compose file:

```bash
docker compose -f docker-compose.live.yml up --build
```

This mode:

- builds the local source with the `development` Docker target
- bind-mounts the repository into the container
- runs `npm run dev` instead of the production server
- exposes Vite on `http://localhost:5173`
- keeps the API on `http://localhost:3002` by default, so it does not clash with the production-style Compose stack on `3001`
- reloads the frontend when files under [`src`](./src) change, without rebuilding the image

The first start may run `npm ci` inside the container to populate the named `node_modules` volume. After that, frontend edits are picked up directly from the bind mount.
When `package-lock.json` changes, the live container automatically reruns `npm ci` on startup so newly added packages are installed into the Docker-managed `node_modules` volume.

If you want different host ports, you can override them:

```bash
LOCALIZE_APP_PORT=3100 LOCALIZE_VITE_PORT=5174 docker compose -f docker-compose.live.yml up --build
```

Use this live Compose setup for development or an internal preview environment. For a real production deployment, keep using the production image flow from [`docker-compose.yml`](./docker-compose.yml), because hot-reload servers and bind mounts are not a good fit for internet-facing production.

For PostgreSQL 18.x, the official Docker image moved its default `PGDATA` to a versioned path under `/var/lib/postgresql`, so the Compose file mounts the volume at `/var/lib/postgresql` and sets `PGDATA=/var/lib/postgresql/18/docker`.
If you are upgrading from an older Compose setup that mounted `/var/lib/postgresql/data`, migrate the existing volume contents into the new `18/docker` subdirectory before reusing that volume.

## Environment

The app container supports these main environment variables:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` as an override if you prefer one connection string
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE` to force secure cookies on or off. Set this to `false` when you serve the Docker app over plain `http://`.
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

App policy settings like registration and delete permissions are initialized in the database on first run and should be managed afterward from the settings page.
