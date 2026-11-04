# ADR 0003: Mobile platform and framework

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** the 3 group members
- **Ticket:** #2 (Benchmark mobile)
- **Subject refs:** 02-B (profiles), 02-I (mobile app), 03-A (accessibility), 03-B (CI/CD), 03-C (decisions)

## Context

Which platform and framework should EPIck'em use for its mobile app?

The app is a companion to the web platform: live tournaments, predictions,
Pick'em answers and rankings. It must be accessible (TalkBack, dynamic type,
48 dp targets), receive notifications and produce an installable APK from CI.
The deciding constraint is the team: three people, one semester and several
other deliverables, so ramp-up and maintenance matter more than raw
performance. Web and API already use React and TypeScript.

## Platform

**Android only.** iOS builds and simulators need macOS/Xcode, which the team
does not have; an Android APK installs directly from a CI artifact and runs on
the Windows emulator. The subject allows one target platform, so iOS is out of
scope. React Native and Flutter keep an iOS path open later; native Kotlin
would not.

## Options

| # | Option | Short description |
| --- | --- | --- |
| A | React Native + Expo (TypeScript) | React components rendered with native views; Expo provides the build toolchain, notifications, secure storage and file-based routing. |
| B | Flutter (Dart) | Compiled cross-platform UI toolkit with its own widget system, testing tools and build CLI. |
| C | Kotlin + Jetpack Compose (native Android) | Official Android stack, native views, Gradle build, full platform access. |

For React Native, **Expo is part of option A**, not a separate variant. Expo's
Continuous Native Generation (`npx expo prebuild`) generates the Android
project on demand and keeps it out of git; this avoids maintaining native
files while still allowing native modules and a local Gradle build.

## Decision criteria

Each criterion is scored from 1 (bad) to 5 (very good). The total is the
weighted sum.

| Criterion | What we check | Weight |
| --- | --- | --- |
| Accessibility | TalkBack, dynamic text size, 48 dp targets, focus order, accessibility testing tools | 25 % |
| Notifications and realtime | Push notifications, WebSocket/SSE, background and foreground updates | 20 % |
| UI and logic test tools | Unit tests, component/UI tests, end-to-end tests, CI friendliness | 15 % |
| Dev experience and integration | Language and team fit, setup time, emulator workflow, monorepo integration, shared types | 20 % |
| APK build and CI | One-command build, APK artifact, build time, signing, CI setup | 10 % |
| Runtime and native UX | Large lists, animations, input latency, native look and feel | 10 % |

Accessibility carries the highest weight because it is a mandatory quality
requirement with its own audit. Dev experience is second because the mobile
app must ship alongside the other deliverables.

## Benchmark grid

