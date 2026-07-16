import { checkStoredChromeBookmarkLinks } from './link-health';

export const LINK_HEALTH_ALARM = 'bookmark-link-health';
export const LINK_HEALTH_PERIOD_MINUTES = 6 * 60;

export function registerLinkHealthScheduler(): void {
  chrome.alarms.create(LINK_HEALTH_ALARM, {
    delayInMinutes: LINK_HEALTH_PERIOD_MINUTES,
    periodInMinutes: LINK_HEALTH_PERIOD_MINUTES,
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== LINK_HEALTH_ALARM) return;
    void checkStoredChromeBookmarkLinks().catch((error: unknown) => {
      console.warn('Scheduled bookmark link check failed', error);
    });
  });
}
