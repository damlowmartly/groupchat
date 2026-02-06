// ============================================
// AMONG US STYLE MYSTERY HOUSE
// Camera Follow + First Kill = Killer System
// ============================================

const state = {
  playerId: null,
  playerName: null,
  playerAvatar: null,
  isAlive: true,
  isKiller: false,
  hasWeapon: false,
  currentWeapon: null,
  ws: null,
  players: new Map(),
  position: { x: 1000, y: 750 }, // Start in center of house
  camera: { x: 0, y: 0 },
  moveSpeed: 8,
  keys: {},
  nearbyObjects: [],
  gameStarted: false
};

const elements = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  playerNameInput: document.getElementById('player-name'),
  
  gameScreen: document.getElementById('game-screen'),
  playerAvatarDisplay: document.getElementById('player-avatar'),
  playerNameDisplay: document.getElementById('player-name-display'),
  roleDisplay: document.getElementById('role-display'),
  timerDisplay: document.getElementById('timer-display'),
  aliveCount: document.getElementById('alive-count'),
  
  gameViewport: document.getElementById('game-viewport'),
  houseGrid: document.getElementById('house-grid'),
  
  useBtn: document.getElementById('interact-btn'),
  killBtn: document.getElementById('kill-btn'),
  accuseBtn: document.getElementById('accuse-btn'),
  chatBtn: document.getElementById('chat-btn'),
  
  accuseModal: document.getElementById('accuse-modal'),
  chatModal: document.getElementById('chat-modal'),
  gameoverModal: document.getElementById('gameover-modal'),
  roleModal: document.getElementById('role-modal')
};

// ============================================
// INIT
// ============================================
function init() {
  setupLoginListeners();
  setupGameListeners();
  setupKeyboardControls();
  setupMobileControls();
  createRealisticHouse();
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
      document.getElementById('login-error').textContent = '❌ Fill all fields';
      return;
    }
    
    state.playerName = name;
    state.playerAvatar = avatarInput.value;
    state.playerId = Date.now().toString() + Math.random();
    
    showGame();
    initWebSocket();
  });
}

function showGame() {
  elements.loginScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  elements.playerAvatarDisplay.textContent = state.playerAvatar;
  elements.playerNameDisplay.textContent = state.playerName;
  
  startGameLoop();
}

// ============================================
// WEBSOCKET
// ============================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  state.ws.onopen = () => {
    console.log('Connected');
    sendWS({
      type: 'playerJoin',
      id: state.playerId,
      name: state.playerName,
      avatar: state.playerAvatar,
      x: state.position.x,
      y: state.position.y
    });
  };
  
  state.ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
  state.ws.onclose = () => setTimeout(() => initWebSocket(), 3000);
}

function sendWS(data) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'gameState':
      updateGameState(data);
      break;
    case 'playerMoved':
      updatePlayerPosition(data.id, data.x, data.y);
      break;
    case 'playerKilled':
      handlePlayerKilled(data);
      break;
    case 'firstKill':
      handleFirstKill(data);
      break;
    case 'playerAccused':
      handleAccusation(data);
      break;
    case 'chatMessage':
      showChatBubble(data.id, data.message, data.emoji);
      break;
    case 'activity':
      showActivity(data);
      break;
    case 'timerUpdate':
      updateTimer(data.time);
      break;
    case 'gameOver':
      showGameOver(data);
      break;
  }
}

function updateGameState(data) {
  data.players.forEach(p => {
    if (p.id !== state.playerId) {
      state.players.set(p.id, p);
      renderPlayer(p);
    }
  });
  
  elements.aliveCount.textContent = data.players.filter(p => p.alive).length;
  
  if (data.bloodStains) {
    data.bloodStains.forEach(b => renderBlood(b.x, b.y, b.id));
  }
  
  if (data.gameStarted) {
    state.gameStarted = true;
    elements.timerDisplay.parentElement.style.display = 'flex';
  }
}

// ============================================
// KEYBOARD CONTROLS
// ============================================
function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      state.keys[e.key.toLowerCase()] = true;
    }
    
    if (e.key.toLowerCase() === 'e') handleUseObject();
    if (e.key.toLowerCase() === 'q') handleKill();
    if (e.key === ' ') e.preventDefault();
  });
  
  document.addEventListener('keyup', (e) => {
    state.keys[e.key.toLowerCase()] = false;
  });
}

