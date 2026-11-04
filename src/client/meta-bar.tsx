/**
 * Meta bar for the Attention settings panel: repository link, installed
 * version, issue tracker and an on-demand update check against npm.
 *
 * Deliberately quiet: it inherits the panel's typography and only borrows the
 * crystal-violet accent for the version and the "update available" link, so it
 * reads as panel chrome rather than a second hero.
 */
import React, { useCallback, useState } from 'react'
import type { locales } from './locales.js'
import {
  GITHUB_REPO_URL,
  ISSUES_URL,
  PLUGIN_VERSION,
  RELEASES_URL,
  fetchLatestVersion,
  isNewerVersion,
} from './version.js'

type Translate = (key: keyof typeof locales['en']) => string

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'outdated'; latest: string }
  | { kind: 'error' }

export function PluginMetaBar({ t }: { t: Translate }) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' })

  const checkForUpdates = useCallback(async () => {
    setState({ kind: 'checking' })
    try {
      const latest = await fetchLatestVersion()
      setState(
        isNewerVersion(latest, PLUGIN_VERSION)
          ? { kind: 'outdated', latest }
          : { kind: 'current' },
      )
    } catch (err) {
      console.warn('[attention-plugins] update check failed:', err)
      setState({ kind: 'error' })
    }
  }, [])

  const checking = state.kind === 'checking'

  return (
    <div className="attention-meta">
      <div className="attention-meta-id">
        <span className="attention-meta-name">attention-plugins</span>
        <span className="attention-meta-version" title={t('settings.meta.versionTitle')}>
          v{PLUGIN_VERSION}
        </span>
      </div>

      <div className="attention-meta-actions">
        <a
          className="attention-meta-btn"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          <GithubIcon />
          <span>{t('settings.meta.github')}</span>
        </a>
        <a
          className="attention-meta-btn"
          href={ISSUES_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          <FeedbackIcon />
          <span>{t('settings.meta.issues')}</span>
        </a>
        <button
          type="button"
          className="attention-meta-btn"
          onClick={checkForUpdates}
          disabled={checking}
          aria-busy={checking}
        >
          <RefreshIcon spinning={checking} />
          <span>{checking ? t('settings.meta.checking') : t('settings.meta.check')}</span>
        </button>
      </div>

      {state.kind === 'current' && (
        <p className="attention-meta-status">{t('settings.meta.upToDate')}</p>
      )}
      {state.kind === 'outdated' && (
        <p className="attention-meta-status">
          <a href={RELEASES_URL} target="_blank" rel="noreferrer noopener">
            {t('settings.meta.updateAvailable').replace('{version}', state.latest)}
          </a>
        </p>
      )}
      {state.kind === 'error' && (
        <p className="attention-meta-status is-error">{t('settings.meta.checkFailed')}</p>
      )}
    </div>
  )
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  )
}

function FeedbackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4l-8.5 8.5" />
      <path d="M10 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={spinning ? 'attention-meta-glyph attention-meta-spin' : 'attention-meta-glyph'}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V10H14" />
    </svg>
  )
}
