# ADR 0002: Web framework (React vs Next.js)

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** the 3 group members
- **Ticket:** #7 (Benchmark web)
- **Subject refs:** 03-A (Accessibilité), 03-C (Décisions)

## Context

EPIck'em needs a web app with:

- public pages per tournament (brackets, rankings, schedule, participants)
- a bracket view usable with keyboard only, with an equivalent table view
- live updates (results, rankings) and a fullscreen dashboard for LAN rooms
- WCAG 2.2 AA, checked by axe in the CI
- a free-tier deployment, updated on each merge to main

The backend is decided in a separate ADR (NestJS + PostgreSQL). The web app is a client of that API. The question is whether a full-stack framework brings enough on top of a separate backend, and whether the extra options it offers fit a product with very different kinds of pages (public pages, live dashboard, authenticated areas, admin screens).

## Options

| # | Option | Short description |
|---|---|---|
| A | React (Vite SPA) | React + Vite + React Router, client-side rendering, static build |
| B | Next.js | React framework with SSR/SSG/ISR, file routing, server components, route handlers, middleware |

Other frameworks (Vue, Svelte, Angular) are out of scope: the team works with React and the benchmark is limited to 2 days.

## Decision criteria

Each criterion is scored from 1 (bad) to 5 (very good). The total is the weighted sum.

| Criterion | What we check | Weight |
|---|---|---|
| Accessibility | Semantic HTML, keyboard handling, focus management on route change, a11y tooling | 25 % |
| Rendering | SSR vs SPA, public tournament pages, first load | 20 % |
| Flexibility | Choice of rendering mode per page, server-side layer (route handlers, middleware), built-in optimizations, room to grow without adding libraries | 20 % |
| Realtime and dashboard | SSE/WebSocket integration, live updates without flooding screen readers, fullscreen dashboard | 15 % |
| Dev experience | Setup time, learning curve, test tools (unit, component, e2e) | 10 % |
| Build and deploy | Free-tier hosting, CI build, env variables and secrets, pipeline simplicity | 10 % |

Flexibility was added as a criterion because the app mixes very different page types, and this is where the two options differ most.

## Benchmark grid

Scores are an assessment from each option's documented features and the team's React experience, not from measured runs.

| Criterion | Weight | A: React (Vite) | Observations A | B: Next.js | Observations B |
|---|---|---|---|---|---|
| Accessibility | 25 % | 3/5 | Semantic HTML and jsx-a11y linting are available, but focus and title handling on route change must be written by us | 4/5 | Built-in route announcer and a11y lint rules in the default ESLint config; same component rules otherwise |
| Rendering | 20 % | 3/5 | Client-side rendering only; no server-rendered public pages | 5/5 | SSR, SSG and ISR; public tournament pages are fast on first load and readable without JS |
| Flexibility | 20 % | 3/5 | One rendering mode; every extra need (SSR, proxy, auth middleware, image handling) means adding and wiring a library | 5/5 | Rendering mode chosen per page; route handlers and middleware give a server layer; image, font and metadata handling built in |
| Realtime and dashboard | 15 % | 5/5 | SSE/WebSocket client lives entirely in the browser; fullscreen dashboard is a plain client page | 3/5 | Live parts must be client components; mixing server and client rendering adds complexity |
| Dev experience | 10 % | 5/5 | Minimal setup, very fast dev server, few concepts | 3/5 | More concepts (server vs client components, caching, rendering modes) to learn for a 3-person team |
| Build and deploy | 10 % | 5/5 | Static build, deployable on any free static host | 4/5 | Free tier on the framework's own host; elsewhere it needs a Node runtime |
| **Weighted total** | 100 % | **3.70/5** | | **4.15/5** | |

Calculation: A = 3×0.25 + 3×0.20 + 3×0.20 + 5×0.15 + 5×0.10 + 5×0.10 = 3.70. B = 4×0.25 + 5×0.20 + 5×0.20 + 3×0.15 + 3×0.10 + 4×0.10 = 4.15.

## Decision

We choose **B: Next.js**.

- **More options to build with.** Each kind of page can use the mode that fits: static or incremental rendering for public tournament pages, server rendering for pages that depend on the user, client-side rendering for the live dashboard and the prediction screens.
- **A server layer when needed.** Route handlers and middleware allow light work next to the pages (forwarding the session cookie, protecting admin routes, caching start.gg-derived data, proxying the API) without adding another service.
- **Public pages come for free.** Tournament pages, rankings and schedules render on the server, load fast and stay readable without JavaScript, which helps accessibility.
- **Less setup for common needs.** Routing, image and font optimization, metadata and an accessible route announcer are included instead of assembled from separate libraries.
- **Same React base.** Components, hooks and tests stay standard React, so the learning cost is limited to the framework concepts.

## Consequences

**Positive**

- Per-page choice of rendering mode, so each screen can be optimized for what it does.
- Public pages are server-rendered and fast, with better accessibility by default.
- Room to grow (new pages, caching, protected routes) without changing tools.

**Negative / accepted trade-offs**

- More concepts to learn (server vs client components, caching, rendering modes), a real cost for a 3-person team on a short schedule.
- Hosting needs a Node runtime or the framework's own host, which constrains the continuous deployment choice.
- Live data needs client components, so the live parts of a page are separated from the server-rendered parts.

**Rules**

- Business logic, permissions and data stay in NestJS. The Next.js server layer is limited to rendering, session forwarding, middleware and light proxying. Rules from the subject (prediction locking, audit log, recalculation) are never implemented in the web app.
- Public pages use static or incremental rendering with revalidation. The live dashboard and prediction screens are client components fed by SSE or WebSocket.
- Accessibility: skip link, visible focus, one polite `aria-live` region for live updates throttled so screen readers are not flooded, and the table view alternative for every bracket.
- `eslint-plugin-jsx-a11y` in the lint step and axe in the CI (ticket 18).

**Impact on the rest of the project**

- Structure: web app in `apps/web` of the monorepo.
- Tests: Jest and React Testing Library for components, Playwright with axe for end-to-end and accessibility.
- Hosting: a free tier that supports Next.js, chosen in the continuous deployment ticket.

**When to revisit**

If the server layer starts duplicating NestJS responsibilities, or if the hosting limits get in the way, reduce Next.js to mostly client rendering or move to a Vite SPA. Components stay React, so the migration cost is limited to routing and the build.

## Alternatives rejected

- **A: React (Vite SPA):** simpler and better for live client-side screens (3.70 vs 4.15), but it offers one rendering mode and no server layer, so every additional need would require extra libraries.
- **Other frameworks (Vue, Svelte, Angular):** not benchmarked, because of the team's React experience and the 2-day limit.

## References

- Subject: sections 03-A and 03-C
- Related ADRs: global stack (backend, realtime), mobile benchmark
