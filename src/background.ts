chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copy-background-image-url',
    title: 'Copy background image URL',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-background-image-url' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'getBackgroundImageUrl'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'copyToClipboard' && message.url) {
    (async () => {
      try {
        await navigator.clipboard.writeText(message.url);
        console.log('Background image URL copied to clipboard:', message.url);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true; // Keep the message channel open for async response
  }
});