// ============================================
// MYSTERY HOUSE GAME - CLIENT
// ============================================

const state = {
  playerId: null,
  playerName: null,
  playerAvatar: null,
  role: null, // 'killer' or 'innocent'
  isAlive: true,
  ws: null,
  players: new Map(),
  position: { x: 100, y: 100 },
  gridSize: 40,
  moveInterval: null,
  currentDirection: null
};

const elements = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  playerNameInput: document.getElementById('player-name'),
  loginError: document.getElementById('login-error'),
  
  gameScreen: document.getElementById('game-screen'),
  playerAvatarDisplay: document.getElementById('player-avatar'),
  playerNameDisplay: document.getElementById('player-name-display'),
  roleDisplay: document.getElementById('role-display'),
  timerDisplay: document.getElementById('timer-display'),
  aliveCount: document.getElementById('alive-count'),
  houseGrid: document.getElementById('house-grid'),
  
  killBtn: document.getElementById('kill-btn'),
  accuseBtn: document.getElementById('accuse-btn'),
  interactBtn: document.getElementById('interact-btn'),
  chatBtn: document.getElementById('chat-btn'),
  
  dpadBtns: document.querySelectorAll('.dpad-btn'),
  
  accuseModal: document.getElementById('accuse-modal'),
  chatModal: document.getElementById('chat-modal'),
  gameoverModal: document.getElementById('gameover-modal'),
  roleModal: document.getElementById('role-modal'),
  
  playerList: document.getElementById('player-list'),
  chatInput: document.getElementById('chat-input'),
  sendChatBtn: document.getElementById('send-chat-btn'),
  roleReveal: document.getElementById('role-reveal'),
  gameoverMessage: document.getElementById('gameover-message'),
  finalStats: document.getElementById('final-stats'),
  playAgainBtn: document.getElementById('play-again-btn'),
  startGameBtn: document.getElementById('start-game-btn')
};

// ============================================
// INITIALIZATION
// ============================================
function init() {
  setupLoginListeners();
  setupGameListeners();
  setupControls();
  createHouse();
}

// ============================================
// LOGIN
// ============================================
function setupLoginListeners() {
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = elements.playerNameInput.value.trim();
    const avatarInput = document.querySelector('input[name="avatar"]:checked');
    
    if (!name || !avatarInput) {
      elements.loginError.textContent = '❌ Please enter name and choose avatar';
      return;
    }
    
    state.playerName = name;
    state.playerAvatar = avatarInput.value;
    state.playerId = Date.now().toString();
    
    showGame();
    initWebSocket();
  });
}

function showGame() {
  elements.loginScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  elements.playerAvatarDisplay.textContent = state.playerAvatar;
  elements.playerNameDisplay.textContent = state.playerName;
}

// ============================================
// WEBSOCKET
// ============================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  state.ws = new WebSocket(wsUrl);
  
  state.ws.onopen = () => {
    console.log('Connected to game server');
    sendWS({
      type: 'playerJoin',
      id: state.playerId,
      name: state.playerName,
      avatar: state.playerAvatar,
      x: state.position.x,
      y: state.position.y
    });
  };
  
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };
  
  state.ws.onclose = () => {
    console.log('Disconnected from server');
    setTimeout(() => initWebSocket(), 3000);
  };
}

function sendWS(data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'gameState':
      updateGameState(data);
      break;
    case 'roleAssigned':
      assignRole(data.role, data.targetId);
      break;
    case 'playerMoved':
      updatePlayerPosition(data.id, data.x, data.y);
      break;
    case 'playerKilled':
      handlePlayerKilled(data);
      break;
    case 'playerAccused':
      handleAccusation(data);
      break;
    case 'chatMessage':
      showChatBubble(data.id, data.message, data.emoji);
      break;
    case 'gameOver':
      showGameOver(data);
      break;
    case 'timerUpdate':
      updateTimer(data.time);
      break;
  }
}

