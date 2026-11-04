/**
 * Visual effects for the Attention settings panel — direction A, "Self-Attention",
 * high-contrast revision ("printed plate").
 *
 * The hero is an academic-typeset title over a BertViz-style attention figure
 * (see attention-figure.tsx): a near-white plate in both themes with dark
 * saturated lines — printed-figure contrast, zero glow. The leading word of the
 * title carries the crystal violet; accents use the plugin's crystal palette
 * shared with SparkStar (ice → cyan → violet).
 *
 * Everything is scoped under `.attention-settings-section` and injected as a
 * single <style> element by the settings component, so the plugin stays a
 * self-contained bundle (no external stylesheet to ship).
 *
 * All motion is decorative and fully disabled under
 * `prefers-reduced-motion: reduce`.
 */

export const attentionCss = `
/* ── root: crystal palette + stacking context ───────────────────────────── */
.attention-settings-section {
  position: relative;
  isolation: isolate;
  --att-ice: #e6f9ff;
  --att-cyan: #8fd0ff;
  --att-violet: #8a5ce0;
}

/* ── hero: serif title + citation + attention figure ─────────────────────── */
.attention-hero {
  position: relative;
  margin-bottom: 18px;
  animation: attention-rise .85s cubic-bezier(.2, .85, .25, 1) backwards;
}

.attention-title {
  margin: 0;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Source Serif 4",
    Georgia, "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: .004em;
  line-height: 1.32;
  color: var(--dsw-alias-label-primary, inherit);
}

/* the leading word carries the accent — instant recognition, no gradient */
.attention-title .attention-kw {
  color: var(--att-violet);
}

.attention-citation {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary, currentColor);
}

/* the attention figure: a printed plate in both themes — dark ink on near-white */
.attention-fig {
  margin: 14px 0 0;
  padding: 10px 12px 6px;
  background: #f7f9fc;
  border: 1px solid #c9d2e0;
  border-radius: 9px;
  animation: attention-rise .85s cubic-bezier(.2, .85, .25, 1) .18s backwards;
}

.attention-fig-svg {
  display: block;
  max-width: 100%;
}

.attention-fig-caption {
  margin: 4px 0 0;
  font-size: 9px;
  letter-spacing: .16em;
  text-transform: uppercase;
  text-align: right;
  color: #6b7686;
}

.attention-ln {
  transition: stroke-opacity .7s ease, stroke-width .7s ease;
}

.attention-tok {
  transition: fill .5s ease;
}

/* solid 2px rule — hard stop, no fade to transparent */
.attention-rule {
  display: block;
  height: 2px;
  margin-top: 14px;
  border-radius: 2px;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--att-violet) 0%, var(--att-cyan) 100%);
  animation: attention-draw .95s cubic-bezier(.2, .85, .25, 1) .3s backwards;
}

@keyframes attention-rise {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes attention-draw {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* ── cards: staggered entrance + hover lift ─────────────────────────────── */
.attention-card {
  position: relative;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  animation: attention-rise .5s cubic-bezier(.22, .9, .3, 1) backwards;
}

.attention-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--att-violet) 16%, transparent);
  border-color: color-mix(in srgb, var(--att-violet) 45%, var(--dsw-alias-border-l3)) !important;
}

/* ── ▶ test button: press feedback ──────────────────────────────────────── */
.attention-test-btn {
  transition: transform .15s ease, box-shadow .15s ease;
}

.attention-test-btn:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.08);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--att-violet) 20%, transparent);
}

.attention-test-btn:active:not(:disabled) {
  transform: scale(.94);
}

/* ── meta bar: repo link, installed version, issues, update check ───────── */
.attention-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  margin: 0 0 22px;
}

.attention-meta-id {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.attention-meta-name {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: .01em;
  color: var(--dsw-alias-label-primary, inherit);
}

.attention-meta-version {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 11px;
  letter-spacing: .02em;
  color: var(--att-violet);
}

.attention-meta-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.attention-meta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  transition: color .18s ease, border-color .18s ease, background-color .18s ease,
    transform .15s ease;
}

.attention-meta-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, inherit);
  border-color: color-mix(in srgb, var(--att-violet) 55%, var(--dsw-alias-border-l3));
  background: var(--dsw-alias-interactive-bg-hover, transparent);
  transform: translateY(-1px);
}

.attention-meta-btn:focus-visible {
  outline: 2px solid var(--att-violet);
  outline-offset: 2px;
}

.attention-meta-btn:disabled {
  cursor: progress;
  opacity: .7;
}

.attention-meta-status {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, inherit);
}

.attention-meta-status a {
  color: var(--att-violet);
  font-weight: 600;
  text-decoration: none;
}

.attention-meta-status a:hover {
  text-decoration: underline;
}

.attention-meta-status.is-error {
  color: var(--dsw-alias-label-tertiary, inherit);
}

.attention-meta-spin {
  animation: attention-spin 1s linear infinite;
  transform-origin: center;
}

@keyframes attention-spin {
  to { transform: rotate(360deg); }
}

/* ── accessibility: honour reduced-motion ───────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .attention-hero,
  .attention-fig,
  .attention-rule,
  .attention-card,
  .attention-ln {
    animation: none !important;
    transition: none !important;
  }
  .attention-test-btn { transition: none; }
  .attention-meta-btn { transition: none; }
  .attention-meta-spin { animation: none; }
}
`
