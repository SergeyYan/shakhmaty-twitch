const fs = require('node:fs');
const path = require('node:path');
const files = ['index.html', 'style.css', 'app.js', 'piece-art.js', 'game-session.js', 'twitch-chat.js', 'vendor/chess.js', 'vendor/chess.LICENSE', 'README.md'];
for (const file of files) { const target = path.join(__dirname, 'dist', file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(__dirname, file), target); }
console.log('Build complete: dist/index.html (self-contained local assets)');
