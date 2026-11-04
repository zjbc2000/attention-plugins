# Changelog

All notable changes to this project are documented here.

## 0.2.2 — 2026-11-04

### Added

- **Settings meta bar.** The Attention section now carries the plugin name and
  the installed version, one-tap links to the GitHub repository and the issue
  tracker, and a **Check for updates** button. The check reads the published
  version from the public npm registry only when pressed; an available update
  links to the latest release, and offline/registry failures are reported
  inline instead of hanging.
- The version shown in the panel is injected from `package.json` at build time,
  so it always matches the shipped bundle.

- **Three-way task mode replaces two settings.** `mainlineMode` now covers every
  case on its own: `mainline` (marked sessions ring on completion, everything
  else is pooled into one "All tasks" chime), `balanced` (every session rings),
  `silent` (no completion sound or notification at all — no aggregate either;
  questions and permission requests still alert). The separate `sidelineMode`
  setting is removed; old configs migrate (`per-session → balanced`,
  `batch → mainline`).
- **Three current-session tiers.** The `notifyCurrent` boolean became
  `currentSessionMode` (`hidden` / `unfocused` / `always`); old configs migrate
  (`true → always`, `false → hidden`). `unfocused` also honours window focus, so
  split-screen users are not silently muted.
- **Wait for subagents.** When a parent session finishes while its subagents
  still run, the alert is deferred and delivered once the whole wave is idle
  (failures included). Detection uses `parentSessionId` + `running`.
- **Per-event notification tags.** Each event type and session now gets its own
  notification tag with `renotify`, so a question or permission request no
  longer replaces a completed alert. Questions and permission requests use
  `requireInteraction`.
- **Click to open the session.** Notifications now focus the window and open the
  matching session through the `uiWorkspace` service (resolved lazily, so older
  DSH builds keep activating).
- **Per-session mute** from the session row "…" menu, persisted in
  `mutedSessionIds`.
- **Custom audio per event type.** Upload an MP3 / OGG / WAV clip (≤ 512 KB),
  stored as a data URL in the browser's local storage for that event type; it
  plays even when the built-in sound is set to `none`.

### Changed

- Settings panel: the three italic 💡 hint paragraphs are gone, and the
  side-line radio group is removed (its two choices are now what `mainline`
  and `balanced` mean). The task-mode descriptions state the rule directly.
- npm tarball no longer ships `docs/images` (1.9 MB → 164 KB); the screenshots
  stay in the repository and render from GitHub on the package page.

### Fixed

- Notifications for different events no longer overwrite each other.
- The aggregate "All tasks" alert fires exactly once per wave: a completion
  that settles after the all-idle edge no longer rings it a second time.

- **`scripts/shots.mjs`**: a dependency-free Chrome DevTools Protocol driver
  (`launch` an isolated DSH + headless Chrome, then `eval` / `click` / `shot`),
  so README screenshots can be regenerated from the real UI without Playwright.
  See `docs/SHOTS.md`.

### Tests

- 181 tests across 12 files (up from 105 tests / 7 files in 0.2.1).

### Docs

- README: added a quick start, a three-row comparison table, and a first-screen
  FAQ (no sound / browser permission / batch-mode failures); moved the Star ask
  under the install command; corrected the English tarball link to v0.2.1, the
  roadmap state, and the test counts; alignment of the Chinese and English
  sections.
- Corrected the credits: the upstream project is BSD-3-Clause, not MIT. Added
  `THIRD-PARTY-NOTICES.md` with the retained notice.
- Added `docs/METRICS.md`, `docs/COMPATIBILITY.md`, `docs/MARKET-LISTING.md`,
  `scripts/smoke-install.sh` (clean-profile install smoke), issue forms, and an
  icon.
- `scripts/smoke-install.sh --pkg` now also accepts a local `npm pack` tarball
  or a directory (registry probe is skipped for local paths).

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
