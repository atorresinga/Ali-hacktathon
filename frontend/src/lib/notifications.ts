import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotifPermissionUi = "granted" | "denied" | "prompt" | "unsupported";

function mapCapState(s: string): NotifPermissionUi {
  if (s === "granted") return "granted";
  if (s === "denied") return "denied";
  if (s === "default") return "prompt";
  return "prompt";
}

/** Current permission for UI (Capacitor local notifications or Web Notifications). */
export async function readNotificationPermission(): Promise<NotifPermissionUi> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      return mapCapState(display);
    } catch {
      return "unsupported";
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const p = Notification.permission;
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  return "prompt";
}

/**
 * Ask for permission and fire a short confirmation local notification (native)
 * or `Notification` (web). Returns updated permission state for UI.
 */
export async function requestMarketAlerts(params: { title: string; body: string }): Promise<NotifPermissionUi> {
  if (Capacitor.isNativePlatform()) {
    try {
      const req = await LocalNotifications.requestPermissions();
      const ui = mapCapState(req.display);
      if (req.display === "granted") {
        const id = Math.floor(Date.now() % 2_000_000_000);
        await LocalNotifications.schedule({
          notifications: [
            {
              title: params.title,
              body: params.body,
              id,
              schedule: { at: new Date(Date.now() + 1200) },
            },
          ],
        });
      }
      return ui;
    } catch {
      return "unsupported";
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    try {
      new Notification(params.title, { body: params.body });
    } catch {
      /* Safari / locked-down WebView */
    }
  }
  return mapCapState(perm);
}
