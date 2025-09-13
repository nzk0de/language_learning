// Content script that runs on YouTube pages
class YouTubeTranslator {
  constructor() {
    this.apiBase = 'http://localhost:8000';
    this.isActive = false;
    this.translatorPanel = null;
    this.setupTranslatorButton();
  }

  setupTranslatorButton() {
    // Wait for YouTube to load
    const checkForYouTube = () => {
      const controls = document.querySelector('.ytp-right-controls');
      if (controls && !document.querySelector('#yt-translator-btn')) {
        this.addTranslatorButton(controls);
      }
    };

    // Check immediately and on navigation changes
    checkForYouTube();
    
    // YouTube is a SPA, so we need to listen for navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(checkForYouTube, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  addTranslatorButton(controls) {
    const button = document.createElement('button');
    button.id = 'yt-translator-btn';
    button.className = 'ytp-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    `;
    button.title = 'Translate Subtitles';
    button.style.cssText = `
      color: white;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      margin: 0 4px;
    `;

    button.addEventListener('click', () => {
      this.toggleTranslator();
    });

    controls.insertBefore(button, controls.firstChild);
  }

  async toggleTranslator() {
    if (this.isActive) {
      this.closeTranslator();
    } else {
      await this.openTranslator();
    }
  }

  async openTranslator() {
    this.isActive = true;
    
    // Create translator panel
    this.translatorPanel = document.createElement('div');
    this.translatorPanel.id = 'yt-translator-panel';
    this.translatorPanel.innerHTML = `
      <div class="translator-header">
        <h3>YouTube Subtitle Translator</h3>
        <button id="close-translator">×</button>
      </div>
      <div class="translator-controls">
        <select id="target-language">
          <option value="en">English</option>
          <option value="de">German</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
        </select>
        <button id="extract-translate-btn">Extract & Translate</button>
        <button id="auto-translate-btn">Auto Translate</button>
      </div>
      <div class="translator-content">
        <div class="subtitle-section">
          <h4>Original Subtitles:</h4>
          <div id="original-subtitles" class="subtitle-text"></div>
        </div>
        <div class="translation-section">
          <h4>Translation:</h4>
          <div id="translated-subtitles" class="subtitle-text"></div>
        </div>
      </div>
      <div class="translator-status">
        <div id="status-message"></div>
      </div>
    `;

    document.body.appendChild(this.translatorPanel);

    // Add event listeners
    document.getElementById('close-translator').addEventListener('click', () => {
      this.closeTranslator();
    });

    document.getElementById('extract-translate-btn').addEventListener('click', () => {
      this.extractAndTranslate();
    });

    document.getElementById('auto-translate-btn').addEventListener('click', () => {
      this.toggleAutoTranslate();
    });

    // Update button appearance
    const btn = document.getElementById('yt-translator-btn');
    if (btn) {
      btn.style.backgroundColor = '#ff0000';
    }
  }

  closeTranslator() {
    this.isActive = false;
    
    if (this.translatorPanel) {
      this.translatorPanel.remove();
      this.translatorPanel = null;
    }

    // Reset button appearance
    const btn = document.getElementById('yt-translator-btn');
    if (btn) {
      btn.style.backgroundColor = 'transparent';
    }

    // Stop auto-translation if active
    if (this.autoTranslateInterval) {
      clearInterval(this.autoTranslateInterval);
      this.autoTranslateInterval = null;
    }
  }

  extractSubtitles() {
    // Method 1: Try to get subtitles from YouTube's subtitle container
    const subtitleElements = document.querySelectorAll('.ytp-caption-segment');
    if (subtitleElements.length > 0) {
      const subtitles = Array.from(subtitleElements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join(' ');
      return subtitles;
    }

    // Method 2: Try to get from live chat or description if no subtitles
    const description = document.querySelector('#description');
    if (description) {
      const descText = description.textContent.trim();
      if (descText.length > 100) {
        return descText.substring(0, 2000); // Limit length
      }
    }

    return '';
  }

  async extractAndTranslate() {
    const statusDiv = document.getElementById('status-message');
    const originalDiv = document.getElementById('original-subtitles');
    const translatedDiv = document.getElementById('translated-subtitles');
    const targetLang = document.getElementById('target-language').value;

    statusDiv.textContent = 'Extracting subtitles...';
    
    const subtitles = this.extractSubtitles();
    
    if (!subtitles) {
      statusDiv.textContent = 'No subtitles found. Make sure subtitles are enabled on the video.';
      return;
    }

    originalDiv.textContent = subtitles;
    statusDiv.textContent = 'Translating...';

    try {
      const translation = await this.translateText(subtitles, targetLang);
      translatedDiv.textContent = translation;
      statusDiv.textContent = `Translated successfully to ${targetLang.toUpperCase()}!`;
    } catch (error) {
      console.error('Translation error:', error);
      statusDiv.textContent = 'Translation failed. Make sure your API server is running.';
    }
  }

  async translateText(text, targetLang, sourceLang = 'auto') {
    // Detect source language if not specified
    if (sourceLang === 'auto') {
      sourceLang = await this.detectLanguage(text);
    }

    const response = await fetch(`${this.apiBase}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        src_lang: sourceLang,
        tgt_lang: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.translation;
  }

  async detectLanguage(text) {
    // Simple language detection based on common patterns
    // You could also call your API's language detection if available
    
    if (/[äöüß]/.test(text)) return 'de'; // German
    if (/[àáâãçéêíôõú]/.test(text)) return 'pt'; // Portuguese
    if (/[àâéèêëïîôù]/.test(text)) return 'fr'; // French
    if (/[áéíñóú¿¡]/.test(text)) return 'es'; // Spanish
    if (/[àèéìíîòóù]/.test(text)) return 'it'; // Italian
    if (/[а-я]/.test(text)) return 'ru'; // Russian
    if (/[ひらがなカタカナ]/.test(text)) return 'ja'; // Japanese
    if (/[가-힣]/.test(text)) return 'ko'; // Korean
    if (/[一-龯]/.test(text)) return 'zh'; // Chinese
    
    return 'en'; // Default to English
  }

  toggleAutoTranslate() {
    const btn = document.getElementById('auto-translate-btn');
    
    if (this.autoTranslateInterval) {
      // Stop auto-translation
      clearInterval(this.autoTranslateInterval);
      this.autoTranslateInterval = null;
      btn.textContent = 'Auto Translate';
      btn.style.backgroundColor = '';
    } else {
      // Start auto-translation
      this.autoTranslateInterval = setInterval(() => {
        this.extractAndTranslate();
      }, 3000); // Check every 3 seconds
      
      btn.textContent = 'Stop Auto';
      btn.style.backgroundColor = '#ff6b6b';
      
      // Do initial translation
      this.extractAndTranslate();
    }
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeTranslator();
  });
} else {
  new YouTubeTranslator();
}
