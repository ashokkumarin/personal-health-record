# Contributing to PHR

Thanks for considering a contribution. This project is a self-hosted
personal health record system, so correctness and data safety matter more
than usual — please keep that in mind for anything touching auth, sharing/
visibility, or file storage.

## Before you start

- For anything beyond a small fix, open an issue first to discuss the
  approach. This project follows spec-driven development (see
  `docs/specs/`) — larger features should get a short slice doc describing
  the user story and acceptance criteria before implementation starts.
- Check existing issues/PRs to avoid duplicate work.

## Development setup

See the [README](README.md#getting-started) for the full local setup
(Node 22, Docker for Postgres, `npm install`, `.env`, migrations).

## Making changes

1. Fork the repo and create a branch off `develop` (or `main` if `develop`
   doesn't exist) — `git checkout -b my-feature`.
2. Make your change. Keep PRs focused: one feature or fix per PR.
3. Add or update tests for anything in `apps/api` (`npm run test:api`).
   There's no test suite for web/mobile yet — manual verification in the
   browser/Expo is expected for those changes.
4. Make sure the project builds: `npm run build:shared`, then typecheck/build
   the app(s) you touched.
5. Update relevant docs (`docs/`, README) if behavior or setup steps changed.

## Commit messages

Use clear, descriptive commit messages. Conventional prefixes
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) are encouraged but not
required.

## Pull requests

- Describe what changed and why, not just what.
- Link the issue it resolves, if any.
- CI (typecheck, api tests, Docker image build) must pass before merge.
- A maintainer will review and may ask for changes — this is normal, not a
  rejection.

## Reporting bugs / requesting features

Use the issue templates. For security vulnerabilities, do **not** open a
public issue — see [SECURITY.md](SECURITY.md) instead.

## Code of Conduct

Participation in this project is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under
the project's [AGPL-3.0-or-later license](LICENSE).
