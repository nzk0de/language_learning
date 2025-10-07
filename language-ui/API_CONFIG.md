# API Configuration Guide

This project uses a centralized API configuration system that makes it easy to switch between different environments (development, staging, production).

## Configuration File

The main configuration is located in `src/config/api.js`. This file exports:

- `API_BASE_URL`: The current API base URL
- `buildApiUrl(endpoint)`: Helper function to build complete API URLs
- `CURRENT_ENVIRONMENT`: Current environment name

## Changing the API Endpoint

### Method 1: Edit the configuration file directly

Open `src/config/api.js` and modify the configuration object:

```javascript
const config = {
  development: {
    apiBaseUrl: 'http://localhost:8000',
  },
  production: {
    apiBaseUrl: 'https://your-production-domain.com',
  },
  staging: {
    apiBaseUrl: 'https://your-staging-domain.com',
  }
};
```

### Method 2: Use environment variables

Set the `REACT_APP_ENVIRONMENT` environment variable:

```bash
# For staging
REACT_APP_ENVIRONMENT=staging npm start

# For production  
REACT_APP_ENVIRONMENT=production npm start
```

### Method 3: Quick development change

For quick testing with a different URL, you can temporarily modify the `development` configuration:

```javascript
development: {
  apiBaseUrl: 'https://your-test-server.com',
},
```

## Usage in Components

The API configuration is already integrated into all components. Use it like this:

```javascript
import { buildApiUrl, API_BASE_URL } from './config/api';

// Method 1: Using buildApiUrl helper (recommended)
const response = await fetch(buildApiUrl('books'));

// Method 2: Using API_BASE_URL directly
const response = await fetch(`${API_BASE_URL}/books`);
```

## Environment Detection

The system automatically detects the environment:

1. If `NODE_ENV === 'production'`, uses production config
2. If `REACT_APP_ENVIRONMENT` is set, uses that environment
3. Otherwise, defaults to development

## Updated Files

The following files have been updated to use the centralized configuration:

- `src/BooksPage.js`
- `src/TranslationPage.js` 
- `src/YoutubePage.js`
- `src/PlayGround.js`
- `src/RSSPage.js`
- `src/EmbeddingsModal.js`
- `src/components/BookCard.js`
- `src/hooks/usePaginatedBooks.js`
- `src/hooks/useBooks.js`
- `src/hooks/useDataFetching.js`

## Benefits

- ✅ Single place to change API endpoints
- ✅ Environment-specific configurations
- ✅ Easy switching between development/staging/production
- ✅ Better developer experience
- ✅ Reduces hardcoded URLs throughout the codebase