// ============================================
// MOBILE JOYSTICK
// ============================================
function setupMobileControls() {
  const joystick = document.querySelector('.joystick');
  const knob = document.querySelector('.joystick-knob');
  if (!joystick) return;
  
  let active = false;
  let startX = 0, startY = 0;
  
  joystick.addEventListener('touchstart', (e) => {
    active = true;
    const touch = e.touches[0];
    const rect = joystick.getBoundingClientRect();
    startX = rect.left + rect.width / 2;
    startY = rect.top + rect.height / 2;
  });
  
  joystick.addEventListener('touchmove', (e) => {
    if (!active) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const distance = Math.min(45, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);
    
    knob.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px))`;
    
    state.keys = {};
    if (Math.abs(dx) > 10) state.keys[dx > 0 ? 'd' : 'a'] = true;
    if (Math.abs(dy) > 10) state.keys[dy > 0 ? 's' : 'w'] = true;
  });
  
  joystick.addEventListener('touchend', () => {
    active = false;
    knob.style.transform = 'translate(-50%, -50%)';
    state.keys = {};
  });
}

// ============================================
// GAME LOOP - MOVEMENT & CAMERA
// ============================================
function startGameLoop() {
  setInterval(() => {
    if (!state.isAlive) return;
    
    let moved = false;
    const oldX = state.position.x;
    const oldY = state.position.y;
    
    if (state.keys['arrowup'] || state.keys['w']) {
      state.position.y = Math.max(50, state.position.y - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowdown'] || state.keys['s']) {
      state.position.y = Math.min(1450, state.position.y + state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowleft'] || state.keys['a']) {
      state.position.x = Math.max(50, state.position.x - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowright'] || state.keys['d']) {
      state.position.x = Math.min(1950, state.position.x + state.moveSpeed);
      moved = true;
    }
    
    if (moved) {
      updateOwnPosition();
      updateCamera();
      checkNearbyObjects();
      
      sendWS({
        type: 'playerMove',
        id: state.playerId,
        x: state.position.x,
        y: state.position.y
      });
    }
  }, 50); // 20 FPS movement
}

function updateOwnPosition() {
  let avatar = document.querySelector(`[data-player-id="${state.playerId}"]`);
  if (!avatar) {
    avatar = document.createElement('div');
    avatar.className = 'player-avatar own-player';
    avatar.dataset.playerId = state.playerId;
    avatar.innerHTML = `
      ${state.playerAvatar}
      <div class="player-name">${state.playerName}</div>
    `;
    elements.houseGrid.appendChild(avatar);
  }
  
  avatar.style.left = `${state.position.x}px`;
  avatar.style.top = `${state.position.y}px`;
}

// CAMERA FOLLOW - Among Us Style!
function updateCamera() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight - 150; // Account for HUD
  
  // Center camera on player
  state.camera.x = state.position.x - viewportWidth / 2;
  state.camera.y = state.position.y - viewportHeight / 2;
  
  // Clamp to house bounds
  state.camera.x = Math.max(0, Math.min(2000 - viewportWidth, state.camera.x));
  state.camera.y = Math.max(0, Math.min(1500 - viewportHeight, state.camera.y));
  
  elements.gameViewport.style.transform = `translate(-${state.camera.x}px, -${state.camera.y}px)`;
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
    avatar.innerHTML = `
      ${player.avatar}
      <div class="player-name">${player.name}</div>
    `;
    elements.houseGrid.appendChild(avatar);
  }
  
  avatar.style.left = `${player.x}px`;
  avatar.style.top = `${player.y}px`;
  
  if (!player.alive) avatar.classList.add('dead');
}

// ============================================
// NEARBY OBJECTS - INTERACTION
// ============================================
function checkNearbyObjects() {
  state.nearbyObjects = [];
  const range = 80;
  
  document.querySelectorAll('.furniture').forEach(obj => {
    const objX = parseInt(obj.style.left);
    const objY = parseInt(obj.style.top);
    const dx = objX - state.position.x;
    const dy = objY - state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    obj.classList.remove('nearby');
    if (distance < range) {
      obj.classList.add('nearby');
      state.nearbyObjects.push(obj);
    }
  });
  
  // Update UI
  if (state.nearbyObjects.length > 0) {
    elements.useBtn.classList.remove('disabled');
  } else {
    elements.useBtn.classList.add('disabled');
  }
  
  // Check if can kill
  const nearPlayer = findNearbyPlayer();
  if (nearPlayer && state.hasWeapon) {
    elements.killBtn.classList.remove('disabled');
  } else {
    elements.killBtn.classList.add('disabled');
  }
}

function findNearbyPlayer() {
  const range = 80;
  for (const [id, p] of state.players) {
    if (!p.alive) continue;
    const dx = p.x - state.position.x;
    const dy = p.y - state.position.y;
    if (Math.sqrt(dx * dx + dy * dy) < range) return p;
  }
  return null;
}

// ============================================
// OBJECT INTERACTIONS
// ============================================
function handleUseObject() {
  if (state.nearbyObjects.length === 0) return;
  
  const obj = state.nearbyObjects[0];
  const interaction = obj.dataset.interaction;
  const item = obj.dataset.item;
  const isWeapon = obj.classList.contains('weapon');
  
  switch (interaction) {
    case 'pickup':
      if (isWeapon) {
        state.hasWeapon = true;
        state.currentWeapon = item;
        obj.remove();
        alert(`🔪 You picked up ${item}!`);
        elements.killBtn.classList.remove('hidden');
        showChatBubble(state.playerId, '', '🔪');
      }
      break;
    case 'sit':
      showChatBubble(state.playerId, 'Chilling...', '😌');
      sendWS({ type: 'activity', playerId: state.playerId, activity: `sitting on ${item}` });
      break;
    case 'sleep':
      showChatBubble(state.playerId, 'Zzz...', '💤');
      sendWS({ type: 'activity', playerId: state.playerId, activity: `sleeping on ${item}` });
      break;
    case 'watch':
      showChatBubble(state.playerId, 'Watching TV', '📺');
      sendWS({ type: 'activity', playerId: state.playerId, activity: 'watching TV' });
      break;
    case 'eat':
      showChatBubble(state.playerId, 'Eating', '🍽️');
      sendWS({ type: 'activity', playerId: state.playerId, activity: 'eating at table' });
      break;
    case 'hide':
      showChatBubble(state.playerId, 'Hiding!', '🫣');
      sendWS({ type: 'activity', playerId: state.playerId, activity: `hiding in ${item}` });
      break;
  }
}

function showActivity(data) {
  console.log(`${data.playerId} is ${data.activity}`);
}

// ============================================
// KILL SYSTEM - FIRST KILL = KILLER
// ============================================
function handleKill() {
  const nearPlayer = findNearbyPlayer();
  if (!nearPlayer || !state.hasWeapon) return;
  
  if (confirm(`Kill ${nearPlayer.name} with ${state.currentWeapon}?`)) {
    sendWS({
      type: 'killPlayer',
      killerId: state.playerId,
      victimId: nearPlayer.id,
      weapon: state.currentWeapon,
      x: nearPlayer.x,
      y: nearPlayer.y
    });
  }
}

function handlePlayerKilled(data) {
  const player = state.players.get(data.victimId);
  if (player) {
    player.alive = false;
    renderPlayer(player);
  }
  
  if (data.victimId === state.playerId) {
    state.isAlive = false;
    alert('💀 You were killed!');
  }
  
  renderBlood(data.x, data.y, `blood-${Date.now()}`);
}

function handleFirstKill(data) {
  // First kill happened! Killer is now assigned
  if (data.killerId === state.playerId) {
    state.isKiller = true;
    elements.roleDisplay.classList.remove('hidden');
    elements.roleDisplay.textContent = '💀 YOU ARE THE KILLER';
    alert('🔪 You are now THE KILLER! Eliminate everyone before time runs out!');
  } else {
    alert(`⚠️ FIRST KILL! Someone is now the killer! Find them!`);
  }
  
  state.gameStarted = true;
  elements.timerDisplay.parentElement.style.display = 'flex';
}

function renderBlood(x, y, id) {
  if (document.querySelector(`[data-blood-id="${id}"]`)) return;
  
  const blood = document.createElement('div');
  blood.className = 'blood';
  blood.dataset.bloodId = id;
  blood.textContent = '🩸';
  blood.style.left = `${x}px`;
  blood.style.top = `${y}px`;
  blood.addEventListener('click', () => {
    alert('🔍 A blood stain! Someone was killed here.');
  });
  elements.houseGrid.appendChild(blood);
}

// ============================================
// ACCUSATION
// ============================================
function setupGameListeners() {
  elements.accuseBtn.addEventListener('click', () => {
    if (!state.isAlive || !state.gameStarted) return;
    showAccuseModal();
  });
  
  elements.chatBtn.addEventListener('click', () => {
    if (!state.isAlive) return;
    elements.chatModal.classList.remove('hidden');
  });
  
  elements.useBtn.addEventListener('click', handleUseObject);
  elements.killBtn.addEventListener('click', handleKill);
  
  document.getElementById('send-chat-btn').addEventListener('click', sendChat);
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
  });
  
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

function showAccuseModal() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  
  state.players.forEach((p, id) => {
    if (!p.alive || id === state.playerId) return;
    
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <div class="player-item-avatar">${p.avatar}</div>
      <div class="player-item-name">${p.name}</div>
    `;
    item.addEventListener('click', () => accuse(id, p.name));
    list.appendChild(item);
  });
  
  elements.accuseModal.classList.remove('hidden');
}

