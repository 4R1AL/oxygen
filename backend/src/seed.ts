import { testDbConnection } from './db.js';

async function seed() {
  console.log('[Seed] Testing Pterodactyl Live Sync connection...');
  const connected = await testDbConnection();
  if (!connected) {
    console.error('[Seed] Pterodactyl API not reachable. Check PTERO_API_KEY.');
    process.exit(1);
  }

  console.log('[Seed] Live Sync verified successfully!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('[Seed Error]', e);
  process.exit(1);
});
