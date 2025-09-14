const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;


app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;

wss.on('connection', (socket) => {
  socket.clientId = nextClientId++;
  socket.userName = null;

  console.log(`Client ${socket.clientId} connected`);

 
  socket.send(JSON.stringify({
    type: 'assign-id',
    id: socket.clientId
  }));

  socket.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      console.log("❌ Invalid JSON received.");
      return;
    }

    if (data.type === 'set-name') {
      socket.userName = data.name;
      console.log(`✅ Client ${socket.clientId} set name: ${socket.userName}`);
      return;
    }

    if (!socket.userName) {
      console.log(`❌ Client ${socket.clientId} tried to send a message before setting a name.`);
      return;
    }

    const payload = {
      type: data.type || 'chat',
      from: socket.clientId,
      name: socket.userName
    };

    if (data.text) {
      payload.text = data.text;
    }

    if (data.image) {
      payload.image = data.image;
    }

   
    if (data.video) {
      payload.video = data.video;
    }
    if (data.html) {
      payload.html = data.html;
    }

  
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });

  socket.on('close', () => {
    console.log(`Client ${socket.clientId} disconnected`);

 
    const payload = {
      type: 'user-disconnected',
      from: socket.clientId,
      name: socket.userName
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });
});

server.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});

