/**
 * API Configuration
 * 
 * Centralized configuration for all API endpoints.
 * Change API_BASE_URL to switch between different environments.
 */

// Configuration options
const config = {
  development: {
    apiBaseUrl: 'https://fallen-equipment-chat-maritime.trycloudflare.com', // Local development server
  },
  production: {
    apiBaseUrl: 'https://your-production-domain.com', // Update this when you deploy
  },
  staging: {
    apiBaseUrl: 'https://your-staging-domain.com', // Optional staging environment
  }
};

// Determine current environment
const getEnvironment = () => {
  // You can customize this logic based on your needs
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Check for custom environment variables
  if (process.env.REACT_APP_ENVIRONMENT) {
    return process.env.REACT_APP_ENVIRONMENT;
  }
  
  return 'development';
};

const currentEnv = getEnvironment();
const currentConfig = config[currentEnv] || config.development;

// Export the API base URL
export const API_BASE_URL = currentConfig.apiBaseUrl;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Export current environment for debugging
export const CURRENT_ENVIRONMENT = currentEnv;

// Log current configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log(`🌐 API Configuration - Environment: ${currentEnv}, Base URL: ${API_BASE_URL}`);
}
