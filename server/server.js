
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in .env");
}

if (process.env.NODE_ENV === "production" &&
    process.env.SESSION_SECRET.length < 32) {
  throw new Error("Use a strong production session secret.");
}

const dataDir = path.join(__dirname, "../server-data");
fs.mkdirSync(dataDir, { recursive: true });

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "20kb"
}));

app.use(session({
  name: "event.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "../style.css"));
});

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../app.js"));
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please try again later."
  }
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Please sign in first."
    });
  }
  next();
}

function requireOrganizer(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Please sign in first."
    });
  }

  if (req.session.user.role !== "organizer") {
    return res.status(403).json({
      error: "Organizer access required."
    });
  }

  next();
}

function validText(value, maxLength) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// ============================================
// AUTHENTICATION
// ============================================

app.get("/api/auth/me", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

app.post(
  "/api/auth/register",
  loginLimiter,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      if (!validText(name, 100) ||
          !validText(email, 254) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          typeof password !== "string" ||
          password.length < 8 ||
          password.length > 128) {
        return res.status(400).json({
          error: "Enter a valid name, email, and password (8–128 characters)."
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const passwordHash = await bcrypt.hash(password, 12);

      let result;

      try {
        result = db.prepare(`
          INSERT INTO users (name, email, password_hash)
          VALUES (?, ?, ?)
        `).run(name.trim(), normalizedEmail, passwordHash);
      } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
          return res.status(409).json({
            error: "An account with this email already exists."
          });
        }
        throw error;
      }

      const user = {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
        email: normalizedEmail,
        role: "user"
      };

      await regenerateSession(req);
      req.session.user = user;
      await saveSession(req);

      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/auth/login",
  loginLimiter,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!validText(email, 254) ||
          typeof password !== "string" ||
          password.length > 128) {
        return res.status(400).json({
          error: "Enter a valid email and password."
        });
      }

      const userRecord = db.prepare(`
        SELECT id, name, email, password_hash, role
        FROM users
        WHERE email = ?
      `).get(email.trim().toLowerCase());

      const matches = userRecord &&
        await bcrypt.compare(password, userRecord.password_hash);

      if (!matches) {
        return res.status(401).json({
          error: "Incorrect email or password."
        });
      }

      const user = {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role
      };

      await regenerateSession(req);
      req.session.user = user;
      await saveSession(req);

      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        error: "Unable to sign out."
      });
    }

    res.clearCookie("event.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({ message: "Signed out successfully." });
  });
});

// ============================================
// EVENT APPLICATIONS
// ============================================

app.post("/api/applications", requireAuth, (req, res) => {
  const { eventId, fullName, phone, notes = "" } = req.body;

  if (!Number.isInteger(eventId) ||
      !validText(fullName, 100) ||
      !validText(phone, 25) ||
      typeof notes !== "string" ||
      notes.length > 1000) {
    return res.status(400).json({
      error: "Please provide valid application details."
    });
  }

  const event = db.prepare(`
    SELECT id, name, date
    FROM events
    WHERE id = ?
  `).get(eventId);

  if (!event) {
    return res.status(404).json({
      error: "Event not found."
    });
  }

  if (event.date < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({
      error: "Applications for this event are closed."
    });
  }

  try {
    const result = db.prepare(`
      INSERT INTO applications
        (user_id, event_id, full_name, phone, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.session.user.id,
      eventId,
      fullName.trim(),
      phone.trim(),
      notes.trim()
    );

    res.status(201).json({
      message: "Application submitted.",
      application: {
        id: Number(result.lastInsertRowid),
        event_id: eventId,
        status: "pending"
      }
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "You have already applied for this event."
      });
    }
    throw error;
  }
});

app.get("/api/applications/mine", requireAuth, (req, res) => {
  const applications = db.prepare(`
    SELECT
      a.id,
      a.event_id,
      a.full_name,
      a.phone,
      a.notes,
      a.status,
      a.created_at,
      e.name AS event_name,
      e.date AS event_date
    FROM applications a
    JOIN events e ON e.id = a.event_id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(req.session.user.id);

  res.json({ applications });
});

// ============================================
// ORGANIZER APPLICANT MANAGEMENT
// ============================================

app.get(
  "/api/organizer/applications",
  requireOrganizer,
  (req, res) => {
    const eventId = req.query.eventId;

    let applications;

    if (eventId) {
      if (!/^\d+$/.test(eventId)) {
        return res.status(400).json({
          error: "Invalid event ID."
        });
      }

      applications = db.prepare(`
        SELECT
          a.id,
          a.event_id,
          a.full_name,
          a.phone,
          a.notes,
          a.status,
          a.created_at,
          u.email,
          e.name AS event_name
        FROM applications a
        JOIN users u ON u.id = a.user_id
        JOIN events e ON e.id = a.event_id
        WHERE a.event_id = ?
        ORDER BY a.created_at DESC
      `).all(Number(eventId));
    } else {
      applications = db.prepare(`
        SELECT
          a.id,
          a.event_id,
          a.full_name,
          a.phone,
          a.notes,
          a.status,
          a.created_at,
          u.email,
          e.name AS event_name
        FROM applications a
        JOIN users u ON u.id = a.user_id
        JOIN events e ON e.id = a.event_id
        ORDER BY a.created_at DESC
      `).all();
    }

    res.json({ applications });
  }
);

app.patch(
  "/api/organizer/applications/:id",
  requireOrganizer,
  (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id) ||
        !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid application ID or status."
      });
    }

    const result = db.prepare(`
      UPDATE applications
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Application not found."
      });
    }

    res.json({
      message: "Application status updated.",
      id,
      status
    });
  }
);

// ============================================
// ERROR HANDLING
// ============================================

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`Event Explorer running at http://localhost:${PORT}`);
});