// ============================================
// GAME STATE
// ============================================
function updateGameState(data) {
  // Update players
  data.players.forEach(player => {
    if (player.id !== state.playerId) {
      state.players.set(player.id, player);
      renderPlayer(player);
    }
  });
  
  // Update alive count
  const aliveCount = data.players.filter(p => p.alive).length;
  elements.aliveCount.textContent = aliveCount;
  
  // Render blood stains
  if (data.bloodStains) {
    data.bloodStains.forEach(blood => renderBlood(blood.x, blood.y, blood.id));
  }
}

function assignRole(role, targetId) {
  state.role = role;
  
  const isKiller = role === 'killer';
  
  if (isKiller) {
    elements.roleDisplay.classList.remove('hidden');
    elements.roleDisplay.textContent = '💀 KILLER';
    elements.killBtn.classList.remove('hidden');
  }
  
  // Show role reveal
  elements.roleReveal.innerHTML = `
    <span class="role-emoji">${isKiller ? '💀' : '🕵️'}</span>
    <div class="role-title">${isKiller ? 'You are the KILLER!' : 'You are INNOCENT'}</div>
    <div class="role-description">
      ${isKiller 
        ? `Your target: ${targetId ? getPlayerName(targetId) : 'Anyone'}. Kill them before time runs out! Use the ☠️ button when close to a player.`
        : 'Find the killer and accuse them using the ⚡ button. But be careful - if you\'re wrong, you die!'}
    </div>
  `;
  
  elements.roleModal.classList.remove('hidden');
}

function getPlayerName(id) {
  const player = state.players.get(id);
  return player ? player.name : 'Unknown';
}

// ============================================
// MOVEMENT
// ============================================
function setupControls() {
  // D-Pad (mobile)
  elements.dpadBtns.forEach(btn => {
    const direction = btn.dataset.direction;
    if (!direction) return;
    
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startMoving(direction);
    });
    
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopMoving();
    });
    
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startMoving(direction);
    });
    
    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      stopMoving();
    });
  });
  
  // Keyboard (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    
    let direction = null;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') direction = 'up';
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') direction = 'down';
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') direction = 'left';
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') direction = 'right';
    
    if (direction) {
      e.preventDefault();
      startMoving(direction);
    }
  });
  
  document.addEventListener('keyup', (e) => {
    const direction = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (direction.includes(e.key)) {
      e.preventDefault();
      stopMoving();
    }
  });
}

function startMoving(direction) {
  if (state.moveInterval || !state.isAlive) return;
  
  state.currentDirection = direction;
  move();
  state.moveInterval = setInterval(move, 100);
}

function stopMoving() {
  if (state.moveInterval) {
    clearInterval(state.moveInterval);
    state.moveInterval = null;
    state.currentDirection = null;
  }
}

function move() {
  if (!state.currentDirection || !state.isAlive) return;
  
  const speed = state.gridSize;
  let newX = state.position.x;
  let newY = state.position.y;
  
  switch (state.currentDirection) {
    case 'up':
      newY = Math.max(50, newY - speed);
      break;
    case 'down':
      newY = Math.min(window.innerHeight - 250, newY + speed);
      break;
    case 'left':
      newX = Math.max(50, newX - speed);
      break;
    case 'right':
      newX = Math.min(window.innerWidth - 50, newX + speed);
      break;
  }
  
  state.position.x = newX;
  state.position.y = newY;
  
  updateOwnPosition();
  
  sendWS({
    type: 'playerMove',
    id: state.playerId,
    x: newX,
    y: newY
  });
  
  checkNearbyPlayers();
}

function updateOwnPosition() {
  let ownAvatar = document.querySelector(`[data-player-id="${state.playerId}"]`);
  if (!ownAvatar) {
    ownAvatar = document.createElement('div');
    ownAvatar.className = 'player-avatar';
    ownAvatar.dataset.playerId = state.playerId;
    ownAvatar.textContent = state.playerAvatar;
    elements.houseGrid.appendChild(ownAvatar);
  }
  
  ownAvatar.style.left = `${state.position.x}px`;
  ownAvatar.style.top = `${state.position.y}px`;
}

