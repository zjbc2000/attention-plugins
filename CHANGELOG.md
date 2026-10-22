# Changelog

All notable changes to this project are documented here.

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
