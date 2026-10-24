/**
 * Oxygen PvP Frontend Configuration
 * Configure your backend REST API URL here.
 */
const CONFIG = {
  // Brand details
  serverName: "Oxygen PvP",
  serverIp: "play.samratnagarkoti.com.np",
  discordUrl: "https://discord.gg/",
  storeUrl: "https://store.samratnagarkoti.com.np",

  // Primary backend REST API URL.
  // In production with Cloudflare: set this to your backend domain (e.g. 'https://api.samratnagarkoti.com.np')
  // In development: defaults to localhost:3001
  apiBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://api.samratnagarkoti.com.np',

  // Fallback to local / mock data if API is currently unreachable
  fallbackEnabled: true,

  // Auto-refresh interval (ms) for live status and leaderboard
  refreshIntervalMs: 12000,
};

// Allow overriding via localStorage for easy testing without modifying code
if (typeof localStorage !== 'undefined' && localStorage.getItem('oxygen_api_url')) {
  CONFIG.apiBaseUrl = localStorage.getItem('oxygen_api_url');
}

window.OXYGEN_CONFIG = CONFIG;
