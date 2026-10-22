/**
 * Localization strings for attention-plugins.
 * Supports English (en) and Simplified Chinese (zh-CN).
 */

export const locales = {
  'en': {
    'settings.title': 'Attention is all you need',
    'settings.titleKw': 'Attention',
    'settings.titleRest': ' is all you need',
    'settings.sound.label': 'Sound Notifications',
    'settings.sound.description': 'Play a sound when events occur',
    'settings.sound.volume': 'Volume',
    'settings.browser.label': 'Browser Notifications',
    'settings.browser.description': 'Show system notifications when you are away',
    'settings.browser.permission.granted': 'Granted',
    'settings.browser.permission.denied': 'Denied (check browser settings)',
    'settings.browser.permission.default': 'Not requested',
    'settings.browser.enable': 'Enable & Request Permission',
    'settings.browser.test': 'Test Notification',
    'settings.notifyCurrent.label': 'Alert for Current Session',
    'settings.notifyCurrent.description': 'Also notify when the session you are viewing completes',
    'settings.badge.label': 'Sidebar Mainline Badge',
    'settings.badge.description': 'Show a small star before the mainline session in the sidebar (experimental)',
    'settings.mode.label': 'Task Mode',
    'settings.mode.description': 'How sessions without a main-line marker are classified.',
    'settings.mode.mainline': 'Main-line mode',
    'settings.mode.balanced': 'Balanced mode',
    'settings.mode.hint': '💡 Main-line mode: unmarked sessions are side-line and follow the side-line alert setting below. Balanced mode: while no main-line is marked, every session counts as main-line and alerts as soon as it finishes or fails.',
    'settings.mainline.label': 'Main-line Task Markers',
    'settings.mainline.description': 'Mark one or more sessions as main-line to single them out in the sidebar. Each marked session alerts on its own; how the other running sessions alert is decided by the side-line mode below.',
    'settings.mainline.hint': '💡 Mark via the ☆ toggle at the left of the composer tool row, or the mainline item in a session row "..." menu. Every marked session shows a persistent star in the sidebar (click a star to unmark that session).',
    'settings.sideline.label': 'Side-line Alerts',
    'settings.sideline.description': 'How to alert for sessions that are not marked main-line (ignored in balanced mode while nothing is marked).',
    'settings.sideline.perSession': 'Alert each task as it finishes',
    'settings.sideline.batch': 'Alert once when all running tasks finish',
    'settings.sideline.hint': '💡 "Alert each task" rings once per finished task (N tasks = N rings). "Alert once" stays silent while any task is still running and rings a single "All tasks" when the last one finishes.',
    'settings.eventTypes.label': 'Event Types',
    'settings.eventTypes.description': 'Configure notifications for each event type',
    'event.completed': 'Completed',
    'event.failed': 'Failed',
    'event.question': 'Question',
    'event.permission': 'Permission',
    'sound.chime': 'Chime',
    'sound.success': 'Success',
    'sound.subtle': 'Subtle',
    'sound.none': 'None',
    'notification.completed.title': 'Session Completed',
    'notification.completed.body': '{title}',
    'notification.failed.title': 'Session Failed',
    'notification.failed.body': '{title}: {detail}',
    'notification.question.title': 'Question Asked',
    'notification.question.body': '{title}: {detail}',
    'notification.permission.title': 'Permission Requested',
    'notification.permission.body': '{title}: {detail}',
    'notification.test.title': 'Test Notification',
    'notification.test.body': 'Attention plugins is working!',
    'mainline.set': 'Set as main-line task',
    'mainline.unset': 'Unmark main-line',
    'mainline.label.active': 'Main',
    'mainline.label.inactive': 'Set as Main',
  },
  'zh-CN': {
    'settings.title': 'Attention is all you need',
    'settings.titleKw': 'Attention',
    'settings.titleRest': ' is all you need',
    'settings.sound.label': '声音通知',
    'settings.sound.description': '事件发生时播放提示音',
    'settings.sound.volume': '音量',
    'settings.browser.label': '浏览器通知',
    'settings.browser.description': '离开标签页时显示系统通知',
    'settings.browser.permission.granted': '已授权',
    'settings.browser.permission.denied': '已拒绝（请检查浏览器设置）',
    'settings.browser.permission.default': '未请求',
    'settings.browser.enable': '启用并请求权限',
    'settings.browser.test': '测试通知',
    'settings.notifyCurrent.label': '为当前会话也通知',
    'settings.notifyCurrent.description': '正在查看的会话完成时也发出通知',
    'settings.badge.label': '侧边栏主线徽标',
    'settings.badge.description': '在侧边栏会话标题前常驻显示主线星标（实验性，可随时关闭）',
    'settings.mode.label': '任务模式',
    'settings.mode.description': '未标记主线的会话如何归类。',
    'settings.mode.mainline': '主线模式（现有行为）',
    'settings.mode.balanced': '均衡模式',
    'settings.mode.hint': '💡 主线模式：未标记主线的会话一律算支线，按下方「支线通知方式」提醒。均衡模式：没有标记主线时，所有会话都视为主线，每个任务完成或失败时都会立即发出提示音。',
    'settings.mainline.label': '主线任务标记',
    'settings.mainline.description': '可标记一个或多个会话为主线，在侧边栏里单独突出它们。每个主线任务单独提醒；其余正在运行的会话（支线）怎么通知，由下面的「支线通知方式」决定。',
    'settings.mainline.hint': '💡 通过输入框工具行左侧的星标、或会话行「…」菜单里的主线项来标记/取消，支持同时标记多个；每个主线会话在侧边栏标题前常驻星标，点击某颗星只取消该会话。',
    'settings.sideline.label': '支线通知方式',
    'settings.sideline.description': '未标记主线的会话（支线）完成时怎么通知；均衡模式下未标记主线时此项不生效。',
    'settings.sideline.perSession': '每个任务结束就通知（响 N 次）',
    'settings.sideline.batch': '全部任务结束后通知一次（响 1 次）',
    'settings.sideline.hint': '💡 「每个任务结束就通知」= N 个任务响 N 声；「全部结束通知一次」= 期间任何任务还在跑都不响，最后一个跑完才响一声「All tasks」。',
    'settings.eventTypes.label': '事件类型',
    'settings.eventTypes.description': '为每种事件类型配置通知',
    'event.completed': '完成',
    'event.failed': '失败',
    'event.question': '提问',
    'event.permission': '权限',
    'sound.chime': '清脆',
    'sound.success': '成功',
    'sound.subtle': '柔和',
    'sound.none': '静音',
    'notification.completed.title': '会话已完成',
    'notification.completed.body': '{title}',
    'notification.failed.title': '会话失败',
    'notification.failed.body': '{title}：{detail}',
    'notification.question.title': '收到提问',
    'notification.question.body': '{title}：{detail}',
    'notification.permission.title': '需要权限',
    'notification.permission.body': '{title}：{detail}',
    'notification.test.title': '测试通知',
    'notification.test.body': 'Attention plugins 运行正常！',
    'mainline.set': '设为主线任务',
    'mainline.unset': '取消主线标记',
    'mainline.label.active': '主线',
    'mainline.label.inactive': '设为主线',
  },
} as const

export type LocaleKey = keyof typeof locales['en']
export type LocaleCode = keyof typeof locales

/**
 * Resolve the UI language from the DSH locale service, the document language,
 * or the browser language; falls back to Chinese (the primary audience).
 * The DSH locale service call may be unavailable across versions, so the
 * document/navigator hints keep the UI Chinese on Chinese systems.
 */
export function resolveLocaleCode(explicit?: string): LocaleCode {
  const hints = [
    explicit,
    typeof document !== 'undefined' ? document.documentElement?.lang : undefined,
    typeof navigator !== 'undefined' ? navigator?.language : undefined,
  ]
  for (const hint of hints) {
    const value = String(hint ?? '').toLowerCase()
    if (value.startsWith('zh')) return 'zh-CN'
    if (value.startsWith('en')) return 'en'
  }
  return 'zh-CN'
}
