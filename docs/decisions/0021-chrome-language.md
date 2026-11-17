# 0021. The SDK's chrome speaks the languages the widget declares

- **Status:** proposed
- **Date:** 2026-11-17

## Context

The catalog's widgets ship in English and French ([ADR 0008](./0008-shared-design-system.md)),
each picking French when the browser prefers it. The SDK's own chrome
(`GristBoundary`'s screens, the alerts, "Report a problem", "The widget
stopped working") was English only, so a French reader saw a French widget
under English alerts. Third-party widgets are mostly English: switching their
chrome to French on a French browser would put a second language next to
theirs.

## Decision

- **The declaration says which languages the widget is written in:**
  `defineGristWidget({ languages: ["en", "fr"] })`, language tags, the first
  one its fallback. Without it, `["en"]`.
- **The chrome speaks the first of the person's browser languages that the
  widget declares and the SDK speaks** (English and French today); otherwise
  the widget's first language the SDK speaks; otherwise English. A widget
  that declares no French never gets French chrome.
- **The French quotes Grist's French interface** where it names Grist's
  labels ("Accès complet au document", "vue personnalisée"), from Grist's
  own locale files (grist-static 0.1.6), so the person finds what the
  message says.
- **The words live in one file,** `packages/core/src/sdk/chrome-messages.ts`,
  every language with the same keys (a test checks it). A new language is a
  new dictionary there, and a new entry in `CHROME_LOCALES`.
- **What stays English:** error strings on `useGrist()` (`w.error`,
  `w.actionError`) are values a widget may log or compare, and the
  outside-Grist pages (local dev, release) are for the widget's developer.

## Consequences

- Every language ships in every widget's bundle (about 1.5 KB gzipped for
  French): the size budget reads 97.9 KB of 100 KB after it. A third
  language would need the budget looked at, or dictionaries loaded apart.
- The catalog widgets declare `languages: ["en", "fr"]` in the release after
  the SDK's, so their chrome matches their messages.
- `renderWithGrist` passes the declaration's languages to the chrome, so a
  test can check the French screens with the browser's languages mocked.
