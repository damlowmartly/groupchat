// ============================================
// MYSTERY HOUSE GAME SERVER
// ============================================

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// GAME STATE
// ============================================
const gameState = {
  players: new Map(),
  killer: null,
  firstKillHappened: false,
  bloodStains: [],
  gameStarted: false,
  roundTime: 0,
  timerInterval: null
};

// ============================================
// WEBSOCKET CONNECTION
// ============================================
wss.on('connection', (ws) => {
  console.log('New player connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(ws, data);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    for (const [id, player] of gameState.players) {
      if (player.ws === ws) {
        console.log(`${player.name} disconnected`);
        gameState.players.delete(id);
        broadcastGameState();
        break;
      }
    }
  });
});

// ============================================
// MESSAGE ROUTER
// ============================================
function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'playerJoin':
      handlePlayerJoin(ws, data);
      break;
    case 'playerMove':
      handlePlayerMove(data);
      break;
    case 'killPlayer':
      handleKillPlayer(data);
      break;
    case 'accusePlayer':
      handleAccusePlayer(data);
      break;
    case 'chatMessage':
      handleChatMessage(data);
      break;
    case 'pickupWeapon':
      handlePickupWeapon(data);
      break;
    case 'playerHide':
      handlePlayerHide(data);
      break;
    case 'toggleDoor':
      handleToggleDoor(data);
      break;
  }
}

// ============================================
// PLAYER JOIN
// ============================================
function handlePlayerJoin(ws, data) {
  const player = {
    ws,
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    x: data.x,
    y: data.y,
    alive: true,
    role: null
  };

  gameState.players.set(data.id, player);
  console.log(`${data.name} joined`);

  sendToPlayer(ws, {
    type: 'gameState',
    players: Array.from(gameState.players.values()),
    bloodStains: gameState.bloodStains,
    gameStarted: gameState.gameStarted
  });

  broadcastGameState();
}

// ============================================
// PLAYER MOVE
// ============================================
function handlePlayerMove(data) {
  const player = gameState.players.get(data.id);
  if (!player || !player.alive) return;

  player.x = data.x;
  player.y = data.y;

  broadcastExcept(data.id, {
    type: 'playerMoved',
    id: data.id,
    x: data.x,
    y: data.y
  });
}

// ============================================
// KILL PLAYER (FIRST KILL CREATES KILLER)
// ============================================
function handleKillPlayer(data) {
  const killer = gameState.players.get(data.killerId);
  const victim = gameState.players.get(data.victimId);

  if (!killer || !victim || !victim.alive) return;

  victim.alive = false;

  if (!gameState.firstKillHappened) {
    gameState.firstKillHappened = true;
    gameState.killer = killer.id;
    killer.role = 'killer';
    gameState.gameStarted = true;
    gameState.roundTime = 300;
    startTimer();

    broadcast({
      type: 'firstKill',
      killerId: killer.id,
      victimId: victim.id
    });
  }

  gameState.bloodStains.push({
    id: `blood-${Date.now()}`,
    x: data.x,
    y: data.y
  });

  broadcast({
    type: 'playerKilled',
    killerId: killer.id,
    victimId: victim.id,
    x: data.x,
    y: data.y
  });

  checkGameOver();
}

// ============================================
// TIMER
// ============================================
function startTimer() {
  if (gameState.timerInterval) return;

  gameState.timerInterval = setInterval(() => {
    gameState.roundTime--;

    broadcast({
      type: 'timerUpdate',
      time: gameState.roundTime
    });

    if (gameState.roundTime <= 0) {
      endGame('innocents', '⏰ Time up! Innocents survived!', null);
    }
  }, 1000);
}

// ============================================
// CHECK GAME OVER
// ============================================
function checkGameOver() {
  const alive = [...gameState.players.values()].filter(p => p.alive);
  const innocents = alive.filter(p => p.role !== 'killer');

  if (innocents.length === 0 && gameState.killer) {
    const killer = gameState.players.get(gameState.killer);
    endGame('killer', `💀 ${killer?.name} eliminated everyone!`, killer?.name);
  }
}

// ============================================
// ACCUSATION
// ============================================
function handleAccusePlayer(data) {
  const accuser = gameState.players.get(data.accuserId);
  const target = gameState.players.get(data.targetId);

  if (!accuser || !target || !accuser.alive || !target.alive) return;

  if (target.role === 'killer') {
    target.alive = false;
    endGame('innocents', `⚡ ${accuser.name} caught the killer!`, target.name);
  } else {
    accuser.alive = false;
    checkGameOver();
  }

  broadcast({
    type: 'playerAccused',
    accuserId: data.accuserId,
    targetId: data.targetId,
    correct: target.role === 'killer'
  });
}

// ============================================
// CHAT
// ============================================
function handleChatMessage(data) {
  const player = gameState.players.get(data.id);
  if (!player || !player.alive) return;

  broadcast({
    type: 'chatMessage',
    id: data.id,
    message: data.message,
    emoji: data.emoji
  });
}

// ============================================
// INTERACTIONS
// ============================================
function handlePickupWeapon(data) {
  const player = gameState.players.get(data.playerId);
  if (!player || !player.alive) return;

  player.weapon = data.weapon;

  broadcast({
    type: 'weaponPickup',
    playerId: data.playerId,
    weapon: data.weapon
  });
}

function handlePlayerHide(data) {
  const player = gameState.players.get(data.playerId);
  if (!player || !player.alive) return;

  broadcast({
    type: 'playerHiding',
    playerId: data.playerId,
    location: data.location
  });
}

function handleToggleDoor(data) {
  broadcast({
    type: 'doorToggle',
    doorId: data.doorId,
    locked: data.locked
  });
}

// ============================================
// GAME OVER
// ============================================
function endGame(winner, message, killerName) {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }

  broadcast({
    type: 'gameOver',
    winner,
    message,
    killerName,
    kills: gameState.bloodStains.length
  });

  console.log('Game Over:', message);
}

// ============================================
// BROADCAST HELPERS
// ============================================
function broadcast(data) {
  const msg = JSON.stringify(data);
  gameState.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msg);
    }
  });
}

function broadcastExcept(excludeId, data) {
  const msg = JSON.stringify(data);
  gameState.players.forEach((p, id) => {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msg);
    }
  });
}

function sendToPlayer(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastGameState() {
  broadcast({
    type: 'gameState',
    players: [...gameState.players.values()],
    bloodStains: gameState.bloodStains
  });
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Mystery House running on port ${PORT}`);
});
