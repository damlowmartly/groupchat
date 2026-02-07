// ===============================================================
// MYSTERY HOUSE - COMPLETE GAME SCRIPT
// Fog of War + Camera Follow + First Kill = Killer + Weapon Sync
// ===============================================================

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
  position: { x: 1200, y: 900 },
  camera: { x: 0, y: 0 },
  moveSpeed: 8,
  keys: {},
  nearbyObjects: [],
  gameStarted: false,
  exploredRooms: new Set() // FOG OF WAR
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
  gameoverModal: document.getElementById('gameover-modal')
};

// ===============================================================
// INIT
// ===============================================================
function init() {
  setupLoginListeners();
  setupGameListeners();
  setupKeyboardControls();
  setupMobileControls();
  createRealisticHouse();
}

// ===============================================================
// LOGIN
// ===============================================================
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

// ===============================================================
// WEBSOCKET
// ===============================================================
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
    case 'weaponPickedUp':
      // WEAPON GLOBALLY HIDDEN
      hideWeapon(data.weapon, data.x, data.y);
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

// ===============================================================
// KEYBOARD CONTROLS
// ===============================================================
function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
      state.keys[key] = true;
    }
    
    if (key === 'e') handleUseObject();
    if (key === 'q') handleKill();
  });
  
  document.addEventListener('keyup', (e) => {
    state.keys[e.key.toLowerCase()] = false;
  });
}

// ===============================================================
// MOBILE JOYSTICK
// ===============================================================
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
    const distance = Math.min(55, Math.sqrt(dx * dx + dy * dy));
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

