# Sift docs

Every doc lives in a folder by what it is for.

| Folder | What | Files |
|---|---|---|
| `plans/` | Work orders from the owner, implemented step by step | `guidance_v2.md` |
| `reference/` | Rules in effect: the agent reads these before every task | `ARCHITECTURE.md` (structure, settled decisions), `DESIGN.md` (look and feel), `API.md` (server endpoints) |
| `guides/` | How-tos for people: adding content, connecting services, building the apps | `CONTENT.md`, `BACKEND_SETUP.md`, `MOBILE_SETUP.md`, `STORE_READINESS.md` |
| `status/` | Where the project stands | `PROJECT_STATUS.md` (planner snapshot), `PROGRESS.md` (step checklist, owner review queue, agent decisions) |
| `logs/` | History, append-only | `CHANGELOG.md`, `DECISIONS.md` (ADRs, human-only) |
| `process/` | How the coding agent works | `LOOP.md` (autonomous build loop) |

Start with `status/PROJECT_STATUS.md` for the big picture, `guides/` to do something, `reference/` for the rules.