function accuse(targetId, targetName) {
  elements.accuseModal.classList.add('hidden');
  
  if (confirm(`Accuse ${targetName}?\n⚠️ If wrong, YOU DIE!`)) {
    sendWS({
      type: 'accusePlayer',
      accuserId: state.playerId,
      targetId: targetId
    });
  }
}

function handleAccusation(data) {
  const accuser = data.accuserId === state.playerId ? 'You' : state.players.get(data.accuserId)?.name;
  const target = data.targetId === state.playerId ? 'you' : state.players.get(data.targetId)?.name;
  
  if (data.correct) {
    alert(`✅ ${accuser} found the killer: ${target}!`);
  } else {
    alert(`❌ ${accuser} wrongly accused ${target}! ${accuser} died!`);
    if (data.accuserId === state.playerId) state.isAlive = false;
  }
}

// ============================================
// CHAT
// ============================================
function sendChat() {
  const selected = document.querySelector('.emoji-btn.selected');
  const text = document.getElementById('chat-input').value.trim();
  
  if (!selected && !text) return;
  
  const emoji = selected?.dataset.emoji || '';
  sendWS({ type: 'chatMessage', id: state.playerId, message: text, emoji: emoji });
  
  showChatBubble(state.playerId, text, emoji);
  
  elements.chatModal.classList.add('hidden');
  document.getElementById('chat-input').value = '';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
}

