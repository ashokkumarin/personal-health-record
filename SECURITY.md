# Security Policy

PHR stores medical documents, so security reports get priority handling.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use [GitHub's private vulnerability reporting](../../security/advisories/new)
for this repository (Security tab → "Report a vulnerability"). If that's not
available to you, email the maintainer directly — see the profile on the
account that owns this repository.

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro is very helpful)
- Any relevant logs, screenshots, or PoC code

## What to expect

- Acknowledgement within a few days.
- We'll keep you updated as we investigate and fix the issue.
- We'll credit you in the release notes/advisory unless you'd prefer to stay
  anonymous.

## Supported versions

Only the latest released version is supported with security fixes. Because
this is a self-hosted project, users are responsible for keeping their own
deployment updated — see the README for the upgrade process.

## Automated scanning

This repository runs continuous automated checks in addition to manual
reports:

- [Dependabot](.github/dependabot.yml) opens weekly PRs for outdated/vulnerable
  npm, GitHub Actions, and base-image dependencies.
- [CodeQL](.github/workflows/codeql.yml) scans application code on every push
  to `main`/`develop`, every PR, and weekly on a schedule. Results appear
  under the repo's Security → Code scanning tab.
- Released container images are scanned with [Trivy](https://trivy.dev) as
  part of [`release.yml`](.github/workflows/release.yml); a release fails if
  a critical/high vulnerability with an available fix is found. Reviewed,
  non-exploitable findings can be suppressed via [`.trivyignore`](.trivyignore).

These catch known/disclosed vulnerabilities in dependencies — they don't
replace the need to report vulnerabilities you find in this project's own
code via the process above.
