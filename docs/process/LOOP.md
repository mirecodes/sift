# Autonomous build loop

This file tells the coding agent how to build Sift v2 step by step without the owner prompting each step. Point the agent at it (`@docs/process/LOOP.md`) when starting the loop.

- **What to build:** `docs/plans/guidance_v2.md` (read-only for the agent).
- **Where we are:** `docs/status/PROGRESS.md` (the agent keeps it current).
- **Owner action after the docs move (2026-10-27):** the agent may not edit `.claude/`. Before running the loop again, set `progressFile` in `.claude/loop/config.json` to `docs/status/PROGRESS.md`, and update the `docs/guidance_v2.md` deny paths in `.claude/settings.json` to `docs/plans/**`.
- **Who decides to continue:** the Stop hook `.claude/hooks/continue-loop.mjs`. After every turn it runs the verification commands, checks that the work tree is clean, and either sends the agent to the next step or lets it stop.

The loop runs only while `.claude/loop/RUN` exists. Without that file, Claude Code behaves normally.

---

## One iteration = one step

1. **Pick the step.** Open `docs/status/PROGRESS.md`. Take the first step marked `[~]`; if none, the first `[ ]`. Mark it `[~]`.
2. **Load context.** Read that step in `docs/plans/guidance_v2.md`, plus §0.2 Working rules, §0.3 Definition of done, and every section the step references. Check `ARCHITECTURE.md`, `DECISIONS.md` and the existing code before designing anything.
3. **Implement** the smallest complete change that satisfies the step. Follow the layer rules (pure domain, adapters, balance config, feature flags).
4. **Verify.**
   - Add the tests the step lists, then run unit tests and type checking.
   - Run `npm run e2e` when the step changes UI flows, and always before marking the **last step of a phase** done.
   - Walk through every acceptance criterion of the step and confirm each one explicitly.
5. **Self-review the diff** as a strict reviewer would: layer violations, magic numbers outside the balance config, missing tests, anything shown during Focus, missing reduced-motion handling, missing strings in the strings file. Fix what you find.
6. **Document.** Update `CHANGELOG.md`; write or update the ADRs the step marks; fix doc drift you touched.
7. **Record progress.** Mark the step `[x]` in `docs/status/PROGRESS.md` with one indented note line (what was done, anything notable). Add visual or feel checks you could not verify to **Owner review queue**. Add any default you chose to **Decisions taken by the agent**.
8. **Commit** everything, including `docs/status/PROGRESS.md`, with the message `step X.Y: <title>`. Never push.
9. **End the turn** with a three-line summary: step, result, next step. The Stop hook decides what happens next.

Every turn must end with a **clean work tree** (everything committed or restored).

---

## Rules while the loop runs

- **Do not ask the owner questions.** The owner is not watching. Use the defaults in the guidance (§8, §9.2). If the guidance is silent, choose the simplest option consistent with it and log it under "Decisions taken by the agent".
- **Stop and hand over** by marking the step `[!]` with an indented note starting `NEEDS OWNER:` and committing, when the step requires:
  - accounts, credentials, API keys, paid services or project creation (Supabase project, Apple/Google developer accounts, push certificates, store consoles, domains);
  - a decision that contradicts the guidance or an owner decision;
  - anything destructive to real user data.
- **Failure rule.** If verification fails three times on the same step, restore the work tree to the last commit (`git restore` / `git stash`), mark the step `[!]` with a diagnosis (`NEEDS OWNER: ...` or `STUCK: ...`), commit `docs/status/PROGRESS.md`, and end the turn.
- **Never:**
  - weaken, skip or delete tests to make them pass;
  - edit `.claude/` (hooks, loop config, settings) or `docs/plans/` (propose changes as notes in `docs/status/PROGRESS.md` instead);
  - push, force-push, rewrite history, or publish anything;
  - turn a feature flag on for production builds;
  - work on more than one step per turn, or start a step from a later phase.
- **New dependencies** need a one-line justification in the step's ADR and must be small and well maintained.
- **Context hygiene.** State lives in files, not in the conversation. After a compaction, re-read `docs/status/PROGRESS.md` and the current step before continuing.
