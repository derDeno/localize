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
- `SESSION_COOKIE_SECURE` to force secure cookies on or off. Set this to `false` when you serve the Docker app over plain `http://`.
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`


## GitHub workflow uploads

You can upload translation files and update the project version from GitHub Actions with the bundled script and composite action.

The script expects one JSON file per language, named `<languageCode>.json`. By default it looks in common folders like `languages`, `locales`, `translations`, `i18n`, and their `src` or `public` variants. You can override that with `translations-dir`.


### CLI usage

```bash
LOCALIZE_BASE_URL=https://localize.example.com \
npm run push:translations -- \
  --project-id 12345678-1234-1234-1234-123456789abc \
  --api-key loc_xxxxxxxxxxxxxxxxxxxx \
  --version 2.4.0 \
  --languages de,en,fr
```

The script uploads every requested language first and only updates the project version after all uploads succeed.


### GitHub Action usage

Set `LOCALIZE_BASE_URL` once in your workflow or repository variables, then the action step only needs the project id, API key, version, and language codes.

```yml
name: Push translations

on:
  workflow_dispatch:

jobs:
  push-translations:
    runs-on: ubuntu-latest
    env:
      LOCALIZE_BASE_URL: ${{ vars.LOCALIZE_BASE_URL }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: ./.github/actions/push-translations
        with:
          project-id: 12345678-1234-1234-1234-123456789abc
          api-key: ${{ secrets.LOCALIZE_API_KEY }}
          version: 2.4.0
          language-codes: de,en,fr
```

If your files are not in one of the default folders, add `translations-dir` to the action inputs.
