/**
 * Main-line session marker: button in conversation header to toggle main-line status.
 * Injects into conversation.session.header.utilities slot.
 */
import React from 'react';
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client';
/** Injected hooks and methods. */
export interface MainlineButtonInjected {
    hooks: {
        sessionId: () => SessionId | null;
        isMainline: (id: SessionId) => boolean;
    };
    onToggle: (id: SessionId) => void;
    t: (key: string) => string;
}
/** Props for the main-line marker button. */
export interface MainlineButtonProps {
    inject: () => MainlineButtonInjected;
    t: (key: string) => string;
}
/** Main-line marker button component. */
export declare function MainlineButton(props: MainlineButtonProps): React.JSX.Element | null;
//# sourceMappingURL=mainline-button.d.ts.map