function showChatBubble(playerId, text, emoji) {
  const player = playerId === state.playerId 
    ? { x: state.position.x, y: state.position.y } 
    : state.players.get(playerId);
  if (!player) return;
  
  const avatar = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!avatar) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = `${emoji} ${text}`.trim();
  avatar.appendChild(bubble);
  
  setTimeout(() => bubble.remove(), 3000);
}

// ============================================
// TIMER & GAME OVER
// ============================================
function updateTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  elements.timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showGameOver(data) {
  document.getElementById('gameover-message').innerHTML = data.message;
  document.getElementById('final-stats').innerHTML = `
    <div class="stat-item"><span>Winner:</span><strong>${data.winner}</strong></div>
    <div class="stat-item"><span>Killer:</span><strong>${data.killerName || 'None'}</strong></div>
    <div class="stat-item"><span>Kills:</span><strong>${data.kills || 0}</strong></div>
  `;
  elements.gameoverModal.classList.remove('hidden');
}

document.getElementById('play-again-btn')?.addEventListener('click', () => location.reload());

// ============================================
// CREATE REALISTIC HOUSE - AMONG US STYLE
// ============================================
function createRealisticHouse() {
  // ROOMS - Realistic placement (2000x1500 house)
  const rooms = [
    // Kitchen - Top Left
    { id: 'kitchen', label: '🍳 Kitchen', x: 100, y: 100, width: 600, height: 500 },
    // Living Room - Top Right
    { id: 'living', label: '🛋️ Living Room', x: 800, y: 100, width: 700, height: 500 },
    // Hallway - Center
    { id: 'hallway', label: '🚪 Hallway', x: 600, y: 650, width: 500, height: 200, className: 'hallway' },
    // Bedroom - Bottom Left
    { id: 'bedroom', label: '🛏 Bedroom', x: 100, y: 900, width: 600, height: 500 },
    // Bathroom - Bottom Right
    { id: 'bathroom', label: '🚿 Bathroom', x: 800, y: 900, width: 700, height: 500 }
  ];
  
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = `room ${room.className || ''}`;
    div.id = `room-${room.id}`;
    div.style.left = `${room.x}px`;
    div.style.top = `${room.y}px`;
    div.style.width = `${room.width}px`;
    div.style.height = `${room.height}px`;
    div.innerHTML = `<div class="room-label">${room.label}</div>`;
    elements.houseGrid.appendChild(div);
  });
  
  // FURNITURE - Interactive objects
  const furniture = [
    // KITCHEN
    { emoji: '🔪', label: 'Knife', room: 'kitchen', x: 250, y: 200, weapon: true, interaction: 'pickup' },
    { emoji: '🧊', label: 'Fridge', room: 'kitchen', x: 450, y: 250, interaction: 'open' },
    { emoji: '🍳', label: 'Stove', room: 'kitchen', x: 300, y: 250, interaction: 'use' },
    { emoji: '🪑', label: 'Chair', room: 'kitchen', x: 350, y: 380, interaction: 'sit' },
    { emoji: '🍽️', label: 'Table', room: 'kitchen', x: 400, y: 350, interaction: 'eat' },
    
    // LIVING ROOM
    { emoji: '🛋️', label: 'Sofa', room: 'living', x: 950, y: 300, interaction: 'sit' },
    { emoji: '📺', label: 'TV', room: 'living', x: 950, y: 180, interaction: 'watch' },
    { emoji: '☕', label: 'Coffee Table', room: 'living', x: 950, y: 380, weapon: true, interaction: 'pickup' },
    { emoji: '🌷', label: 'Vase', room: 'living', x: 1200, y: 250, weapon: true, interaction: 'pickup' },
    
    // BEDROOM
    { emoji: '🛏', label: 'Bed', room: 'bedroom', x: 350, y: 1100, interaction: 'sleep' },
    { emoji: '🛌', label: 'Pillow', room: 'bedroom', x: 320, y: 1080, weapon: true, interaction: 'pickup' },
    { emoji: '🗄', label: 'Closet', room: 'bedroom', x: 550, y: 1150, interaction: 'hide' },
    { emoji: '🕯', label: 'Nightstand', room: 'bedroom', x: 450, y: 1100, interaction: 'inspect' },
    
    // BATHROOM
    { emoji: '🪥', label: 'Sink', room: 'bathroom', x: 950, y: 1100, interaction: 'use' },
    { emoji: '🪞', label: 'Mirror', room: 'bathroom', x: 950, y: 1020, interaction: 'inspect' },
    { emoji: '🚽', label: 'Toilet', room: 'bathroom', x: 1150, y: 1200, interaction: 'use' },
    
    // HALLWAY
    { emoji: '🌷', label: 'Vase', room: 'hallway', x: 750, y: 720, weapon: true, interaction: 'pickup' }
  ];
  
  furniture.forEach(item => {
    const roomEl = document.getElementById(`room-${item.room}`);
    if (!roomEl) return;
    
    const obj = document.createElement('div');
    obj.className = `furniture ${item.weapon ? 'weapon' : ''}`;
    obj.dataset.item = item.label;
    obj.dataset.interaction = item.interaction;
    obj.style.left = `${item.x}px`;
    obj.style.top = `${item.y}px`;
    obj.innerHTML = `
      ${item.emoji}
      <div class="furniture-label">${item.label}</div>
      <div class="interact-prompt">Press E</div>
    `;
    
    elements.houseGrid.appendChild(obj);
  });
}

document.addEventListener('DOMContentLoaded', init);
