# Logic Legends Club · Code Quest

A secure programming-learning game. Levels 1-12 of the C Jungle are playable.

## Run it (Windows, Mac or Linux)
1. Install Node.js 18 or newer from nodejs.org
2. Open a terminal in this folder and run: `node server.js`
3. Open http://localhost:3000 in a browser.
4. Phones on the same Wi-Fi can open http://YOUR-COMPUTER-IP:3000

## What is secure already
- Passwords hashed with scrypt and a random salt; never stored in plain text
- Random session tokens (stored hashed), 7-day expiry, login rate limiting
- Lives, 1-hour cooldown, timer, hints, retries, scores and medals are decided on the server
- Correct answers and explanations never reach the app until a student has answered
- Security headers (CSP, no framing, nosniff); request size limit

## Turning it into store apps
- Android and iOS: wrap the web app with Capacitor (capacitorjs.com) and point it at your hosted server
- Windows and macOS: wrap with Electron or Tauri
- Host the server on a cloud VM behind HTTPS (required for real use; add a reverse proxy such as Caddy or Nginx)

## Before real students use it
- Replace data/db.json with PostgreSQL and add backups
- Add email verification and password reset, and parental consent for minors
- Write levels 13-2000 (add them to questions.json and the story list in public/index.html)
