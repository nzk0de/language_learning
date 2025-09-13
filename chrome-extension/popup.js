// Popup script for extension settings
document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('api-url');
  const defaultLanguageSelect = document.getElementById('default-language');
  const saveButton = document.getElementById('save-settings');
  const testButton = document.getElementById('test-connection');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:8000',
    defaultLanguage: 'en'
  });

  apiUrlInput.value = settings.apiUrl;
  defaultLanguageSelect.value = settings.defaultLanguage;

  // Save settings
  saveButton.addEventListener('click', async () => {
    const newSettings = {
      apiUrl: apiUrlInput.value.trim(),
      defaultLanguage: defaultLanguageSelect.value
    };

    await chrome.storage.sync.set(newSettings);
    
    statusDiv.textContent = 'Settings saved successfully!';
    statusDiv.style.color = '#4CAF50';
    
    setTimeout(() => {
      statusDiv.textContent = 'Ready to translate YouTube subtitles';
      statusDiv.style.color = '#ccc';
    }, 2000);
  });

  // Test API connection
  testButton.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    
    statusDiv.textContent = 'Testing connection...';
    statusDiv.style.color = '#2196F3';

    try {
      const response = await fetch(`${apiUrl}/languages`);
      
      if (response.ok) {
        const data = await response.json();
        statusDiv.textContent = `✓ Connected! Found ${data.total_supported || 'many'} languages`;
        statusDiv.style.color = '#4CAF50';
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      statusDiv.textContent = `✗ Connection failed: ${error.message}`;
      statusDiv.style.color = '#f44336';
    }

    setTimeout(() => {
      statusDiv.textContent = 'Ready to translate YouTube subtitles';
      statusDiv.style.color = '#ccc';
    }, 3000);
  });
});
