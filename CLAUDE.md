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
- Work directly on `main` (owner, 2026-11-04): commit and push there; no feature branches or pull requests unless asked.

## Delegation (token cost)

The main session plans, decides, writes docs, reviews and commits. Implementation goes to subagents in `.claude/agents/` only when that is cheaper than doing it here.

**Delegate a unit when all three hold:**
1. **Settled**: files, behavior and tests can be stated in the brief with no open design, data-model or visual question.
2. **Big enough**: about 5+ file edits or 10+ tool calls expected (incl. test-fix loops), or a bulk mechanical change.
3. **Cheap to brief**: the brief points to paths and doc sections; it does not need pasted file contents or this session's reasoning.

**Pick the agent:**
- `coder-sonnet` (Sonnet): default for delegated units: boilerplate, screens/components to a settled spec, content data, tests, mechanical refactors.
- `coder-opus` (Opus, medium effort): delegated units that need judgment inside the spec: tricky algorithms, timer/state logic, rendering performance, a bug whose area is known but cause is not.

**Stay in the main session when any holds:** about 5 or fewer tool calls; only files already read in this session; an open design, architecture or visual decision; docs-only work; a cause still unknown with no area to point to; a small follow-up fix to a subagent's result (larger follow-ups: continue the same agent with SendMessage, not a new one).

**How:**
- Brief: goal, files to touch, doc sections by path and number, acceptance criteria and tests, what not to touch. No pasted files.
- One unit per agent. Independent units run in parallel; units touching the same files run one after another.
- Review with `git diff` and the checks (`npm run typecheck`, `npm test`), not by re-reading whole files. Then update docs and commit here.
