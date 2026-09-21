import { NotificationEngine } from './engine.js';
import { playSound } from './sounds.js';
import { showNotification } from './notification.js';
import { loadSettings, saveSettings, AttentionSettingsSection } from './settings.js';
import { locales } from './locales.js';
import { MainlineButton } from './mainline-button.js';
export const name = 'attention-plugins';
/** Extract session detail from session + chat snapshots. */
function sessionDetailOf(session, chat // ChatSnapshotLike
) {
    let maxTurnErrorSeq = 0;
    let failureMessage = null;
    let finalText = '';
    if (chat?.nodes) {
        for (const node of chat.nodes.values()) {
            if (node.kind === 'turn-error') {
                const data = node.data;
                if (data.seq > maxTurnErrorSeq) {
                    maxTurnErrorSeq = data.seq;
                    failureMessage = data.message;
                }
            }
            else if (node.kind === 'assistant-step') {
                const data = node.data;
                const text = (data.blocks || [])
                    .filter((b) => b.kind === 'text')
                    .map((b) => b.text)
                    .join('');
                if (text.length > 0)
                    finalText = text;
            }
        }
    }
    return {
        maxTurnErrorSeq,
        failureMessage,
        lastAgentError: session.lastAgentError,
        finalText,
    };
}
export function apply(ctx, config) {
    // Register settings section
    const slots = ctx.slots;
    if (slots?.settings?.section) {
        slots.settings.section({
            id: 'attention',
            title: 'Attention',
            component: AttentionSettingsSection,
        });
    }
    // Register main-line button in conversation header
    if (slots?.inject) {
        ctx.effect(() => {
            const sessions = ctx.sessions;
            const i18n = ctx.i18n;
            const dispose = slots.inject('conversation.session.header.utilities', () => slots.register({
                name: 'conversation.session.header.utilities',
                id: 'attention-mainline',
                order: 100,
                locale: 'attention-plugins',
                inject: () => {
                    return {
                        hooks: {
                            sessionId: () => sessions?.currentSessionId?.() || null,
                            isMainline: (id) => {
                                const settings = loadSettings();
                                return settings.mainlineSessionId === id;
                            },
                        },
                        onToggle: (id) => {
                            const settings = loadSettings();
                            const newId = settings.mainlineSessionId === id ? '' : id;
                            saveSettings({ ...settings, mainlineSessionId: newId });
                        },
                        t: (key) => {
                            const locale = i18n?.locale?.() || 'en';
                            const localeCode = locale.startsWith('zh') ? 'zh-CN' : 'en';
                            return locales[localeCode][key] || key;
                        },
                    };
                },
            }, MainlineButton));
            return () => dispose?.();
        });
    }
    // Subscribe to sessions list and detect events
    ctx.effect(() => {
        const sessions = ctx.sessions;
        const i18n = ctx.i18n;
        const uiSession = ctx.uiSession;
        const { useSessions, currentSessionId } = sessions || {};
        const { locale } = i18n || {};
        const { pendingInteractions } = uiSession || {};
        if (!useSessions) {
            console.warn('[attention-plugins] useSessions hook not available');
            return () => { };
        }
        let initialized = false;
        const sessionSnapshots = new Map();
        const engine = new NotificationEngine({
            titleOf: (sessionId) => {
                const sessions = useSessions.getState();
                const session = sessions.byId[sessionId];
                return session?.title || 'Untitled';
            },
            detailOf: (sessionId) => {
                const sessions = useSessions.getState();
                const session = sessions.byId[sessionId];
                if (!session)
                    return undefined;
                // Try to get chat snapshot for the session
                const chat = sessionSnapshots.get(sessionId);
                // Mock minimal detail for now (full implementation needs uiConversation binding)
                return {
                    maxTurnErrorSeq: 0,
                    failureMessage: null,
                    lastAgentError: session.lastAgentError || null,
                    finalText: '',
                };
            },
            isMainline: (sessionId) => {
                const settings = loadSettings();
                return settings.mainlineSessionId === sessionId;
            },
            emit: (event) => {
                const settings = loadSettings();
                const typeSettings = settings.types[event.kind];
                if (!typeSettings.enabled)
                    return;
                const localeCode = (locale?.() || 'en').startsWith('zh') ? 'zh-CN' : 'en';
                const t = (key) => locales[localeCode][key];
                // Check gating: quiet current session by default
                const isCurrent = currentSessionId?.() === event.sessionId;
                const isHidden = document.hidden;
                if (isCurrent && !isHidden && !settings.notifyCurrent) {
                    return;
                }
                // Play sound
                if (settings.soundEnabled && typeSettings.sound !== 'none') {
                    playSound(typeSettings.sound, settings.volume);
                }
                // Show browser notification when away
                if (settings.browserEnabled) {
                    const shouldNotify = isHidden || !isCurrent || settings.notifyCurrent;
                    if (shouldNotify) {
                        const title = t(`notification.${event.kind}.title`) || event.kind;
                        const body = t(`notification.${event.kind}.body`)
                            ?.replace('{title}', event.title)
                            ?.replace('{detail}', event.detail) || event.detail;
                        showNotification(title, body);
                    }
                }
            },
            settle: () => new Promise(resolve => setTimeout(resolve, 100)),
        });
        // Subscribe to sessions list
        const unsubscribeSessions = useSessions.subscribe((sessions) => {
            if (!initialized) {
                engine.seed(sessions);
                initialized = true;
            }
            else {
                engine.observe(sessions);
            }
        });
        // Subscribe to pending interactions (if available)
        let unsubscribePending;
        if (pendingInteractions) {
            unsubscribePending = pendingInteractions.subscribe?.((pending) => {
                engine.observePending(pending);
            });
        }
        return () => {
            unsubscribeSessions?.();
            unsubscribePending?.();
        };
    });
}
//# sourceMappingURL=index.js.map