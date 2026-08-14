# Contributing to Ragify

Thanks for considering a contribution! Ragify is built around a strict interface-driven architecture — most contributions fall into one of two categories: **new adapters** (a new embedder/vector store/LLM/etc.) or **core improvements**.

## Setup

```bash
git clone https://github.com/AmjadKhan88/Ragify.git
cd Ragify
npm install
npm run test:run
```

## Adding a new adapter

1. Implement the relevant interface from `src/types/` (e.g. `Embedder`, `VectorStore`).
2. Use the **lazy dynamic import** pattern for any third-party SDK — see `src/embedders/gemini.ts` for reference. Never statically import an optional SDK at the top of the file.
3. If the SDK is new to the project, add it to `devDependencies` **and** `peerDependencies` (with `peerDependenciesMeta.optional: true`) in `package.json`.
4. Write mocked unit tests in `tests/` — never call real external APIs in the test suite (CI has no API keys configured, by design).
5. Export your new class from `src/index.ts`.
6. Add documentation to `README.md` following the existing pattern for that component type.

## Coding conventions

- TypeScript strict mode — no `any` without a `// eslint-disable-next-line` and a comment explaining why.
- All network-calling code wraps calls in `withRetry()`.
- Constructor options follow the pattern: explicit option → environment variable → hardcoded default (see any existing adapter for the exact pattern).
- Vitest mocks for classes must use `function (this: any) {}`, never arrow functions — arrow functions can't be used as constructors and will fail at `new`.

## Running checks before a PR

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```
All four must pass — CI runs the same checks on Node 20 and 22.

## Commit messages

Loosely follows [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `ci:`.

## Pull requests

- Branch off `main`, never commit directly to it (branch protection enforces this anyway).
- Keep PRs focused — one adapter or one fix per PR is easier to review than a bundle of unrelated changes.
- Link any related issue in the PR description.