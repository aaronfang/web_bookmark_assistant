import { registerChromeBookmarkEventListeners } from '../src/chrome/bookmark-events';
import { registerLinkHealthScheduler } from '../src/health/link-health-scheduler';

export default defineBackground(() => {
  registerChromeBookmarkEventListeners();
  registerLinkHealthScheduler();

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('Unable to configure side panel behavior', error);
    });
});
