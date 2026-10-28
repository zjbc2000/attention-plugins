# Changelog

All notable changes to this project are documented here.

## 0.2.1 — 2026-10-26

### Fixed

- **Sidebar mainline star missing for short session titles.** The row→session
  resolver required a title of at least 4 characters, so two-character names
  (天机, 天时) never resolved — and the scan then *removed* their star, which is
  why the badge came and went between sessions. Any title length now resolves,
  and the longest matching title wins so 天机 cannot claim 天机显示's row.
- **Row identity now comes from `data-row-key`.** DSH writes
  `data-row-key="session:<id>"` on every sidebar session row; reading it is
  authoritative and no longer depends on titles being unique or on hashed
  class names (`sessionRow` is only the fallback selector now).
- **Settings → 侧边栏星标** now re-runs the badge scan immediately, so turning
  the star back on no longer waits for an unrelated sidebar mutation.

### Tests

- 105 tests across 7 files; new `session-lookup` cover for row-key parsing,
  two-character titles, prefix collisions, and row text with trailing chrome.

## 0.2.0 — 2026-10-22

### Added

- **Task mode** (`mainlineMode`): switch between `mainline` (default) and `balanced`.
  In balanced mode, when no session is marked, every session is treated as
  main-line and alerts on its own completion/failure.
- **Multiple main-line markers** (`mainlineSessionIds`): mark any number of
  sessions from the composer tool row or the session row "…" menu; every marked
  session keeps a sidebar star and can be unmarked independently.
- Settings migration: legacy single `mainlineSessionId` is converted to a
  one-item `mainlineSessionIds` list on load.

### Changed

- README rewritten around the "task priority / notification noise control"
  positioning, with accurate install, compatibility, event rules and FAQ.
- Package metadata: description, keywords, `engines.dsh`, LICENSE/author
  attribution.

### Tests

- 92 tests across 6 files (`mainline-mode`, `settings-normalize` and others).

## 0.1.2 — 2026-09-26

### Fixed

- Recalibrated notification loudness to system-alert levels (≈ −7~−9 dBFS
  peaks at 70% volume), with attack ramps against clicks and equal-loudness
  compensation for the low-frequency `subtle` sound.
- Hardened `AudioContext` lifecycle: cold-start priming and recreation after
  `devicechange`, so the first alert after a Bluetooth switch is neither
  swallowed nor routed to a dead device.

## 0.1.1 — 2026-09-25

### Added

- Question and failure notifications.
- Attention hero on the settings panel and the official Primogem main-line marker.

## 0.1.0 — 2026-09-22

### Added

- Initial release: completion/failure/question/permission notifications, sound
  effects, side-line batch alerts, main-line markers and the settings panel.
