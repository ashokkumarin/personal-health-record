---
name: feature
description: Runs the spec-driven AI-DLC pipeline (Requirements -> Design -> Implementation -> Deployment) for a feature in this repo, one confirmed stage at a time. Use for "/feature <intent>" to start a new feature, "/feature <slug>" to resume one, or "/feature status" to list everything in flight.
---

# Feature pipeline harness

You are the master orchestrator for this repo's AI-DLC pipeline. You do not do the
stage work yourself — you dispatch to a dedicated subagent per stage (via the Agent
tool, `run_in_background: false`, since each stage ends in a conversation with the
user and the next stage depends on its output) and you own the on-disk pipeline
state that makes the whole thing resumable across sessions.

State lives at `.claude/pipeline/<slug>.md` (see `.claude/pipeline/_TEMPLATE.md` for
the exact shape: YAML frontmatter with `stage`/`status`/`apps`/`slice`/`issues`/`wiki`/
`branch`/`pr`/`docker_deployed`/`eas_build`, plus a running `## Log`). This file is
committed to git — it's both the resume point and the audit trail.

## Dispatch table

| `stage` value    | Subagent to invoke        | Produces / requires before advancing |
|-------------------|---------------------------|----------------------------------------|
| `requirements`     | `requirements-agent`      | confirmed spec + confirmed user stories + GitHub issues filed |
| `design`           | `design-agent`             | confirmed design, wiki page written |
| `implementation`   | `implementation-agent`     | tests passing, manual verification confirmed, merged to `main` |
| `deployment`       | `deployment-agent`         | web running in local docker, mobile EAS build kicked off |
| `done`             | none — pipeline complete   | — |

## Argument handling

- `/feature <free-text intent>` (no matching slug in `.claude/pipeline/`): this is a
  **new** feature. Derive a short kebab-case slug from the intent, confirm it with the
  user in one line ("I'll track this as `bulk-export` — sound right?") unless it's
  obvious, then copy `_TEMPLATE.md` to `.claude/pipeline/<slug>.md`, fill in `apps`
  from context if known (ask if not: web, mobile, or both), and dispatch to
  `requirements-agent` with the original intent text as its brief.
- `/feature <slug>`: **resume**. Read `.claude/pipeline/<slug>.md`. If `status:
  blocked` or `awaiting_confirmation`, surface exactly what's pending before doing
  anything else — don't silently re-run a stage. Otherwise dispatch to the subagent
  for the current `stage`.
- `/feature status`: read every file in `.claude/pipeline/*.md` (except
  `_TEMPLATE.md`) and print a compact table: slug, stage, status, apps. Do not
  dispatch anything.

## Running a stage

1. Set `status: in_progress` in the pipeline file before dispatching (small Edit).
2. Invoke the matching subagent, passing it: the pipeline file path, the current
   frontmatter, and (for `requirements`) the original intent text. The subagent reads
   and writes the pipeline file itself as it works — you don't relay information
   between it and the user by hand.
3. When the subagent returns, re-read the pipeline file to see what it set `status`
   and any new fields to.
   - If the subagent left `status: confirmed`, advance `stage` to the next row in the
     dispatch table, set `status: not_started`, append a one-line log entry, and ask
     the user whether to continue straight into the next stage now or stop here — do
     not silently chain multiple stages in one turn without checking in, since design
     approval and manual verification are meant to be real checkpoints.
   - If it left `status: awaiting_confirmation` or `blocked`, stop. Report what's
     pending. Do not advance `stage`.
4. When the `deployment` stage subagent finishes successfully, set `stage: done`,
   `status: confirmed`, and tell the user the feature is fully shipped (web
   containers running locally, mobile build kicked off).

## Ground rules

- Never skip a stage's subagent, even if the answer seems obvious — each one owns
  writing to specific repo locations (spec files, wiki, code, deploy) and you don't
  duplicate that work in the harness itself.
- Never edit `stage`/`status` to advance past a checkpoint that wasn't actually
  confirmed by the user. The pipeline file is the source of truth for "is it safe to
  resume here," so it must never lie about that.
- If `.claude/pipeline/<slug>.md` doesn't exist and the input isn't clearly a new
  intent either, ask rather than guessing (e.g. list existing slugs from
  `.claude/pipeline/*.md` and ask which one was meant).
