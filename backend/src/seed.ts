import { getPool, testDbConnection } from './db.js';

async function seed() {
  console.log('[Seed] Testing database connection...');
  const connected = await testDbConnection();
  if (!connected) {
    console.error('[Seed] Database not reachable. Please check your .env credentials.');
    process.exit(1);
  }

  const pool = getPool();

  console.log('[Seed] Ensuring schema exists in Petro DB...');

  // 1. Players Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oxygen_players (
      uuid VARCHAR(36) PRIMARY KEY,
      name VARCHAR(32),
      elo INT DEFAULT 1000,
      wins INT DEFAULT 0,
      losses INT DEFAULT 0,
      win_streak INT DEFAULT 0,
      best_win_streak INT DEFAULT 0,
      kills INT DEFAULT 0,
      deaths INT DEFAULT 0,
      last_seen BIGINT
    )
  `);

  // 2. Per-Kit Elo Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oxygen_player_kit_elo (
      uuid VARCHAR(36),
      kit_name VARCHAR(64),
      elo INT DEFAULT 1000,
      wins INT DEFAULT 0,
      PRIMARY KEY (uuid, kit_name)
    )
  `);

  // 3. Official Kits Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oxygen_kits (
      kit_name VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(128),
      icon VARCHAR(64),
      slot INT,
      vanilla_mode BOOLEAN,
      data_yaml LONGTEXT,
      updated_at BIGINT
    )
  `);

  // 4. Arenas Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oxygen_arenas (
      arena_name VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(128),
      world VARCHAR(64),
      min_pos VARCHAR(64),
      max_pos VARCHAR(64),
      spawn1 VARCHAR(128),
      spawn2 VARCHAR(128),
      modes VARCHAR(255),
      enabled BOOLEAN,
      updated_at BIGINT
    )
  `);

  console.log('[Seed] Seeding official kits...');
  const kits = [
    ['nodebuff', 'NoDebuff', 'POTION', 0, false],
    ['boxing', 'Boxing', 'DIAMOND_SWORD', 1, false],
    ['gapple', 'Gapple', 'GOLDEN_APPLE', 2, true],
    ['crystal', 'Crystal PvP', 'END_CRYSTAL', 3, true],
    ['combo', 'Combo', 'RAW_FISH', 4, false],
    ['builduhc', 'BuildUHC', 'LAVA_BUCKET', 5, true],
    ['sumo', 'Sumo', 'LEAD', 6, false],
    ['elytra', 'Elytra Firework', 'ELYTRA', 7, true],
  ];

  for (const [kName, dName, icon, slot, vm] of kits) {
    await pool.query(
      `INSERT INTO oxygen_kits (kit_name, display_name, icon, slot, vanilla_mode, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), icon = VALUES(icon), slot = VALUES(slot)`,
      [kName, dName, icon, slot, vm, Date.now()]
    );
  }

  console.log('[Seed] Seeding sample competitive duelists...');
  const players = [
    { uuid: '853c80ef-3c37-49fd-aa49-938b674adae6', name: 'VortexPvP', elo: 2450, wins: 342, losses: 18, streak: 24, best: 38, kills: 1042, deaths: 89 },
    { uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Nightshade', elo: 2380, wins: 310, losses: 27, streak: 12, best: 29, kills: 915, deaths: 112 },
    { uuid: '616ab5b0-c1c4-4b4b-91bb-7a0e37a28e9f', name: 'NebulaStrike', elo: 2210, wins: 280, losses: 35, streak: 9, best: 21, kills: 804, deaths: 140 },
    { uuid: 'd380b0fe-25e6-42bb-98a9-46e3cb269d27', name: 'AeroFlame', elo: 2145, wins: 220, losses: 42, streak: 7, best: 18, kills: 630, deaths: 165 },
    { uuid: 'b4a8e6f1-32e1-4567-89ab-cdef01234567', name: 'Zephyr', elo: 2050, wins: 195, losses: 48, streak: 5, best: 16, kills: 570, deaths: 180 },
    { uuid: 'c5b9f7a2-43f2-5678-90bc-def012345678', name: 'CyberBlade', elo: 1920, wins: 160, losses: 55, streak: 4, best: 14, kills: 480, deaths: 195 },
    { uuid: 'd6caf8b3-5403-6789-01cd-ef0123456789', name: 'FrostBite', elo: 1810, wins: 140, losses: 62, streak: 3, best: 11, kills: 410, deaths: 210 },
    { uuid: 'e7db09c4-6514-789a-12de-f0123456789a', name: 'Solaris', elo: 1720, wins: 118, losses: 70, streak: 2, best: 9, kills: 350, deaths: 230 },
  ];

  for (const p of players) {
    await pool.query(
      `INSERT INTO oxygen_players (uuid, name, elo, wins, losses, win_streak, best_win_streak, kills, deaths, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), elo = VALUES(elo), wins = VALUES(wins), losses = VALUES(losses)`,
      [p.uuid, p.name, p.elo, p.wins, p.losses, p.streak, p.best, p.kills, p.deaths, Date.now()]
    );

    // Also seed a kit Elo row
    await pool.query(
      `INSERT INTO oxygen_player_kit_elo (uuid, kit_name, elo, wins)
       VALUES (?, 'nodebuff', ?, ?)
       ON DUPLICATE KEY UPDATE elo = VALUES(elo), wins = VALUES(wins)`,
      [p.uuid, p.elo + 20, Math.floor(p.wins * 0.5)]
    );
  }

  console.log('[Seed] Seeding completed successfully!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('[Seed Error]', e);
  process.exit(1);
});
