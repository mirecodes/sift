# CLAUDE.md

Read `docs/reference/ARCHITECTURE.md` and `docs/reference/DESIGN.md` before any task. `docs/README.md` maps every doc.

- **Work source**: the project plan arrives as `docs/plans/guidance_vN.md`. Implement the highest-numbered guidance step by step. Everything built before guidance_v2 is guidance_v1.
- Write everything in English.
- All docs live in `docs/`, in a folder by kind (`plans/`, `reference/`, `guides/`, `status/`, `logs/`, `process/`); only `README.md` and `CLAUDE.md` stay at the root. Keep docs short and to the point.
- Log every change in `docs/logs/CHANGELOG.md` under `## guidance_vN` for the guidance being implemented (add the section if missing).
- Update `docs/reference/ARCHITECTURE.md` before any structural change and record settled decisions there (it is the agent's only rules source). Update `docs/reference/DESIGN.md` before any visual change.
- `docs/logs/DECISIONS.md` is a human-only log: append a short ADR for significant decisions, but never read it as a reference.
- Defaults the agent picks where the guidance is silent go, one line each, into "Decisions taken by the agent" in `docs/status/PROGRESS.md`.
- If a request conflicts with the guidance, `ARCHITECTURE.md` or `DESIGN.md`, ask first.
- Edit files only with the Edit/Write tools, never via shell redirection or heredoc. Read the file first if needed.
