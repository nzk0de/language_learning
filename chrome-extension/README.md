# YouTube Language Translator Chrome Extension

A Chrome extension that extracts YouTube subtitles and translates them using your language learning API.

## Features

- 🎥 **YouTube Integration**: Adds a translate button directly to YouTube video controls
- 📝 **Subtitle Extraction**: Automatically extracts subtitles from YouTube videos
- 🌍 **Multi-language Translation**: Supports 10+ languages via your translation API
- ⚡ **Real-time Translation**: Auto-translate mode for live subtitle translation
- 🎛️ **Customizable Settings**: Configure API server and default language preferences

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Start your API server** (make sure it's running on `http://localhost:8000`)
   ```bash
   cd /home/ubuntu/Documents/projects/language_learning/language_app
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Open Chrome Extensions page**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**:
   - Click "Load unpacked"
   - Navigate to and select the `chrome-extension` folder:
     ```
     /home/ubuntu/Documents/projects/language_learning/chrome-extension/
     ```

4. **Verify installation**:
   - You should see "YouTube Language Translator" in your extensions list
   - The extension icon should appear in your Chrome toolbar

### Method 2: Package as .crx (Optional)

If you want to distribute the extension:
1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select the extension directory
4. This creates a `.crx` file you can share

## Usage

### Basic Usage

1. **Configure the extension** (first time only):
   - Click the extension icon in Chrome toolbar
   - Set API Server URL: `http://localhost:8000`
   - Choose your preferred target language
   - Click "Save Settings"
   - Test connection to verify it works

2. **Go to YouTube**:
   - Open any YouTube video
   - **Enable subtitles** on the video (CC button)
   - Look for the new translate button (🌍) in the video controls

3. **Translate subtitles**:
   - Click the translate button to open the translator panel
   - Click "Extract & Translate" to translate current subtitles
   - Or click "Auto Translate" for continuous translation

### Advanced Features

- **Auto Translate**: Automatically translates subtitles every 3 seconds
- **Language Detection**: Automatically detects source language
- **Clean Text Processing**: Uses your advanced text cleaning for better translations
- **Chunk Processing**: Handles long subtitle texts by splitting them appropriately

## Supported Languages

The extension supports translation to/from:
- English (en)
- German (de)
- Spanish (es)
- French (fr)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)

## API Integration

The extension connects to your existing translation API:

- **Endpoint**: `POST /translate`
- **Request format**:
  ```json
  {
    "text": "subtitle text",
    "src_lang": "de",
    "tgt_lang": "en"
  }
  ```
- **Features used**:
  - Text cleaning and preprocessing
  - Google Translate with 5k character chunking
  - Stanza sentence splitting

## Troubleshooting

### Extension not working:
1. Make sure your API server is running on `http://localhost:8000`
2. Check if subtitles are enabled on the YouTube video
3. Verify extension permissions in `chrome://extensions/`

### Translation failing:
1. Test API connection in extension popup
2. Check browser console for error messages (F12 → Console)
3. Verify your API server logs

### Subtitles not extracting:
1. Make sure CC (subtitles) are enabled on the video
2. Try refreshing the YouTube page
3. Some videos may not have subtitles available

## Development

### File Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main YouTube integration logic
├── popup.html           # Settings popup interface
├── popup.js             # Popup functionality
├── background.js        # Background service worker
├── styles.css           # Extension styling
└── icons/               # Extension icons
    └── icon16.svg
```

### Customization

- **Add new languages**: Update the language options in `popup.html` and `content.js`
- **Change styling**: Modify `styles.css` for different appearance
- **Add features**: Extend `content.js` with new functionality
- **API changes**: Update the fetch requests in `content.js`

## Privacy & Permissions

The extension requires:
- **activeTab**: To interact with YouTube pages
- **scripting**: To inject the translator interface
- **storage**: To save user settings
- **host_permissions**: For YouTube and your local API server

No data is sent to external servers except your own translation API.

## License

This extension is part of your language learning project and uses your existing translation infrastructure.
