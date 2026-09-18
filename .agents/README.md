# Agent Skills for ProviderBeacon

Repository-scoped installation of [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), release **0.6.10**, pinned to commit `c004a74784a08295d52749b04cda634125b9a581`.

## What is installed

- All 25 upstream skill folders in `skills/`, including their packaged supporting files.
- Upstream shared checklists in `references/`, preserving `../../references/...` paths used by the skills.
- The upstream MIT license in `LICENSE.addy-agent-skills` and a source/hash inventory in `agent-skills.lock.json`.
- An offline integrity checker, `verify-installation.py`.

The upstream files are copied without rewriting their content. The imported `idea-refine/scripts/idea-refine.sh` is an optional upstream helper; installation and verification do not execute it. No upstream lifecycle hooks, plugin auto-loaders, background agents or global configuration are installed. Optional external tools referenced by skills, such as browser MCP servers, must be configured separately and are not supplied by this snapshot.

This is development guidance, not the customer-facing AI assistant. It does not add a runtime service, change application dependencies, edit database records, or authorize deployment. The upstream license applies only to the imported files and does not relicense ProviderBeacon.

## Use in Codex

Open a checkout of the branch containing this installation. Codex discovers repository skills under `.agents/skills`; a session on another branch will not see files that have not been merged into that branch. Refresh/restart the session if the new skills do not appear.

In Codex CLI or the IDE extension, open `/skills` or mention a skill with `$`. For example:

```text
$code-review-and-quality Review ProviderBeacon without editing files. Give evidence-backed findings with file locations and severity, then propose an incremental repair plan.
```

```text
$debugging-and-error-recovery Reproduce the reported bug and propose the smallest fix with a regression test. Do not deploy.
```

```text
$performance-optimization Measure the current bottleneck before proposing changes. Preserve the existing theme and reduced-motion behavior.
```

Use natural-language skill names when a host uses a different selector. Do not install a second global copy of this pack merely to activate the project copy. Do not preload the full meta-skill into `AGENTS.md`.

Official discovery documentation: https://developers.openai.com/codex/skills/

## Verify offline

Run from the repository root:

```bash
python3 .agents/verify-installation.py
```

The checker verifies the pinned source identity, inventory, SHA-256 and Git blob hashes, 25 unique skill names, and required routing headers. It refuses missing, changed or extra files in the vendored directories. This is a static installation check, not an end-to-end Codex session test or a guarantee of code quality.

## Updates and removal

Updates must use a separate reviewed PR: select an upstream release, resolve its full commit SHA, inspect the upstream diff and any helper scripts, replace the vendored files and regenerate the lock inventory. Update the checker constants if the release or skill count changes. Run the integrity check and relevant project checks before merging. Do not update from a moving branch automatically or use a per-skill installer that omits shared references.

Keep local project rules in the root `AGENTS.md`, not inside upstream skill files. Avoid running formatters on the vendored directories because rewriting them breaks the recorded hashes.

To remove the integration, remove the imported directories, license, lockfile, checker and this guide in a reviewed PR, and remove only the skills-specific references from `AGENTS.md`. Preserve unrelated project guidance.
