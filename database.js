const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'zvz.db'));

// Ativa foreign keys e WAL mode para melhor performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    -- Composições (Brawl, Clap, Press, etc.)
    CREATE TABLE IF NOT EXISTS comps (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    UNIQUE NOT NULL,
      description TEXT    DEFAULT '',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Armas de cada composição
    CREATE TABLE IF NOT EXISTS weapons (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      comp_id   INTEGER NOT NULL,
      name      TEXT    NOT NULL,
      role      TEXT    NOT NULL DEFAULT 'DPS',
      build_url TEXT    DEFAULT '',
      pt        INTEGER DEFAULT 1,
      FOREIGN KEY (comp_id) REFERENCES comps(id) ON DELETE CASCADE
    );


    -- Eventos ZvZ pingados
    CREATE TABLE IF NOT EXISTS zvz_events (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      comp_id        INTEGER NOT NULL,
      channel_id     TEXT    NOT NULL,
      message_id     TEXT    DEFAULT NULL,
      caller_id      TEXT    NOT NULL,
      scheduled_time TEXT    NOT NULL,
      description    TEXT    DEFAULT '',
      tipo           TEXT    DEFAULT 'normal',
      status         TEXT    DEFAULT 'open',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (comp_id) REFERENCES comps(id)
    );

    -- Cache de stats dos players (Murder Ledger / API Albion)
    CREATE TABLE IF NOT EXISTS player_stats (
      user_id      TEXT    PRIMARY KEY,
      user_name    TEXT    NOT NULL,
      albion_id    TEXT    DEFAULT NULL,
      stats_json   TEXT    DEFAULT '[]',
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Confirmações de presença dos players
    CREATE TABLE IF NOT EXISTS confirmations (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id           INTEGER NOT NULL,
      user_id            TEXT    NOT NULL,
      user_name          TEXT    NOT NULL,
      weapon1_id         INTEGER DEFAULT NULL,
      weapon2_id         INTEGER DEFAULT NULL,
      assigned_weapon_id INTEGER DEFAULT NULL,
      confirmed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, user_id),
      FOREIGN KEY (event_id)           REFERENCES zvz_events(id) ON DELETE CASCADE,
      FOREIGN KEY (weapon1_id)         REFERENCES weapons(id),
      FOREIGN KEY (weapon2_id)         REFERENCES weapons(id),
      FOREIGN KEY (assigned_weapon_id) REFERENCES weapons(id)
    );
  `);
  // Migracao segura: adiciona colunas novas se nao existirem
  try { db.exec('ALTER TABLE zvz_events ADD COLUMN tipo TEXT DEFAULT \'normal\''); } catch(e) {}
  // Migracao segura: adiciona coluna pt se nao existir
  try { db.exec('ALTER TABLE weapons ADD COLUMN pt INTEGER DEFAULT 1'); } catch(e) {}
  try { db.exec('CREATE TABLE IF NOT EXISTS player_stats (user_id TEXT PRIMARY KEY, user_name TEXT NOT NULL, albion_id TEXT DEFAULT NULL, stats_json TEXT DEFAULT \'[]\', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch(e) {}
  console.log('✅ Banco de dados inicializado!');
}

// ─── COMPS ────────────────────────────────────────────────────────────────────

function createComp(name, description = '') {
  return db.prepare('INSERT INTO comps (name, description) VALUES (?, ?)').run(name, description);
}

function getAllComps() {
  return db.prepare('SELECT * FROM comps ORDER BY name').all();
}

function getCompByName(name) {
  return db.prepare('SELECT * FROM comps WHERE LOWER(name) = LOWER(?)').get(name);
}

function getCompById(id) {
  return db.prepare('SELECT * FROM comps WHERE id = ?').get(id);
}

function deleteComp(id) {
  // Deleta em cascata manualmente
  const events = db.prepare('SELECT id FROM zvz_events WHERE comp_id = ?').all(id);
  for (const e of events) {
    db.prepare('DELETE FROM confirmations WHERE event_id = ?').run(e.id);
  }
  db.prepare('DELETE FROM zvz_events WHERE comp_id = ?').run(id);
  db.prepare('DELETE FROM weapons WHERE comp_id = ?').run(id);
  return db.prepare('DELETE FROM comps WHERE id = ?').run(id);
}

// ─── WEAPONS ──────────────────────────────────────────────────────────────────

function addWeapon(comp_id, name, role, build_url = '', pt = 1) {
  return db.prepare(
    'INSERT INTO weapons (comp_id, name, role, build_url, pt) VALUES (?, ?, ?, ?, ?)'
  ).run(comp_id, name, role, build_url, pt);
}

function getWeaponsByComp(comp_id) {
  return db.prepare(
    'SELECT * FROM weapons WHERE comp_id = ? ORDER BY pt, role, name'
  ).all(comp_id);
}

function getWeaponById(id) {
  return db.prepare('SELECT * FROM weapons WHERE id = ?').get(id);
}

function removeWeapon(id) {
  return db.prepare('DELETE FROM weapons WHERE id = ?').run(id);
}

// ─── ZVZ EVENTS ───────────────────────────────────────────────────────────────

function createEvent(comp_id, channel_id, caller_id, scheduled_time, description, tipo = 'normal') {
  return db.prepare(`
    INSERT INTO zvz_events (comp_id, channel_id, caller_id, scheduled_time, description, tipo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(comp_id, channel_id, caller_id, scheduled_time, description, tipo);
}

function setEventMessageId(event_id, message_id) {
  return db.prepare('UPDATE zvz_events SET message_id = ? WHERE id = ?').run(message_id, event_id);
}

function getEventById(id) {
  return db.prepare('SELECT * FROM zvz_events WHERE id = ?').get(id);
}

function closeEvent(id) {
  return db.prepare("UPDATE zvz_events SET status = 'closed' WHERE id = ?").run(id);
}

// ─── CONFIRMATIONS ────────────────────────────────────────────────────────────

function upsertConfirmationSimples(event_id, user_id, user_name) {
  return db.prepare(`
    INSERT INTO confirmations (event_id, user_id, user_name, weapon1_id, weapon2_id)
    VALUES (?, ?, ?, NULL, NULL)
    ON CONFLICT(event_id, user_id) DO UPDATE SET user_name = excluded.user_name
  `).run(event_id, user_id, user_name);
}

function upsertConfirmation(event_id, user_id, user_name, weapon1_id, weapon2_id) {
  return db.prepare(`
    INSERT INTO confirmations (event_id, user_id, user_name, weapon1_id, weapon2_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET
      weapon1_id = excluded.weapon1_id,
      weapon2_id = excluded.weapon2_id,
      assigned_weapon_id = NULL
  `).run(event_id, user_id, user_name, weapon1_id, weapon2_id);
}

function getConfirmationsByEvent(event_id) {
  return db.prepare(`
    SELECT
      c.*,
      w1.name AS weapon1_name,
      w2.name AS weapon2_name,
      wa.name AS assigned_weapon_name
    FROM confirmations c
    LEFT JOIN weapons w1 ON c.weapon1_id  = w1.id
    LEFT JOIN weapons w2 ON c.weapon2_id  = w2.id
    LEFT JOIN weapons wa ON c.assigned_weapon_id = wa.id
    WHERE c.event_id = ?
    ORDER BY c.user_name
  `).all(event_id);
}

function getConfirmation(event_id, user_id) {
  return db.prepare(
    'SELECT * FROM confirmations WHERE event_id = ? AND user_id = ?'
  ).get(event_id, user_id);
}

function assignWeapon(event_id, user_id, weapon_id) {
  return db.prepare(
    'UPDATE confirmations SET assigned_weapon_id = ? WHERE event_id = ? AND user_id = ?'
  ).run(weapon_id, event_id, user_id);
}

function removeConfirmation(event_id, user_id) {
  return db.prepare(
    'DELETE FROM confirmations WHERE event_id = ? AND user_id = ?'
  ).run(event_id, user_id);
}

// ─── PLAYER STATS CACHE ──────────────────────────────────────────────────────

function getPlayerStats(user_id) {
  const row = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(user_id);
  if (!row) return null;
  try { row.stats = JSON.parse(row.stats_json); } catch(e) { row.stats = []; }
  return row;
}

function upsertPlayerStats(user_id, user_name, albion_id, stats) {
  return db.prepare(`
    INSERT INTO player_stats (user_id, user_name, albion_id, stats_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      user_name  = excluded.user_name,
      albion_id  = excluded.albion_id,
      stats_json = excluded.stats_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(user_id, user_name, albion_id, JSON.stringify(stats));
}

function isStatsStale(user_id, maxAgeHours = 24) {
  const row = db.prepare('SELECT updated_at FROM player_stats WHERE user_id = ?').get(user_id);
  if (!row) return true;
  const age = (Date.now() - new Date(row.updated_at).getTime()) / 3600000;
  return age > maxAgeHours;
}

module.exports = {
  initialize,
  // Comps
  createComp, getAllComps, getCompByName, getCompById, deleteComp,
  // Weapons
  addWeapon, getWeaponsByComp, getWeaponById, removeWeapon,
  // Events
  createEvent, setEventMessageId, getEventById, closeEvent,
  // Player Stats Cache
  getPlayerStats, upsertPlayerStats, isStatsStale,
  // Confirmations
  upsertConfirmation, upsertConfirmationSimples, getConfirmationsByEvent, getConfirmation, assignWeapon, removeConfirmation
};