function updatePlayerPosition(id, x, y) {
  const player = state.players.get(id);
  if (player) {
    player.x = x;
    player.y = y;
    renderPlayer(player);
  }
}

function renderPlayer(player) {
  let avatar = document.querySelector(`[data-player-id="${player.id}"]`);
  if (!avatar) {
    avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.dataset.playerId = player.id;
    avatar.textContent = player.avatar;
    elements.houseGrid.appendChild(avatar);
  }
  
  avatar.style.left = `${player.x}px`;
  avatar.style.top = `${player.y}px`;
  
  if (!player.alive) {
    avatar.classList.add('dead');
  }
}

// ============================================
// GAME ACTIONS
// ============================================
function setupGameListeners() {
  // Kill button
  elements.killBtn.addEventListener('click', () => {
    const nearbyPlayer = findNearbyPlayer();
    if (nearbyPlayer && state.role === 'killer' && state.isAlive) {
      if (confirm(`Kill ${nearbyPlayer.name}?`)) {
        sendWS({
          type: 'killPlayer',
          killerId: state.playerId,
          victimId: nearbyPlayer.id,
          x: nearbyPlayer.x,
          y: nearbyPlayer.y
        });
      }
    }
  });
  
  // Accuse button
  elements.accuseBtn.addEventListener('click', () => {
    if (!state.isAlive) return;
    showAccuseModal();
  });
  
  // Chat button
  elements.chatBtn.addEventListener('click', () => {
    if (!state.isAlive) return;
    elements.chatModal.classList.remove('hidden');
  });
  
  // Send chat
  elements.sendChatBtn.addEventListener('click', sendChat);
  
  // Emoji buttons
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  
  // Start game button
  elements.startGameBtn.addEventListener('click', () => {
    elements.roleModal.classList.add('hidden');
  });
  
  // Play again button
  elements.playAgainBtn.addEventListener('click', () => {
    window.location.reload();
  });
}

function checkNearbyPlayers() {
  const nearby = findNearbyPlayer();
  if (nearby && state.role === 'killer' && state.isAlive) {
    elements.killBtn.style.opacity = '1';
  } else if (state.role === 'killer') {
    elements.killBtn.style.opacity = '0.5';
  }
}

function findNearbyPlayer() {
  const range = 80;
  for (const [id, player] of state.players) {
    if (!player.alive) continue;
    const dx = player.x - state.position.x;
    const dy = player.y - state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < range) {
      return player;
    }
  }
  return null;
}

function handlePlayerKilled(data) {
  const player = state.players.get(data.victimId);
  if (player) {
    player.alive = false;
    renderPlayer(player);
  }
  
  if (data.victimId === state.playerId) {
    state.isAlive = false;
    alert('💀 You have been killed!');
  }
  
  renderBlood(data.x, data.y, `blood-${Date.now()}`);
  
  // Update alive count
  const aliveCount = Array.from(state.players.values()).filter(p => p.alive).length + (state.isAlive ? 1 : 0);
  elements.aliveCount.textContent = aliveCount;
}

function renderBlood(x, y, id) {
  let blood = document.querySelector(`[data-blood-id="${id}"]`);
  if (!blood) {
    blood = document.createElement('div');
    blood.className = 'blood';
    blood.dataset.bloodId = id;
    blood.textContent = '🩸';
    blood.style.left = `${x}px`;
    blood.style.top = `${y}px`;
    blood.addEventListener('click', () => {
      alert('🔍 Blood stain found! Someone was killed here.');
    });
    elements.houseGrid.appendChild(blood);
  }
}

