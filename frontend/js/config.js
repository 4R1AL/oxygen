/**
 * Oxygen PvP Nepal - Frontend Configuration
 */
const CONFIG = {
  // Brand details
  serverName: "Oxygen PvP Nepal",
  serverIp: "mcnp.network",
  discordUrl: "https://discord.gg/",
  storeUrl: "https://store.mcnp.network",

  // API Base URL:
  // When deployed on Cloudflare Pages, functions are served directly under /api/*
  // In local development, falls back to http://localhost:3001 if testing standalone Node server
  apiBaseUrl: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8788')
    ? 'http://localhost:3001'
    : '',

  // Fallback to local / mock data if API is currently unreachable
  fallbackEnabled: true,

  // Auto-refresh interval (ms) for live status and leaderboard
  refreshIntervalMs: 12000,
};

// Allow overriding via localStorage for testing
if (typeof localStorage !== 'undefined' && localStorage.getItem('oxygen_api_url')) {
  CONFIG.apiBaseUrl = localStorage.getItem('oxygen_api_url');
}

window.OXYGEN_CONFIG = CONFIG;
