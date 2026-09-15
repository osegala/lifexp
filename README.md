# LifeXP

## Run the backend locally

Use Java 21 and a local PostgreSQL database named `productivity`.

```sh
python3 scripts/setup-local-env.py
./mvnw spring-boot:run
```

The setup script creates an ignored `.env` in this directory with a random JWT
signing secret and test-account password. It will not overwrite an existing file.
Check `DB_USERNAME`, `DB_PASSWORD`, and `DB_URL` in `.env` for your database setup.
Run Maven from this directory so Spring can load `.env`. Environment variables
override the file. The backend refuses to start without a signing secret of at
least 32 bytes. Secrets must stay on the backend; do not use `EXPO_PUBLIC_` for them.

## Optional development account

Normal startup does not create a test user. To create the development tester,
set `DEV_SEED_TEST_ACCOUNT=true` in your private `.env`, then run:

```sh
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

This requires `DEV_TEST_ACCOUNT_PASSWORD` (at least 16 characters). Creation is
disabled when the `prod` profile is active. Existing accounts, including their
passwords and progress, are left unchanged. Disable the opt-in after creation.
Changing the environment value does not change an existing account's password.

## Credentials and Git

Keep `.env`, private keys, and `node_modules` out of Git; `.gitignore` excludes
them at every directory level. Commit package manifests and lockfiles instead.
Install frontend dependencies with `npm ci` inside `frontend`.

The old JWT secrets and development password were committed in earlier history.
Do not reuse them. Rotate any system that used those credentials; changing the
JWT signing key invalidates previously issued sessions and requires a new login.
Removing a value from the latest commit does not erase it from older commits.
History rewriting is a separate operation requiring coordination with other
clones; rotating credentials is the first step.

For any future deployment, supply private `JWT_SECRET`, `DB_USERNAME`,
`DB_PASSWORD`, and `DB_URL` through the host's secret/environment settings.
Leave development account creation disabled.

## Checks

```sh
./mvnw test
cd frontend
npm run test:session
```
