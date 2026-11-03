# ADR 0001: Global technical stack

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** the 3 group members
- **Ticket:** #10 (ADR de la stack globale)
- **Subject refs:** 03-C (Décisions), 01-B (stack libre, à justifier)

## Context

EPIck'em is a tournament and live-prediction platform: web app, Android app, API with real-time updates, tournament engine, simulator, and CI/CD with an online environment. The subject leaves the stack free but asks for it to be justified, and requires a new contributor to run everything in under 15 minutes.

Main constraints:

- 3 developers, about 3 months, with accessibility (WCAG 2.2 AA), tests and documentation counting as much as features.
- A tournament engine and a prediction engine with heavy logic (brackets, tiebreaks, cascade recalculation) that must be unit tested.
- Real-time updates for results and rankings, with a load test of thousands of spectators.
- A mobile app that must be native or cross-platform, never a web wrapper.

The main driver of the stack is **one language, TypeScript, across the whole project**: API, web, mobile and the tournament engine. Types, validation rules and the engine package can be shared, and any member can work on any part.

## Summary

| Area | Choice |
|---|---|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Web | Next.js (see ADR 0002), Tailwind CSS, shadcn/ui |
| Mobile | React Native, Android only |
| Real time | Server-Sent Events (SSE) |
| Monorepo | pnpm workspaces |
| Tests | Jest, React Testing Library, Playwright with axe |
| Deployment | Docker, Docker Compose, GitHub Actions |

## Decisions

### 1. Backend: NestJS

- **Context:** a structured API with auth, roles, validation, real time and a clear module layout that three people can share.
- **Options:** NestJS, Go, Express or Fastify.
- **Choice:** NestJS with TypeScript.
- **Why:** modules, dependency injection and guards give a clear structure for roles and permissions checked server-side. TypeScript allows sharing types and the pure tournament engine package with web and mobile. Built-in support for validation, testing (Jest, Supertest) and SSE.
- **Rejected:** Go is fast and simple to deploy but breaks the one-language principle and the engine could not be shared with the clients. Express or Fastify alone would require us to define our own structure and conventions.
- **Consequences:** heavier framework with more boilerplate, to be cleaned at setup (ticket 13).

### 2. Database: PostgreSQL

- **Context:** strongly relational data (tournaments, stages, matches, rounds, teams, predictions, rankings) with consistency needs during cascade recalculation.
- **Options:** PostgreSQL, MySQL, MongoDB.
- **Choice:** PostgreSQL.
- **Why:** transactions, constraints and joins fit brackets, rankings and recalculation. JSON columns cover flexible data such as custom registration fields and game statistics. Free to run in Docker and on free tiers.
- **Rejected:** MongoDB makes relations and transactional recalculation harder. MySQL would work but gives nothing more for this project.
- **Consequences:** schema changes go through migrations. The data model is described in the data model ticket (9).

### 3. ORM: Prisma

- **Context:** typed access to the database, migrations that work from a fresh clone.
- **Options:** Prisma, TypeORM, Drizzle.
- **Choice:** Prisma.
- **Why:** the schema file is readable and can be documented, the client is fully typed, migrations are built in and easy to run in Docker and CI. Good fit for a team that must onboard quickly.
- **Rejected:** TypeORM has weaker typing and decorator-heavy models. Drizzle is closer to SQL but has a smaller ecosystem and less documentation for Nest.
- **Consequences:** complex ranking queries may need raw SQL (`$queryRaw`). Cascade recalculation must run inside explicit transactions. The Prisma schema becomes a source for the data dictionary.

### 4. Web: Next.js, Tailwind CSS, shadcn/ui

- **Context:** public pages, live dashboard, authenticated areas, accessibility as a requirement.
- **Choice:** Next.js with Tailwind CSS and shadcn/ui. The framework choice is detailed in ADR 0002.
- **Why Tailwind:** fast to style, design tokens in one config, so the palette from the charter (ticket 11) with its 4.5:1 contrast can be applied everywhere.
- **Why shadcn/ui:** components are built on Radix primitives, which handle keyboard and ARIA behavior, and the code is copied into the repo so we own and can fix it. Custom components (brackets, live rankings) stay our own.
- **Rejected:** a ready-made component library with its own theming (heavier, harder to control accessibility). Writing every component from scratch (too slow for the schedule).
- **Consequences:** shadcn/ui components are a base, not a guarantee. Every component still goes through keyboard checks and axe.

