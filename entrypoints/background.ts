import { registerChromeBookmarkEventListeners } from '../src/chrome/bookmark-events';

export default defineBackground(() => {
  registerChromeBookmarkEventListeners();

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('Unable to configure side panel behavior', error);
    });
});