// ===============================================================
// GAME LOOP - MOVEMENT & CAMERA
// ===============================================================
function startGameLoop() {
  setInterval(() => {
    if (!state.isAlive) return;
    
    let moved = false;
    
    if (state.keys['arrowup'] || state.keys['w']) {
      state.position.y = Math.max(50, state.position.y - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowdown'] || state.keys['s']) {
      state.position.y = Math.min(1750, state.position.y + state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowleft'] || state.keys['a']) {
      state.position.x = Math.max(50, state.position.x - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowright'] || state.keys['d']) {
      state.position.x = Math.min(2350, state.position.x + state.moveSpeed);
      moved = true;
    }
    
    if (moved) {
      updateOwnPosition();
      updateCamera();
      checkRoomVisibility(); // FOG OF WAR
      checkNearbyObjects();
      
      sendWS({
        type: 'playerMove',
        id: state.playerId,
        x: state.position.x,
        y: state.position.y
      });
    }
  }, 50);
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
  const viewportHeight = window.innerHeight - 200;
  
  state.camera.x = state.position.x - viewportWidth / 2;
  state.camera.y = state.position.y - viewportHeight / 2;
  
  state.camera.x = Math.max(0, Math.min(2400 - viewportWidth, state.camera.x));
  state.camera.y = Math.max(0, Math.min(1800 - viewportHeight, state.camera.y));
  
  elements.gameViewport.style.transform = `translate(-${state.camera.x}px, -${state.camera.y}px)`;
}

// FOG OF WAR - Reveal rooms as you enter
function checkRoomVisibility() {
  document.querySelectorAll('.room').forEach(room => {
    const roomX = parseInt(room.style.left);
    const roomY = parseInt(room.style.top);
    const roomW = parseInt(room.style.width);
    const roomH = parseInt(room.style.height);
    
    const inRoom = state.position.x >= roomX && 
                   state.position.x <= roomX + roomW &&
                   state.position.y >= roomY && 
                   state.position.y <= roomY + roomH;
    
    if (inRoom && !state.exploredRooms.has(room.id)) {
      state.exploredRooms.add(room.id);
      room.classList.add('explored'); // REMOVE FOG
    }
  });
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

// ===============================================================
// NEARBY OBJECTS
// ===============================================================
function checkNearbyObjects() {
  state.nearbyObjects = [];
  const range = 100;
  
  document.querySelectorAll('.furniture:not(.picked-up)').forEach(obj => {
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
  
  if (state.nearbyObjects.length > 0) {
    elements.useBtn.classList.remove('disabled');
  } else {
    elements.useBtn.classList.add('disabled');
  }
  
  const nearPlayer = findNearbyPlayer();
  if (nearPlayer && state.hasWeapon) {
    elements.killBtn.classList.remove('disabled');
  } else {
    elements.killBtn.classList.add('disabled');
  }
}

function findNearbyPlayer() {
  const range = 100;
  for (const [id, p] of state.players) {
    if (!p.alive) continue;
    const dx = p.x - state.position.x;
    const dy = p.y - state.position.y;
    if (Math.sqrt(dx * dx + dy * dy) < range) return p;
  }
  return null;
}

// ===============================================================
// OBJECT INTERACTIONS
// ===============================================================
function handleUseObject() {
  if (state.nearbyObjects.length === 0) return;
  
  const obj = state.nearbyObjects[0];
  const interaction = obj.dataset.interaction;
  const item = obj.dataset.item;
  const isWeapon = obj.classList.contains('weapon');
  
  switch (interaction) {
    case 'pickup':
      if (isWeapon) {
        // HIDE WEAPON GLOBALLY
        obj.classList.add('picked-up');
        
        state.hasWeapon = true;
        state.currentWeapon = item;
        alert(`🔪 You picked up ${item}!`);
        elements.killBtn.classList.remove('hidden');
        showChatBubble(state.playerId, '', '🔪');
        
        sendWS({
          type: 'pickupWeapon',
          playerId: state.playerId,
          weapon: item,
          x: parseInt(obj.style.left),
          y: parseInt(obj.style.top)
        });
      }
      break;
    case 'sit':
      showChatBubble(state.playerId, 'Chilling...', '😌');
      break;
    case 'sleep':
      showChatBubble(state.playerId, 'Zzz...', '💤');
      break;
    case 'watch':
      showChatBubble(state.playerId, 'Watching TV', '📺');
      break;
    case 'eat':
      showChatBubble(state.playerId, 'Eating', '🍽️');
      break;
    case 'hide':
      showChatBubble(state.playerId, 'Hiding!', '🫣');
      break;
  }
}

// WEAPON SYNC - Hide for everyone
function hideWeapon(weaponName, x, y) {
  document.querySelectorAll('.furniture').forEach(f => {
    if (f.dataset.item === weaponName && 
        parseInt(f.style.left) === x && 
        parseInt(f.style.top) === y) {
      f.classList.add('picked-up');
    }
  });
}

// ===============================================================
// KILL SYSTEM
// ===============================================================
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
  if (data.killerId === state.playerId) {
    state.isKiller = true;
    elements.roleDisplay.classList.remove('hidden');
    elements.roleDisplay.textContent = '💀 YOU ARE THE KILLER';
    alert('🔪 You are now THE KILLER! Eliminate everyone!');
  } else {
    alert(`⚠️ FIRST KILL! Someone is the killer!`);
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
    alert('🔍 Blood stain! Someone was killed here.');
  });
  elements.houseGrid.appendChild(blood);
}

// ===============================================================
// GAME LISTENERS
// ===============================================================
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
  
  document.getElementById('play-again-btn')?.addEventListener('click', () => location.reload());
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

// ===============================================================
// CHAT
// ===============================================================
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

// ===============================================================
// TIMER & GAME OVER
// ===============================================================
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

// ===============================================================
// CREATE REALISTIC HOUSE
// ===============================================================
function createRealisticHouse() {
  const rooms = [
    { id: 'kitchen', label: '🍳 Kitchen', x: 150, y: 150, width: 600, height: 500, className: 'kitchen' },
    { id: 'living', label: '🛋️ Living Room', x: 850, y: 150, width: 700, height: 550, className: 'living' },
    { id: 'hallway', label: '🚪 Hallway', x: 650, y: 750, width: 600, height: 250, className: 'hallway' },
    { id: 'bedroom', label: '🛏 Bedroom', x: 150, y: 1050, width: 600, height: 600, className: 'bedroom' },
    { id: 'bathroom', label: '🚿 Bathroom', x: 850, y: 1050, width: 700, height: 600, className: 'bathroom' }
  ];
  
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = `room ${room.className}`;
    div.id = `room-${room.id}`;
    div.style.left = `${room.x}px`;
    div.style.top = `${room.y}px`;
    div.style.width = `${room.width}px`;
    div.style.height = `${room.height}px`;
    div.innerHTML = `<div class="room-label">${room.label}</div>`;
    elements.houseGrid.appendChild(div);
  });
  
  const furniture = [
    // Kitchen
    { emoji: '🔪', label: 'Knife', x: 300, y: 250, weapon: true, interaction: 'pickup' },
    { emoji: '🧊', label: 'Fridge', x: 500, y: 300, interaction: 'open' },
    { emoji: '🍳', label: 'Stove', x: 350, y: 280, interaction: 'use' },
    { emoji: '🪑', label: 'Chair', x: 400, y: 450, interaction: 'sit' },
    { emoji: '🍽️', label: 'Table', x: 450, y: 420, interaction: 'eat' },
    
    // Living Room
    { emoji: '🛋️', label: 'Sofa', x: 1050, y: 380, interaction: 'sit' },
    { emoji: '📺', label: 'TV', x: 1050, y: 230, interaction: 'watch' },
    { emoji: '☕', label: 'Coffee Table', x: 1050, y: 480, weapon: true, interaction: 'pickup' },
    { emoji: '🌷', label: 'Vase', x: 1300, y: 320, weapon: true, interaction: 'pickup' },
    
    // Bedroom
    { emoji: '🛏', label: 'Bed', x: 350, y: 1250, interaction: 'sleep' },
    { emoji: '🛌', label: 'Pillow', x: 320, y: 1230, weapon: true, interaction: 'pickup' },
    { emoji: '🗄', label: 'Closet', x: 550, y: 1350, interaction: 'hide' },
    { emoji: '🕯', label: 'Nightstand', x: 450, y: 1250, interaction: 'inspect' },
    
    // Bathroom
    { emoji: '🪥', label: 'Sink', x: 1000, y: 1250, interaction: 'use' },
    { emoji: '🪞', label: 'Mirror', x: 1000, y: 1170, interaction: 'inspect' },
    { emoji: '🚽', label: 'Toilet', x: 1250, y: 1400, interaction: 'use' },
    
    // Hallway
    { emoji: '🌷', label: 'Vase', x: 850, y: 850, weapon: true, interaction: 'pickup' }
  ];
  
  furniture.forEach(item => {
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
