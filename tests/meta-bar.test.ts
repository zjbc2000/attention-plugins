/**
 * Render-tree checks for PluginMetaBar without a DOM renderer.
 *
 * react-dom is not a dependency here (the DSH host provides it at runtime), so
 * this test mocks `react` with a minimal createElement + useState/useCallback
 * shim, calls the component as a plain function, and walks the returned tree.
 * It catches the failures that matter for this bar: a wrong link target, a
 * missing version, or a status that never resolves out of "checking".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { harness } = vi.hoisted(() => ({
  harness: {
    slots: [] as unknown[],
    cursor: 0,
    reset() {
      this.slots = []
      this.cursor = 0
    },
  },
}))

vi.mock('react', () => {
  const createElement = (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({
    type,
    props: {
      ...(props ?? {}),
      children:
        children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  })
  const useState = (init: unknown) => {
    const index = harness.cursor++
    if (!(index in harness.slots)) {
      harness.slots[index] = typeof init === 'function' ? (init as () => unknown)() : init
    }
    return [
      harness.slots[index],
      (next: unknown) => {
        harness.slots[index] =
          typeof next === 'function' ? (next as (prev: unknown) => unknown)(harness.slots[index]) : next
      },
    ]
  }
  return {
    __harness: harness,
    default: { createElement },
    createElement,
    useState,
    useCallback: (fn: unknown) => fn,
  }
})

import { PluginMetaBar } from '../src/client/meta-bar'
import {
  GITHUB_REPO_URL,
  ISSUES_URL,
  PLUGIN_VERSION,
  RELEASES_URL,
  fetchLatestVersion,
} from '../src/client/version'

interface TreeNode {
  type: unknown
  props: Record<string, any>
}

type Translate = (key: string) => string

function callComponent(t: Translate) {
  harness.cursor = 0
  return (PluginMetaBar as unknown as (props: { t: Translate }) => unknown)({ t })
}

/** First render of a component instance (fresh hook state). */
function mount(t: Translate = key => key) {
  harness.reset()
  return callComponent(t)
}

/** Re-render the same instance, keeping its hook state. */
function rerender(t: Translate = key => key) {
  return callComponent(t)
}

function walk(node: unknown, visit: (node: TreeNode) => void): void {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, visit))
    return
  }
  if (typeof node !== 'object') return
  const tree = node as TreeNode
  visit(tree)
  walk(tree.props?.children, visit)
}

function collectText(node: unknown): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (node && typeof node === 'object') return collectText((node as TreeNode).props?.children)
  return ''
}

function find(node: unknown, predicate: (tree: TreeNode) => boolean): TreeNode | undefined {
  let found: TreeNode | undefined
  walk(node, tree => {
    if (!found && predicate(tree)) found = tree
  })
  return found
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  harness.reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PluginMetaBar', () => {
  it('shows the repository link, issue link, version and update button', () => {
    const tree = mount()

    expect(find(tree, t => t.props.href === GITHUB_REPO_URL)).toBeDefined()
    expect(find(tree, t => t.props.href === ISSUES_URL)).toBeDefined()
    expect(find(tree, t => t.type === 'button' && t.props.disabled === false)).toBeDefined()

    const text = collectText(tree)
    expect(text).toContain(`v${PLUGIN_VERSION}`)
    expect(text).toContain('settings.meta.check')
    expect(text).toContain('attention-plugins')
  })

  it('reports an available update with a link to the releases page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ version: '99.0.0' }), { status: 200 })),
    )

    const first = mount()
    const button = find(first, t => t.type === 'button')!
    await button.props.onClick()

    const tree = rerender()
    expect(find(tree, t => t.props.href === RELEASES_URL)).toBeDefined()
    expect(find(tree, t => t.props.disabled === true)).toBeUndefined()
  })

  it('reports up to date when the registry matches the installed version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ version: PLUGIN_VERSION }), { status: 200 })),
    )

    const button = find(mount(), t => t.type === 'button')!
    await button.props.onClick()

    expect(collectText(rerender())).toContain('settings.meta.upToDate')
  })

  it('reports a failure when the registry cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const button = find(mount(), t => t.type === 'button')!
    await button.props.onClick()

    const tree = rerender()
    expect(collectText(tree)).toContain('settings.meta.checkFailed')
    expect(find(tree, t => t.props.href === RELEASES_URL)).toBeUndefined()
  })

  it('disables the button while the check is in flight', async () => {
    let release: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(resolve => {
            release = resolve
          }),
      ),
    )

    const button = find(mount(), t => t.type === 'button')!
    const pending = button.props.onClick()

    const checkingTree = rerender()
    expect(find(checkingTree, t => t.type === 'button' && t.props.disabled === true)).toBeDefined()
    expect(collectText(checkingTree)).toContain('settings.meta.checking')

    release(new Response(JSON.stringify({ version: PLUGIN_VERSION }), { status: 200 }))
    await pending
    await flush()
    expect(collectText(rerender())).toContain('settings.meta.upToDate')
  })
})

describe('the update check hits the public npm registry', () => {
  it('uses the unscoped package document and tolerates a leading whitespace', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version: ' 1.2.3 ' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchLatestVersion()).resolves.toBe('1.2.3')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/attention-plugins/latest',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    )
  })
})
