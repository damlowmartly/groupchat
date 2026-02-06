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
    // Find and remove disconnected player
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
// MESSAGE HANDLERS
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
    ws: ws,
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    x: data.x,
    y: data.y,
    alive: true,
    role: null
  };
  
  gameState.players.set(data.id, player);
  console.log(`${data.name} joined (${gameState.players.size} players)`);
  
  // Send current state
  sendToPlayer(ws, {
    type: 'gameState',
    players: Array.from(gameState.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      x: p.x,
      y: p.y,
      alive: p.alive
    })),
    bloodStains: gameState.bloodStains,
    gameStarted: gameState.gameStarted
  });
  
  broadcastGameState();
}

// ============================================
// KILL PLAYER - FIRST KILL = KILLER
// ============================================
function handleKillPlayer(data) {
  const killer = gameState.players.get(data.killerId);
  const victim = gameState.players.get(data.victimId);
  
  if (!killer || !victim || !victim.alive) return;
  
  console.log(`${killer.name} killed ${victim.name} with ${data.weapon}`);
  
  victim.alive = false;
  
  // FIRST KILL? This person becomes THE KILLER!
  if (!gameState.firstKillHappened) {
    gameState.firstKillHappened = true;
    gameState.killer = data.killerId;
    killer.role = 'killer';
    gameState.gameStarted = true;
    gameState.roundTime = 300; // 5 minutes timer starts
    
    console.log(`🔪 FIRST KILL! ${killer.name} is now THE KILLER`);
    
    // Notify everyone
    broadcast({
      type: 'firstKill',
      killerId: data.killerId,
      victimId: data.victimId
    });
    
    // Start timer
    startTimer();
  }
  
  // Add blood
  gameState.bloodStains.push({
    id: `blood-${Date.now()}`,
    x: data.x,
    y: data.y
  });
  
  // Broadcast kill
  broadcast({
    type: 'playerKilled',
    killerId: data.killerId,
    victimId: data.victimId,
    x: data.x,
    y: data.y
  });
  
  // Check win condition
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
      const killer = gameState.players.get(gameState.killer);
      endGame('innocents', '⏰ Time up! Innocents survived!', killer?.name);
    }
  }, 1000);
}
  const player = gameState.players.get(data.id);
  if (!player || !player.alive) return;
  
  player.x = data.x;
  player.y = data.y;
  
  // Broadcast movement to all other players
  broadcastExcept(data.id, {
    type: 'playerMoved',
    id: data.id,
    x: data.x,
    y: data.y
  });
}

// ============================================
// KILL PLAYER
// ============================================
function handleKillPlayer(data) {
  const killer = gameState.players.get(data.killerId);
  const victim = gameState.players.get(data.victimId);
  
  if (!killer || !victim || killer.role !== 'killer' || !victim.alive) {
    return;
  }
  
  console.log(`${killer.name} killed ${victim.name}`);
  
  victim.alive = false;
  
  // Add blood stain
  gameState.bloodStains.push({
    id: `blood-${Date.now()}`,
    x: data.x,
    y: data.y
  });
  
  // Broadcast kill event
  broadcast({
    type: 'playerKilled',
    killerId: data.killerId,
    victimId: data.victimId,
    x: data.x,
    y: data.y
  });
  
// ============================================
// CHECK GAME OVER
// ============================================
function checkGameOver() {
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
  const aliveInnocents = alivePlayers.filter(p => p.role !== 'killer');
  
  if (aliveInnocents.length === 0) {
    // Killer wins
    const killer = gameState.players.get(gameState.killer);
    endGame('killer', `💀 ${killer?.name || 'The Killer'} eliminated everyone!`, killer?.name);
  } else if (alivePlayers.length === 1 && !gameState.killer) {
    // No killer yet, last person standing
    endGame('innocents', '✅ Everyone survived! No killer emerged.', 'None');
  }
}

// ============================================
// ACCUSATION
// ============================================
function handleAccusePlayer(data) {
  const accuser = gameState.players.get(data.accuserId);
  const target = gameState.players.get(data.targetId);
  
  if (!accuser || !target || !accuser.alive || !target.alive) {
    return;
  }
  
  const correct = target.role === 'killer';
  
  console.log(`${accuser.name} accused ${target.name} - ${correct ? 'CORRECT' : 'WRONG'}`);
  
  if (correct) {
    // Correct accusation - killer dies
    target.alive = false;
    
    broadcast({
      type: 'playerAccused',
      accuserId: data.accuserId,
      targetId: data.targetId,
      correct: true
    });
    
    const killer = gameState.players.get(gameState.killer);
    endGame('innocents', `⚡ ${accuser.name} caught the killer!`, killer?.name);
  } else {
    // Wrong accusation - accuser dies
    accuser.alive = false;
    
    broadcast({
      type: 'playerAccused',
      accuserId: data.accuserId,
      targetId: data.targetId,
      correct: false
    });
    
    checkGameOver();
  }
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
// FURNITURE INTERACTIONS
// ============================================
function handlePickupWeapon(data) {
  const player = gameState.players.get(data.playerId);
  if (!player || !player.alive) return;
  
  player.weapon = data.weapon;
  console.log(`${player.name} picked up ${data.weapon}`);
  
  broadcast({
    type: 'weaponPickup',
    playerId: data.playerId,
    weapon: data.weapon
  });
}

function handlePlayerHide(data) {
  const player = gameState.players.get(data.playerId);
  if (!player || !player.alive) return;
  
  player.hiding = true;
  player.hideLocation = data.location;
  console.log(`${player.name} is hiding in ${data.location}`);
  
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
  
  const kills = gameState.bloodStains.length;
  
  broadcast({
    type: 'gameOver',
    winner: winner === 'killer' ? 'KILLER WINS' : 'INNOCENTS WIN',
    message: message,
    killerName: killerName,
    kills: kills
  });
  
  console.log('Game Over:', message);
}

function resetGame() {
  gameState.killer = null;
  gameState.targetPlayer = null;
  gameState.bloodStains = [];
  gameState.gameStarted = false;
  gameState.roundTime = 600;
  
  // Reset all players
  gameState.players.forEach(player => {
    player.alive = true;
    player.role = null;
    player.x = 100 + Math.random() * 200;
    player.y = 100 + Math.random() * 200;
  });
  
  if (gameState.players.size >= 2) {
    startGame();
  }
}

// ============================================
// BROADCAST FUNCTIONS
// ============================================
function broadcast(data) {
  const message = JSON.stringify(data);
  gameState.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

function broadcastExcept(excludeId, data) {
  const message = JSON.stringify(data);
  gameState.players.forEach((player, id) => {
    if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
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
    players: Array.from(gameState.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      x: p.x,
      y: p.y,
      alive: p.alive
    })),
    bloodStains: gameState.bloodStains
  });
}

// ============================================
// UTILITIES
// ============================================
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Mystery House Game Server running on port ${PORT}`);
  console.log(`🏠 Game starts with minimum 2 players`);
});