Scores come from each option's documentation and the team's experience. The
build figures were checked against a local build of A and B (see
[Measured validation](#measured-validation)); accessibility, testing and
runtime remain documentation-based.

| Criterion | Weight | A: React Native + Expo | Observations A | B: Flutter | Observations B | C: Kotlin + Compose | Observations C |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accessibility | 25 % | 4/5 | Explicit `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, `accessibilityLiveRegion`; `allowFontScaling` is on by default; TalkBack works. Focus order and custom components need manual work. | 4/5 | `Semantics`, `textScaler`, TalkBack support and built-in accessibility guideline tests; custom widgets still need labels and traversal work. | 5/5 | Native semantics, `sp`/`dp` units, TalkBack, Android accessibility testing and platform fidelity. |
| Notifications and realtime | 20 % | 5/5 | `expo-notifications` plus the Expo Push Service (FCM on Android); WebSocket is built into the runtime. SSE needs a small polyfill. | 4/5 | FCM through `firebase_messaging`; WebSocket available; SSE through a package. Firebase project setup required. | 4/5 | Native FCM and OkHttp WebSocket/SSE; reliable but the most boilerplate and Google-services setup. |
| UI and logic test tools | 15 % | 4/5 | Jest and React Native Testing Library for logic/components; Maestro or Detox for E2E. Native-module mocking can be fiddly. | 5/5 | `flutter_test`, widget tests, `integration_test` and Patrol; fast and well integrated. | 4/5 | JUnit, Compose UI tests and Espresso; solid but instrumentation tests are slower. |
| Dev experience and integration | 20 % | 5/5 | TypeScript and React already used by the team; `apps/mobile` fits the npm workspace; API types and validation can be shared; Expo CLI and fast refresh; Android Studio only needed for native builds. | 3/5 | Excellent tooling and hot reload, but Dart is new to the team and Flutter is a second ecosystem with its own CI and dependency manager. No code sharing with the web app. | 2/5 | Kotlin, Compose and Gradle are all new; slowest ramp-up; Android-only and no reuse with the web app. |
| APK build and CI | 10 % | 3/5 | `expo prebuild` then Gradle works, but adds a generation step and a heavy first build. EAS Build is easier but adds a cloud account and quotas. | 4/5 | `flutter build apk` is one command; GitHub Actions support is straightforward; release signing needs a keystore. | 4/5 | Standard `./gradlew assembleDebug`; well supported in CI; Android SDK setup is required. |
| Runtime and native UX | 10 % | 4/5 | Hermes and the New Architecture handle lists and transitions well; complex gestures or charts may need native libraries. Sufficient for this app's screens. | 5/5 | Compiled UI, Impeller, smooth animations and consistent rendering. | 5/5 | Native performance and the best platform integration. |
| **Weighted total** | 100 % | **4.30/5** | | **4.05/5** | | **3.95/5** | |

Calculation:

- A = 4×0.25 + 5×0.20 + 4×0.15 + 5×0.20 + 3×0.10 + 4×0.10 = **4.30**
- B = 4×0.25 + 4×0.20 + 5×0.15 + 3×0.20 + 4×0.10 + 5×0.10 = **4.05**
- C = 5×0.25 + 4×0.20 + 4×0.15 + 2×0.20 + 4×0.10 + 5×0.10 = **3.95**

## Decision

We choose **A: React Native + Expo, Android only, in TypeScript**.

- **Team fit is the deciding factor.** The team already writes React and
  TypeScript. React Native removes a new language and a new mental model from
  a schedule that also includes the web app, the API, realtime, the simulator
  and the start.gg connector.
- **Monorepo integration.** The mobile app becomes `apps/mobile` in the
  existing npm workspace. API types, validation schemas and small utilities
  can be shared; Expo Router gives the same file-based routing model as
  Next.js.
- **Notifications and realtime are the simplest here.** Expo Notifications
  covers push, and WebSocket is available without a plugin. This matters
  because prediction locking and live results are the core of the product.
- **Accessibility is good enough and testable.** React Native exposes the
  native accessibility tree and the properties needed for TalkBack, dynamic
  type and live regions. The 1-point gap with native Kotlin is a discipline
  cost (labels, focus order, touch targets), not a blocker.
- **Flutter is the stronger pure mobile toolkit**, especially for tests and
  rendering, and its build path is faster (3 min 7 s versus 6 min 42 s to a
  first debug APK). But it costs a new language and a second ecosystem for a
  supporting deliverable. The 0.25-point difference does not justify that
  cost for this team.
- **Native Kotlin wins accessibility and runtime**, but it is the slowest
  option to ramp up and locks the product to Android. Its advantage does not
  offset the lost time on the rest of the project.

Important clarification: React Native does **not** reuse the Next.js UI.
The web app is DOM + Tailwind; the mobile screens are rewritten with React
Native primitives and `StyleSheet`. What is shared is the language, the
component model, the API types and the business rules that live outside the
UI. Budget the mobile screens as new work, not as a port.

## Consequences

**Positive**

- One language (TypeScript) across web, API and mobile; one package manager
  and one lockfile.
- Expo handles the native project generation, notifications, secure storage,
  app icons and deep links; the team does not maintain `android/` by hand.
- A local Gradle build can produce the APK in CI without depending on a paid
  cloud build service.
- The iOS door stays open: adding iOS later is a build and QA effort, not a
  rewrite.

**Negative / accepted trade-offs**

- React Native is not the best option for heavy animation or raw rendering
  performance. The app shows lists, brackets and forms, not a game, so this
  is acceptable; use native-driver animations and a virtualised list.
- The accessibility tree is less automatic than Compose. Every interactive
  component needs a role, a label and a state; this must be part of the
  definition of done, not a late audit.
- Expo's build path has more moving parts than Flutter's: prebuild, Gradle,
  Android SDK, and a development build for native modules. The CI ticket must
  budget time for the first successful APK: 6 min 42 s cold here, less with
  caches.
- Expo Go is convenient for early UI work but cannot exercise remote push or
  other native modules; use a development build for anything that matters.
- React Native's SSE support is not native. Prefer WebSocket for mobile
  realtime, or add a small SSE polyfill if the backend chooses SSE.

**Rules**

- **Android only.** The validation build used `minSdk` 24, `targetSdk` 36 and
  `compileSdk` 37 (Expo SDK 58; defaults may move with later SDKs). No iOS
  project is generated or tested.
- **Expo with Continuous Native Generation.** `android/` and `ios/` stay out
  of git. Native changes go through config plugins, never through edits to
  generated files.
- **TypeScript strict**, Expo Router for navigation, TanStack Query for server
  state, `expo-secure-store` for tokens. No secret is embedded in the app.
- **No WebView for product screens.** React Native already renders native
  views; `react-native-webview` is reserved for explicitly external content
  and never for the app shell.
- **Accessibility is part of the definition of done:** 48 dp touch targets,
  dynamic type without clipping, TalkBack labels and roles, logical focus
  order, reduced-motion support, contrast at least 4.5:1, and a non-colour
  indicator for win/loss/correct prediction.
- **Tests:** Jest + React Native Testing Library for logic and components;
  Maestro for the critical E2E flows (open a tournament, submit a prediction,
  view a ranking). The APK build is not a substitute for tests.
- **CI:** lint, typecheck and Jest on every pull request; on `main`, also
  `expo prebuild --platform android` then `./gradlew assembleDebug` and upload
  the APK as an artifact. A debug APK is acceptable for the demo; release
  signing is configured later through GitHub secrets, never committed.
- **Realtime:** the mobile client uses WebSocket. The backend must expose a
  WebSocket gateway for live match and ranking updates, or provide an SSE
  endpoint plus a tested polyfill. This is a constraint on the realtime
  ticket, not a decision made here.

**Impact on the rest of the project**

- New workspace `apps/mobile` (Expo, TypeScript), included by the existing
  `apps/*` workspace glob.
- New CI job for the mobile build, with Android SDK and Gradle caches.
- New backend needs: push-token registration, notification preferences, and
  an APK-friendly realtime transport.
- Shared API types: start by importing types from a small shared package
  when the API contract stabilises; do not block the first screen on it.
- Documentation: the mobile run guide, emulator setup and APK installation
  belong in the README and the technical docs.

**When to revisit**

Revisit if the first real screens show that React Native cannot meet the
accessibility audit (TalkBack focus, dynamic type) without disproportionate
work, or if the APK build in CI stays unreliable after a reasonable attempt.
In that case, Flutter is the fallback: it keeps the Android-only target and
offers stronger testing and rendering, at the cost of a Dart ramp-up.
Native Kotlin remains the reference for accessibility if the app becomes
the main product rather than a companion.

## Measured validation

A blank project for options A and B was built on the team's Windows machine
to check the scores that are easiest to get wrong: setup and APK production.
Both used the installed JDK 17 and Android SDK (JDK 17.0.20, build-tools
37.0.0; Expo SDK 58.0.22 / React Native 0.88.1, Flutter 3.47.9).

| Step | A: React Native + Expo | B: Flutter |
| --- | --- | --- |
| Scaffold | `create-expo-app` (Expo SDK 58, RN 0.88, TS 6): 35 s | `flutter create` (Flutter 3.47): 9 s |
| Generate native project | `expo prebuild --platform android`: 238 s | not needed |
| First debug APK | `./gradlew assembleDebug`: 129 s | `flutter build apk --debug`: 178 s |
| Total to first APK | **6 min 42 s** | **3 min 7 s** |
| Debug APK size | 136.9 MiB (4 ABIs) | 143.6 MiB (3 ABIs) |

What the numbers say:

- Flutter's build path is simpler: no generated-project step, and its first
  APK arrived in about half the time. This supports the 4/5 versus 3/5 on
  APK build and CI.
- Once the Android project exists, the Gradle builds are closer than the
  totals suggest (129 s versus 178 s), and Flutter's first run also downloaded
  NDK 28 and platform 36. Expo's prebuild step, not Gradle, is the real
  overhead.
- APK size is not a differentiator: both debug APKs are about 140 MiB because
  they include every ABI and development support. A release build per ABI is
  much smaller, so size was not scored.
- Expo's extra step is one-time and cacheable, but it is still a moving part
  that Flutter does not have. This is already in the consequences above.

Limits:

- Single cold run on one Windows machine, not a controlled benchmark. The
  machine was installing Android SDK components for the first time, so not
  every download falls inside the measured window; the Flutter run also shared
  the machine with a booting emulator. Treat the times as orders of magnitude,
  not precise figures.
- TalkBack, dynamic type, UI tests, notifications and runtime performance were
  not measured: they need real screens and a device, not a blank template.
  Their scores remain documentation-based.
- Toolchain installation is not in the table. The Flutter SDK (1.8 GB) was
  downloaded and extracted for this check, in the same way Node and Android
  Studio are assumed for A.
- No validation build was made for C (Kotlin + Compose); its scores remain
  entirely documentation-based.

If the team later needs measured accessibility evidence, build the same three
screens in both frameworks (tournament list, prediction form, ranking list) and
run TalkBack plus a 200 % font-size pass. Switch only if React Native fails
accessibility or the CI build stays unreliable, not on small timing
differences.

## Alternatives rejected

- **B: Flutter:** stronger testing and rendering (4.05 vs 4.30), but a new
  language, a second ecosystem and no reuse with the TypeScript monorepo.
- **C: Kotlin + Jetpack Compose:** best accessibility and native performance
  (3.95), but the slowest ramp-up and an Android-only dead end for a
  supporting deliverable.
- **Ionic / Capacitor / Cordova / PWA:** forbidden by the subject (wrapped
  website).
- **Kotlin Multiplatform / .NET MAUI:** allowed but outside the team's
  experience and the benchmark's time box.

## References

- Subject: sections 02-B, 02-I, 03-A, 03-B, 03-C.
- Related ADR: `docs/0002-web-framework.md` (web framework, Next.js).
- React Native accessibility: https://reactnative.dev/docs/accessibility
- React Native testing: https://reactnative.dev/docs/testing-overview
- Expo Continuous Native Generation:
  https://docs.expo.dev/workflow/continuous-native-generation/
- Expo APK builds: https://docs.expo.dev/build-reference/apk/
- Expo notifications: https://docs.expo.dev/push-notifications/overview/
- Flutter accessibility: https://docs.flutter.dev/ui/accessibility
- Flutter Android build: https://docs.flutter.dev/deployment/android
- Flutter testing: https://docs.flutter.dev/testing/overview
- Android Compose accessibility:
  https://developer.android.com/develop/ui/compose/accessibility
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- RGAA: https://accessibilite.numerique.gouv.fr/