### 5. Mobile: React Native, Android only

- **Context:** the subject requires a native or cross-platform app, a single target platform, and bans web wrappers (PWA, WebView, Capacitor).
- **Options:** React Native, Flutter.
- **Choice:** React Native, targeting Android. The detailed comparison and the Expo or bare workflow choice belong to the mobile benchmark (ADR 0003).
- **Why:** same language and React knowledge as the web and API, shared types and engine package, native components with TalkBack support. Android makes the CI artifact (an APK) straightforward and the emulator is easy to document.
- **Rejected:** Flutter would require a new language (Dart) and no code sharing with the rest of the project.
- **Consequences:** iOS is out of scope. React Native with a pnpm monorepo often needs a specific linker configuration, to be handled in the monorepo and mobile tickets.

### 6. Real time: Server-Sent Events

- **Context:** results, rankings and Pick'em resolution must reach thousands of spectators. Traffic is mostly server to client. Predictions are submitted as normal requests.
- **Options:** SSE, WebSocket.
- **Choice:** SSE.
- **Why:** one-way streams over plain HTTP, automatic reconnection, simple to test and to deploy behind proxies, supported by NestJS. It covers the live dashboard, bracket updates and ranking updates.
- **Rejected:** WebSocket is more flexible (two-way) but adds connection handling and complexity that the project does not need. Predictions use the REST API, which also keeps the server clock as the only authority for locking.
- **Consequences:** if a feature needs real two-way live interaction (for example a live chat bonus), revisit. If the API runs on several instances, events must be shared through a broker (for example Redis), documented when the load test shows the need.

### 7. Monorepo: pnpm workspaces

- **Context:** web, API, mobile, engine package and simulator in one repo with a single install and root commands.
- **Options:** pnpm workspaces, npm workspaces, Turborepo, Nx.
- **Choice:** pnpm workspaces. Turborepo can be added later for caching if the CI becomes slow.
- **Why:** fast, strict dependency handling, lockfile, simple setup that fits the 15-minute contributor test.
- **Rejected:** Nx is heavy for a 3-person project. Turborepo is an optimization we do not need at the start. npm workspaces work but are slower and less strict.
- **Consequences:** root commands `lint` and `test` run all workspaces (ticket 12). Structure: `apps/web`, `apps/api`, `apps/mobile`, `packages/tournament-engine`.

### 8. Tests: Jest, React Testing Library, Playwright with axe

- **Context:** the subject lists the logic that must be tested (brackets, Swiss pairing, FFA, tiebreaks, locking, scoring, resolution, cascade recalculation, start.gg connector with mocks) plus mobile tests.
- **Choice:**
  - Jest for the API, the engine package, the web app and the mobile app (the default of NestJS and React Native, one tool everywhere)
  - Supertest for API tests
  - React Testing Library for web and mobile components
  - Playwright with axe for end-to-end and accessibility checks on the web
- **Rejected:** Vitest (fast, but not the default for Nest or React Native, so it would add a second tool). Cypress (slower than Playwright for our needs).
- **Consequences:** a single command runs all tests. start.gg calls are mocked, so tests pass offline.

### 9. Deployment: Docker and GitHub Actions

- **Context:** one-command installation, automatic checks on each pull request, automatic deployment on merge, secrets outside the code.
- **Choice:** Docker and Docker Compose for local and online environments, GitHub Actions for CI and CD.
- **Why:** Docker Compose gives the contributor one command to start the API and database. GitHub Actions is required by the subject (or equivalent), integrates with branch protection and secrets, and can build the Android APK as an artifact.
- **Rejected:** a hosting platform's own build system alone (does not cover lint, tests and the APK).
- **Consequences:** the free hosting tier is chosen in the continuous deployment ticket (16), with the Next.js Node runtime in mind.

## Related decisions

- ADR 0002: web framework (Next.js)
- ADR 0003: mobile framework (React Native vs Flutter, Expo or bare)

## When to revisit

- The mobile benchmark rejects React Native: update decision 5 and decision 8.
- Load tests show SSE or a single instance is not enough: update decision 6.
- Raw SQL or recalculation performance becomes a problem with Prisma: reconsider decision 3.
