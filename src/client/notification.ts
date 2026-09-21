/**
 * Browser notification utilities for attention-plugins.
 * Uses the Notification API to show system notifications when the user
 * is not looking at the DSH tab.
 */

const NOTIFICATION_TAG = 'attention-plugins:completed'

/** Request notification permission if not already granted. */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[attention-plugins] Notification API not available')
    return false
  }
  
  if (Notification.permission === 'granted') {
    return true
  }
  
  if (Notification.permission === 'denied') {
    return false
  }
  
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch (err) {
    console.warn('[attention-plugins] Failed to request notification permission:', err)
    return false
  }
}

/** Check if browser notifications are available and permitted. */
export function canNotify(): boolean {
  return (
    'Notification' in window &&
    Notification.permission === 'granted'
  )
}

/** Show a system notification. Returns whether it was shown. */
export function showNotification(title: string, body: string): boolean {
  if (!canNotify()) return false
  
  try {
    const notification = new Notification(title, {
      body,
      tag: NOTIFICATION_TAG,
      icon: '/favicon.ico', // Use DSH's favicon
      requireInteraction: false,
    })
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)
    
    return true
  } catch (err) {
    console.warn('[attention-plugins] Failed to show notification:', err)
    return false
  }
}
