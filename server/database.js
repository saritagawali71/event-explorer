
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "../server-data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(path.join(dataDir, "events.db"));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
      CHECK(role IN ('user', 'organizer')),
    created_at TEXT NOT NULL DEFAULT
      (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT
      (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
      ON DELETE CASCADE,
    FOREIGN KEY(event_id) REFERENCES events(id)
      ON DELETE CASCADE,
    UNIQUE(user_id, event_id)
  );

  CREATE INDEX IF NOT EXISTS
    idx_applications_event
    ON applications(event_id);

  CREATE INDEX IF NOT EXISTS
    idx_applications_user
    ON applications(user_id);
`);

const seedEvents = [
  [1, "Live Music Fest 2026", "Music", "2026-10-16", "Riverside Arena, Nashik"],
  [2, "Tech Innovators Summit", "Tech", "2026-10-23", "Convention Center, Nashik"],
  [3, "Creative Writing Workshop", "Workshops", "2026-10-30", "The Learning Hub, Nashik"],
  [4, "Food Carnival 2026", "Food & Drink", "2026-11-06", "City Grounds, Nashik"],
  [5, "Nashik Cycling Challenge", "Sports", "2026-11-14", "Gangapur Dam, Nashik"],
  [6, "Art & Culture Exhibition", "Arts", "2026-11-20", "Nashik Art Gallery"],
  [7, "24-Hour Hackathon", "Tech", "2026-11-27", "IT Campus, Nashik"],
  [8, "Wellness Retreat", "Others", "2026-12-05", "Nature's Nest, Nashik"]
];

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events
    (id, name, category, date, location)
  VALUES (?, ?, ?, ?, ?)
`);

const seed = rows => {
  db.exec("BEGIN");
  for (const row of rows) {
    insertEvent.run(...row);
  }
  db.exec("COMMIT");
};

seed(seedEvents);

module.exports = db;