// ============================================
// ACCUSATION
// ============================================
function showAccuseModal() {
  elements.playerList.innerHTML = '';
  
  state.players.forEach((player, id) => {
    if (!player.alive || id === state.playerId) return;
    
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <div class="player-item-avatar">${player.avatar}</div>
      <div class="player-item-info">
        <div class="player-item-name">${player.name}</div>
      </div>
    `;
    item.addEventListener('click', () => accuse(id, player.name));
    elements.playerList.appendChild(item);
  });
  
  elements.accuseModal.classList.remove('hidden');
}

function accuse(targetId, targetName) {
  elements.accuseModal.classList.add('hidden');
  
  if (confirm(`Accuse ${targetName} of being the killer?\n\n⚠️ If wrong, YOU DIE!`)) {
    sendWS({
      type: 'accusePlayer',
      accuserId: state.playerId,
      targetId: targetId
    });
  }
}

function handleAccusation(data) {
  const accuser = data.accuserId === state.playerId ? 'You' : getPlayerName(data.accuserId);
  const target = data.targetId === state.playerId ? 'you' : getPlayerName(data.targetId);
  
  if (data.correct) {
    alert(`✅ ${accuser} correctly accused ${target}! The killer has been found!`);
  } else {
    alert(`❌ ${accuser} wrongly accused ${target}! ${accuser} died!`);
    
    if (data.accuserId === state.playerId) {
      state.isAlive = false;
    }
  }
  
  // Update player states
  const deadId = data.correct ? data.targetId : data.accuserId;
  const deadPlayer = state.players.get(deadId);
  if (deadPlayer) {
    deadPlayer.alive = false;
    renderPlayer(deadPlayer);
  }
}

// ============================================
// CHAT
// ============================================
function sendChat() {
  const selectedEmoji = document.querySelector('.emoji-btn.selected');
  const text = elements.chatInput.value.trim();
  
  if (!selectedEmoji && !text) return;
  
  const emoji = selectedEmoji ? selectedEmoji.dataset.emoji : '';
  const message = text || emoji;
  
  sendWS({
    type: 'chatMessage',
    id: state.playerId,
    message: text,
    emoji: emoji
  });
  
  showChatBubble(state.playerId, text, emoji);
  
  elements.chatModal.classList.add('hidden');
  elements.chatInput.value = '';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
}

function showChatBubble(playerId, text, emoji) {
  const player = playerId === state.playerId ? { x: state.position.x, y: state.position.y } : state.players.get(playerId);
  if (!player) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = `${emoji} ${text}`.trim();
  bubble.style.left = `${player.x}px`;
  bubble.style.top = `${player.y - 60}px`;
  
  elements.houseGrid.appendChild(bubble);
  
  setTimeout(() => bubble.remove(), 3000);
}

// ============================================
// TIMER
// ============================================
function updateTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  elements.timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// GAME OVER
// ============================================
function showGameOver(data) {
  elements.gameoverMessage.innerHTML = data.message;
  
  elements.finalStats.innerHTML = `
    <div class="stat-item">
      <span>Winner:</span>
      <strong>${data.winner}</strong>
    </div>
    <div class="stat-item">
      <span>Killer was:</span>
      <strong>${data.killerName}</strong>
    </div>
    <div class="stat-item">
      <span>Victims:</span>
      <strong>${data.deaths}</strong>
    </div>
    <div class="stat-item">
      <span>Game time:</span>
      <strong>${data.duration}</strong>
    </div>
  `;
  
  elements.gameoverModal.classList.remove('hidden');
}

// ============================================
// HOUSE CREATION - REALISTIC LAYOUT
// ============================================
function createHouse() {
  const width = window.innerWidth;
  const height = window.innerHeight - 200; // Account for HUD and controls
  
  // Define rooms with realistic positions
  const rooms = [
    // HALLWAY (Center connector)
    {
      id: 'hallway',
      emoji: '🚪',
      label: 'Hallway',
      x: width * 0.35,
      y: height * 0.35,
      width: width * 0.3,
      height: height * 0.3,
      className: 'hallway'
    },
    
    // KITCHEN (Top-left)
    {
      id: 'kitchen',
      emoji: '🍳',
      label: 'Kitchen',
      x: width * 0.05,
      y: height * 0.05,
      width: width * 0.4,
      height: height * 0.35
    },
    
    // LIVING ROOM (Top-right)
    {
      id: 'living',
      emoji: '🛋️',
      label: 'Living Room',
      x: width * 0.55,
      y: height * 0.05,
      width: width * 0.4,
      height: height * 0.35
    },
    
    // BEDROOM (Bottom-left)
    {
      id: 'bedroom',
      emoji: '🛏',
      label: 'Bedroom',
      x: width * 0.05,
      y: height * 0.6,
      width: width * 0.4,
      height: height * 0.35
    },
    
    // BATHROOM (Bottom-right)
    {
      id: 'bathroom',
      emoji: '🚿',
      label: 'Bathroom',
      x: width * 0.55,
      y: height * 0.6,
      width: width * 0.4,
      height: height * 0.35
    }
  ];
  
  // Create room elements
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = `room ${room.className || ''}`;
    div.id = `room-${room.id}`;
    div.style.left = `${room.x}px`;
    div.style.top = `${room.y}px`;
    div.style.width = `${room.width}px`;
    div.style.height = `${room.height}px`;
    div.innerHTML = `<div class="room-label">${room.emoji} ${room.label}</div>`;
    elements.houseGrid.appendChild(div);
  });
  
  // Add furniture and objects
  createFurniture();
  createDoors();
}

// ============================================
// FURNITURE & OBJECTS
// ============================================
function createFurniture() {
  const furniture = [
    // KITCHEN OBJECTS
    { emoji: '🔪', label: 'Knife', room: 'kitchen', x: '20%', y: '20%', weapon: true, interaction: 'pickup' },
    { emoji: '🧊', label: 'Fridge', room: 'kitchen', x: '70%', y: '30%', interaction: 'open' },
    { emoji: '🍳', label: 'Stove', room: 'kitchen', x: '30%', y: '25%', interaction: 'use' },
    { emoji: '🪑', label: 'Chair', room: 'kitchen', x: '50%', y: '60%', interaction: 'sit' },
    { emoji: '🪑', label: 'Chair', room: 'kitchen', x: '60%', y: '70%', interaction: 'sit' },
    
    // LIVING ROOM OBJECTS
    { emoji: '🛋️', label: 'Sofa', room: 'living', x: '50%', y: '50%', interaction: 'sit' },
    { emoji: '📺', label: 'TV', room: 'living', x: '50%', y: '20%', interaction: 'watch' },
    { emoji: '☕', label: 'Coffee Table', room: 'living', x: '50%', y: '60%', weapon: true, interaction: 'pickup' },
    { emoji: '🌷', label: 'Vase', room: 'living', x: '70%', y: '30%', weapon: true, interaction: 'pickup' },
    
    // BEDROOM OBJECTS
    { emoji: '🛏', label: 'Bed', room: 'bedroom', x: '50%', y: '50%', interaction: 'sleep' },
    { emoji: '🛌', label: 'Pillow', room: 'bedroom', x: '45%', y: '45%', weapon: true, interaction: 'pickup' },
    { emoji: '🗄', label: 'Closet', room: 'bedroom', x: '80%', y: '50%', interaction: 'hide' },
    { emoji: '🕯', label: 'Nightstand', room: 'bedroom', x: '65%', y: '40%', interaction: 'inspect' },
    
    // BATHROOM OBJECTS
    { emoji: '🪥', label: 'Sink', room: 'bathroom', x: '30%', y: '40%', interaction: 'use' },
    { emoji: '🪞', label: 'Mirror', room: 'bathroom', x: '30%', y: '20%', interaction: 'inspect' },
    { emoji: '🚽', label: 'Toilet', room: 'bathroom', x: '70%', y: '60%', interaction: 'use' },
    
    // HALLWAY OBJECTS
    { emoji: '🌷', label: 'Vase', room: 'hallway', x: '30%', y: '30%', weapon: true, interaction: 'pickup' }
  ];
  
  furniture.forEach(item => {
    const roomEl = document.getElementById(`room-${item.room}`);
    if (!roomEl) return;
    
    const furnitureEl = document.createElement('div');
    furnitureEl.className = `furniture ${item.weapon ? 'weapon' : ''}`;
    furnitureEl.dataset.item = item.label;
    furnitureEl.dataset.interaction = item.interaction;
    furnitureEl.style.left = item.x;
    furnitureEl.style.top = item.y;
    furnitureEl.textContent = item.emoji;
    
    // Add label
    const label = document.createElement('div');
    label.className = 'furniture-label';
    label.textContent = item.label;
    furnitureEl.appendChild(label);
    
    // Click handler
    furnitureEl.addEventListener('click', () => handleFurnitureClick(item));
    
    roomEl.appendChild(furnitureEl);
  });
}

// ============================================
// DOORS
// ============================================
function createDoors() {
  const doors = [
    // Hallway to Kitchen
    { from: 'hallway', x: '0%', y: '30%' },
    // Hallway to Living Room
    { from: 'hallway', x: '100%', y: '30%' },
    // Hallway to Bedroom
    { from: 'hallway', x: '30%', y: '100%' },
    // Hallway to Bathroom
    { from: 'hallway', x: '70%', y: '100%' }
  ];
  
  doors.forEach((door, index) => {
    const roomEl = document.getElementById(`room-${door.from}`);
    if (!roomEl) return;
    
    const doorEl = document.createElement('div');
    doorEl.className = 'door';
    doorEl.dataset.doorId = `door-${index}`;
    doorEl.style.left = door.x;
    doorEl.style.top = door.y;
    
    doorEl.addEventListener('click', () => {
      doorEl.classList.toggle('locked');
      const locked = doorEl.classList.contains('locked');
      sendWS({
        type: 'toggleDoor',
        doorId: `door-${index}`,
        locked: locked
      });
    });
    
    roomEl.appendChild(doorEl);
  });
}

// ============================================
// FURNITURE INTERACTION
// ============================================
function handleFurnitureClick(item) {
  if (!state.isAlive) return;
  
  switch (item.interaction) {
    case 'pickup':
      if (item.weapon) {
        alert(`🔪 You picked up ${item.label}! You can now use it as a weapon.`);
        sendWS({
          type: 'pickupWeapon',
          playerId: state.playerId,
          weapon: item.label
        });
      } else {
        alert(`📦 You picked up ${item.label}`);
      }
      break;
      
    case 'sit':
      alert(`🪑 You sit on the ${item.label} and chill for a moment.`);
      showChatBubble(state.playerId, '', '😌');
      break;
      
    case 'sleep':
      alert(`😴 You lie down on the ${item.label} and rest...`);
      showChatBubble(state.playerId, '', '💤');
      break;
      
    case 'watch':
      alert(`📺 You watch TV for a while. Relaxing!`);
      showChatBubble(state.playerId, '', '📺');
      break;
      
    case 'hide':
      alert(`🗄 You hide in the ${item.label}!`);
      sendWS({
        type: 'playerHide',
        playerId: state.playerId,
        location: item.label
      });
      break;
      
    case 'inspect':
      alert(`🔍 You inspect the ${item.label}. Nothing suspicious here.`);
      break;
      
    case 'open':
      alert(`🧊 You open the ${item.label}.`);
      break;
      
    case 'use':
      alert(`✋ You use the ${item.label}.`);
      break;
  }
}

// ============================================
// START GAME
// ============================================
document.addEventListener('DOMContentLoaded', init);
