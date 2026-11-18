const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

let gameState = {
  mapUrl: null,
  drawings: [],
  diceHistory: [],
  characters: [],
  musicUrl: null
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// Увеличиваем лимит размера сообщения для картинок (по умолчанию 100 МБ)
const wss = new WebSocketServer({ server, maxPayload: 50 * 1024 * 1024 });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'init',
    state: gameState
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'draw') {
        gameState.drawings.push(data.line);
        broadcast({ type: 'draw', line: data.line }, ws);
      }
      else if (data.type === 'clear_drawings') {
        gameState.drawings = [];
        broadcast({ type: 'clear_drawings' }, null);
      }
      else if (data.type === 'map') {
        gameState.mapUrl = data.url;
        broadcast({ type: 'map', url: data.url }, null);
      }
      else if (data.type === 'roll') {
        gameState.diceHistory.push(data.roll);
        broadcast({ type: 'roll', roll: data.roll }, ws);
      }
      else if (data.type === 'char') {
        gameState.characters.push(data.char);
        broadcast({ type: 'char', char: data.char }, ws);
      }
      else if (data.type === 'remove_char') {
        gameState.characters.splice(data.index, 1);
        broadcast({ type: 'remove_char', index: data.index }, null);
      }
      else if (data.type === 'music') {
        gameState.musicUrl = data.url;
        broadcast({ type: 'music', url: data.url }, null);
      }
    } catch (e) {
      console.error('Ошибка парсинга сообщения:', e);
    }
  });
});

function broadcast(data, senderWs) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client !== senderWs) {
      client.send(msg);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
