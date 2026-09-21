/**
 * Main-line session marker: button in conversation header to toggle main-line status.
 * Injects into conversation.session.header.utilities slot.
 */
import React, { useCallback } from 'react';
/** Main-line marker button component. */
export function MainlineButton(props) {
    const { inject, t } = props;
    const injected = inject();
    const { hooks, onToggle } = injected;
    const sessionId = hooks.sessionId();
    if (!sessionId)
        return null;
    const isMainline = hooks.isMainline(sessionId);
    const handleClick = useCallback(() => {
        if (sessionId) {
            onToggle(sessionId);
        }
    }, [sessionId, onToggle]);
    return (React.createElement("button", { onClick: handleClick, title: t(isMainline ? 'mainline.unset' : 'mainline.set'), style: {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: isMainline ? '1px solid #ffa500' : '1px solid #ddd',
            borderRadius: '6px',
            background: isMainline ? '#fff8e6' : 'transparent',
            color: isMainline ? '#ff8800' : '#666',
            fontSize: '13px',
            fontWeight: isMainline ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        }, onMouseEnter: (e) => {
            if (!isMainline) {
                e.currentTarget.style.background = '#f5f5f5';
            }
        }, onMouseLeave: (e) => {
            if (!isMainline) {
                e.currentTarget.style.background = 'transparent';
            }
        } },
        React.createElement("span", { style: { fontSize: '14px' } }, isMainline ? '⭐' : '☆'),
        React.createElement("span", null, t(isMainline ? 'mainline.label.active' : 'mainline.label.inactive'))));
}
//# sourceMappingURL=mainline-button.js.map