/**
 * Browser notification utilities for attention-plugins.
 * Uses the Notification API to show system notifications when the user
 * is not looking at the DSH tab.
 */
/** Request notification permission if not already granted. */
export declare function requestPermission(): Promise<boolean>;
/** Check if browser notifications are available and permitted. */
export declare function canNotify(): boolean;
/** Show a system notification. Returns whether it was shown. */
export declare function showNotification(title: string, body: string): boolean;
//# sourceMappingURL=notification.d.ts.map