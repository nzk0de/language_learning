// Background script for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Translator Extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    // Handle translation requests if needed
    console.log('Translation request:', request);
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup or perform action
  console.log('Extension clicked on tab:', tab.url);
});
