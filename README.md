# Event Explorer

Event Explorer is a full-stack event discovery and application platform built with Node.js, Express, SQLite, and vanilla JavaScript.

## Live Demo

The live deployment URL will appear here after the Render service is created.

## Features

- Browse and filter local events
- Create an account and sign in securely
- Submit event applications
- Review application status
- Organizer application management

## Run Locally

```powershell
npm install
npm start
```

Open http://localhost:3000.

Create a `.env` file with:

```text
SESSION_SECRET=replace-this-with-a-long-random-value
NODE_ENV=development
PORT=3000
```

## Deploy

Use the Render Blueprint configuration in `render.yaml`:

1. Open [Render](https://render.com) and choose **New > Blueprint**.
2. Select this GitHub repository.
3. Render will create the web service, environment variables, and persistent SQLite disk.
4. Copy the generated service URL into the **Live Demo** section above.

The persistent disk is required because the SQLite database is stored in `server-data/events.db`.