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
    'settings.mainline.label': 'Main-line Task Marker',
    'settings.mainline.description': 'Mark a session as main-line to get immediate alerts on completion. All other running sessions are side-line and alert only when ALL finish.',
    'settings.mainline.hint': '💡 Mark via the ☆ toggle at the left of the composer tool row, or the mainline item in a session row "..." menu. The mainline session shows a persistent star in the sidebar (click it to unmark).',
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
    'settings.mainline.label': '主线任务标记',
    'settings.mainline.description': '标记某个会话为主线后，它完成时立即通知。其他正在运行的会话都是支线，只有全部完成时才通知。',
    'settings.mainline.hint': '💡 通过输入框工具行左侧的星标、或会话行「…」菜单里的主线项来标记；主线会话在侧边栏标题前常驻星标，点击可取消。',
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
