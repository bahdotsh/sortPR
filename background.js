// GitHub PR Contributor Sorter - Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('GitHub PR Contributor Sorter installed');
    
    // Set default settings
    chrome.storage.local.set({
      prSortOrder: 'default',
      installDate: Date.now()
    });
    
    // Open welcome page or GitHub
    chrome.tabs.create({
      url: 'https://github.com'
    });
  } else if (details.reason === 'update') {
    console.log('GitHub PR Contributor Sorter updated');
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup automatically due to manifest configuration
  // But we can add additional logic here if needed
  console.log('Extension icon clicked on tab:', tab.url);
});

// Listen for tab updates to potentially refresh extension state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('github.com/')) {
    // Could send messages to content script here if needed
    console.log('GitHub page loaded:', tab.url);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SORT_PREFERENCE':
      chrome.storage.local.get('prSortOrder', (result) => {
        sendResponse({ sortOrder: result.prSortOrder || 'default' });
      });
      return true; // Will respond asynchronously
      
    case 'SET_SORT_PREFERENCE':
      chrome.storage.local.set({ prSortOrder: message.sortOrder }, () => {
        sendResponse({ success: true });
      });
      return true; // Will respond asynchronously
      
    case 'LOG_ERROR':
      console.error('Content script error:', message.error);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
});

// Cleanup on extension uninstall (Chrome doesn't support this directly, but good to have)
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending...');
});