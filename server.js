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
  players: new Map(), // id -> {ws, name, avatar, x, y, alive, role}
  killer: null,
  targetPlayer: null,
  bloodStains: [],
  gameStarted: false,
  roundTime: 600, // 10 minutes in seconds
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
  console.log(`${data.name} joined the game (${gameState.players.size} players)`);
  
  // Send current game state to new player
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
    bloodStains: gameState.bloodStains
  });
  
  // Start game when we have enough players (minimum 2)
  if (gameState.players.size >= 2 && !gameState.gameStarted) {
    setTimeout(() => startGame(), 2000);
  } else if (gameState.gameStarted) {
    // Assign role to late joiner (always innocent)
    sendToPlayer(ws, {
      type: 'roleAssigned',
      role: 'innocent',
      targetId: null
    });
  }
  
  broadcastGameState();
}

// ============================================
// START GAME
// ============================================
function startGame() {
  if (gameState.gameStarted) return;
  
  gameState.gameStarted = true;
  console.log('Starting game with', gameState.players.size, 'players');
  
  // Randomly select killer
  const playerIds = Array.from(gameState.players.keys());
  const killerIndex = Math.floor(Math.random() * playerIds.length);
  const killerId = playerIds[killerIndex];
  
  gameState.killer = killerId;
  const killerPlayer = gameState.players.get(killerId);
  killerPlayer.role = 'killer';
  
  // Optionally assign a target (random other player)
  const nonKillers = playerIds.filter(id => id !== killerId);
  const targetIndex = Math.floor(Math.random() * nonKillers.length);
  gameState.targetPlayer = nonKillers[targetIndex];
  
  console.log(`Killer: ${killerPlayer.name}, Target: ${gameState.players.get(gameState.targetPlayer)?.name || 'Anyone'}`);
  
  // Assign roles to all players
  gameState.players.forEach((player, id) => {
    const isKiller = id === killerId;
    player.role = isKiller ? 'killer' : 'innocent';
    
    sendToPlayer(player.ws, {
      type: 'roleAssigned',
      role: player.role,
      targetId: isKiller ? gameState.targetPlayer : null
    });
  });
  
  // Start timer
  startTimer();
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
      endGame('innocents', 'Time\'s up! The innocents survive!');
    }
  }, 1000);
}

// ============================================
// PLAYER MOVEMENT
// ============================================
function handlePlayerMove(data) {
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
  
  // Check if killer won
  const aliveInnocents = Array.from(gameState.players.values()).filter(p => p.alive && p.role === 'innocent');
  if (aliveInnocents.length === 0) {
    endGame('killer', `💀 ${killer.name} (the killer) eliminated everyone!`);
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
    
    endGame('innocents', `⚡ ${accuser.name} correctly identified ${target.name} as the killer!`);
  } else {
    // Wrong accusation - accuser dies
    accuser.alive = false;
    
    broadcast({
      type: 'playerAccused',
      accuserId: data.accuserId,
      targetId: data.targetId,
      correct: false
    });
    
    // Check if killer is last one alive
    const aliveInnocents = Array.from(gameState.players.values()).filter(p => p.alive && p.role === 'innocent');
    if (aliveInnocents.length === 0) {
      const killer = gameState.players.get(gameState.killer);
      endGame('killer', `💀 ${killer.name} (the killer) wins by elimination!`);
    }
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
function endGame(winner, message) {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  
  const killer = gameState.players.get(gameState.killer);
  const killerName = killer ? killer.name : 'Unknown';
  const deaths = Array.from(gameState.players.values()).filter(p => !p.alive).length;
  const duration = formatTime(600 - gameState.roundTime);
  
  broadcast({
    type: 'gameOver',
    winner: winner === 'killer' ? 'KILLER WINS' : 'INNOCENTS WIN',
    message: message,
    killerName: killerName,
    deaths: deaths,
    duration: duration
  });
  
  console.log('Game Over:', message);
  
  // Reset game after 30 seconds
  setTimeout(() => resetGame(), 30000);
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
