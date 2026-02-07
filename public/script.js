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
  exploredRooms: new Set(), // FOG OF WAR
  collectedKeys: [], // KEYS COLLECTED
  currentRoom: null, // CURRENT ROOM PLAYER IS IN
  unlockedDoors: [], // DOORS PLAYER HAS UNLOCKED
  isHiding: false // HIDING IN CLOSET
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
  keysDisplay: document.getElementById('keys-display'),
  
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
    case 'keyPickedUp':
      // KEY GLOBALLY HIDDEN
      hideKey(data.keyFor, data.x, data.y);
      break;
    case 'doorUnlocked':
      // DOOR UNLOCKED FOR ALL PLAYERS
      unlockDoorGlobally(data.roomId, data.doorId);
      break;
    case 'playerHiding':
      // PLAYER HIDING/UNHIDING
      handlePlayerHideStatus(data.id, data.isHiding);
      break;
    case 'noteFound':
      // NOTE PICKED UP
      hideNote(data.x, data.y);
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
    let newX = state.position.x;
    let newY = state.position.y;
    
    if (state.keys['arrowup'] || state.keys['w']) {
      newY = Math.max(50, state.position.y - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowdown'] || state.keys['s']) {
      newY = Math.min(1750, state.position.y + state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowleft'] || state.keys['a']) {
      newX = Math.max(50, state.position.x - state.moveSpeed);
      moved = true;
    }
    if (state.keys['arrowright'] || state.keys['d']) {
      newX = Math.min(2350, state.position.x + state.moveSpeed);
      moved = true;
    }
    
    // CHECK DOOR COLLISIONS
    if (moved) {
      const canMove = canPassThroughDoors(newX, newY);
      if (canMove) {
        state.position.x = newX;
        state.position.y = newY;
      }
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

// FOG OF WAR - Reveal rooms as you enter, darkness when leaving
function checkRoomVisibility() {
  let inRoom = false;
  
  document.querySelectorAll('.room').forEach(room => {
    const roomX = parseInt(room.style.left);
    const roomY = parseInt(room.style.top);
    const roomW = parseInt(room.style.width);
    const roomH = parseInt(room.style.height);
    const roomId = room.dataset.roomId;
    
    const playerInRoom = state.position.x >= roomX && 
                   state.position.x <= roomX + roomW &&
                   state.position.y >= roomY && 
                   state.position.y <= roomY + roomH;
    
    if (playerInRoom) {
      // Player is in this room
      state.currentRoom = roomId;
      inRoom = true;
      
      if (!state.exploredRooms.has(room.id)) {
        state.exploredRooms.add(room.id);
      }
      room.classList.add('explored'); // REMOVE FOG
      
      // Show furniture only in current room
      document.querySelectorAll('.furniture').forEach(f => {
        if (f.dataset.room === roomId) {
          f.classList.add('visible');
        } else {
          f.classList.remove('visible');
        }
      });
    } else {
      // Player is NOT in this room - darkness returns
      room.classList.remove('explored'); // ADD FOG BACK
    }
  });
  
  // If not in any room (hallway), show hallway items
  if (!inRoom) {
    state.currentRoom = null;
    document.querySelectorAll('.furniture').forEach(f => {
      if (f.dataset.room === 'hallway') {
        f.classList.add('visible');
      } else {
        f.classList.remove('visible');
      }
    });
  }
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
// NEARBY OBJECTS & DOORS
// ===============================================================
function checkNearbyObjects() {
  state.nearbyObjects = [];
  const range = 100;
  
  // Check for nearby furniture
  document.querySelectorAll('.furniture.visible:not(.picked-up)').forEach(obj => {
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
  
  // Check for nearby doors
  document.querySelectorAll('.door').forEach(door => {
    const doorX = parseInt(door.style.left);
    const doorY = parseInt(door.style.top);
    const dx = doorX - state.position.x;
    const dy = doorY - state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    door.classList.remove('nearby');
    if (distance < range) {
      door.classList.add('nearby');
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
// WALL & DOOR COLLISION SYSTEM
// ===============================================================
function canPassThroughDoors(newX, newY) {
  // Define room boundaries (match createRealisticHouse exactly)
  const rooms = [
    { id: 'kitchen', x: 150, y: 150, w: 600, h: 500, doorX: 150, doorY: 350, doorW: 80, doorH: 100 },
    { id: 'living', x: 850, y: 150, w: 700, h: 550, doorX: 850, doorY: 300, doorW: 80, doorH: 100 },
    { id: 'bedroom', x: 150, y: 1050, w: 600, h: 600, doorX: 150, doorY: 1300, doorW: 80, doorH: 100 },
    { id: 'bathroom', x: 850, y: 1050, w: 700, h: 600, doorX: 1050, doorY: 1050, doorW: 80, doorH: 100 }
  ];
  
  const doorPadding = 50; // Extra space around door to pass through
  
  // Check each room - if player is trying to enter/exit through doors only
  for (const room of rooms) {
    // Check if player is inside room (full rectangle, no wall buffer)
    const wasInRoom = state.position.x >= room.x && 
                      state.position.x <= room.x + room.w &&
                      state.position.y >= room.y && 
                      state.position.y <= room.y + room.h;
    
    const isInRoom = newX >= room.x && 
                     newX <= room.x + room.w &&
                     newY >= room.y && 
                     newY <= room.y + room.h;
    
    // Player is trying to cross room boundary
    if (wasInRoom && !isInRoom) {
      // Trying to exit room - check if exiting through door
      const doorLeft = room.doorX - doorPadding;
      const doorRight = room.doorX + room.doorW + doorPadding;
      const doorTop = room.doorY - doorPadding;
      const doorBottom = room.doorY + room.doorH + doorPadding;
      
      const isAtDoor = newX >= doorLeft && newX <= doorRight &&
                       newY >= doorTop && newY <= doorBottom;
      
      if (!isAtDoor) {
        // Not at door - blocked by wall
        return false;
      }
      
      // For kitchen/bedroom, require the key
      if ((room.id === 'kitchen' || room.id === 'bedroom') && !state.collectedKeys.includes(room.id)) {
        return false; // Need key to exit this room
      }
    }
    
    if (!wasInRoom && isInRoom) {
      // Trying to enter room - check if entering through door
      const doorLeft = room.doorX - doorPadding;
      const doorRight = room.doorX + room.doorW + doorPadding;
      const doorTop = room.doorY - doorPadding;
      const doorBottom = room.doorY + room.doorH + doorPadding;
      
      const isAtDoor = state.position.x >= doorLeft && state.position.x <= doorRight &&
                       state.position.y >= doorTop && state.position.y <= doorBottom;
      
      if (!isAtDoor) {
        // Not coming from door - blocked by wall
        return false;
      }
      
      // For kitchen/bedroom, require the key
      if ((room.id === 'kitchen' || room.id === 'bedroom') && !state.collectedKeys.includes(room.id)) {
        return false; // Need key to enter this room
      }
    }
  }
  return true; // Can move
}

// ===============================================================
// DOOR SYSTEM
// ===============================================================
function handleDoorInteraction(roomId, doorElement) {
  const requiredKey = roomId; // e.g., 'kitchen', 'bedroom'
  const hasKey = state.collectedKeys.includes(requiredKey);
  
  if (state.unlockedDoors.includes(`door-${roomId}`)) {
    // Already unlocked - door is passable
    doorElement.classList.remove('locked');
    doorElement.classList.add('unlocked');
    alert(`🔓 ${roomId.toUpperCase()} is now unlocked!`);
  } else if (hasKey) {
    // Has key - unlock it
    state.unlockedDoors.push(`door-${roomId}`);
    doorElement.classList.remove('locked');
    doorElement.classList.add('unlocked');
    alert(`🔓 You unlocked the ${roomId}!`);
    
    // Broadcast unlock to other players
    sendWS({
      type: 'doorUnlocked',
      doorId: `door-${roomId}`,
      roomId: roomId
    });
  } else {
    // No key
    alert(`🔒 This door is locked! Find the ${roomId} key!`);
  }
}

// ===============================================================
// UPDATE KEYS DISPLAY
// ===============================================================
// ===============================================================
// NOTE INTERACTION SYSTEM
// ===============================================================
function handleNoteInteraction(noteElement) {
  const noteId = noteElement.dataset.noteId;
  const existingNote = JSON.parse(localStorage.getItem(`note-${noteId}`) || '{}');
  
  const noteContent = prompt('📝 Note (read or write):', existingNote.content || '');
  if (noteContent !== null) {
    const noteData = {
      content: noteContent,
      author: state.playerName,
      timestamp: new Date().toLocaleTimeString()
    };
    
    localStorage.setItem(`note-${noteId}`, JSON.stringify(noteData));
    
    // Update note display
    noteElement.dataset.noteContent = JSON.stringify(noteData);
    noteElement.title = `📝 ${noteData.author}: ${noteData.content}`;
    
    // Broadcast note update
    sendWS({
      type: 'noteFound',
      noteId: noteId,
      x: parseInt(noteElement.style.left),
      y: parseInt(noteElement.style.top)
    });
    
    alert('📝 Note saved!');
  }
}

function updateKeysDisplay() {
  if (state.collectedKeys.length === 0) {
    elements.keysDisplay.textContent = '📭'; // Empty mailbox
  } else {
    const keyMap = { 'kitchen': '🔑', 'bedroom': '🔑' };
    const keyDisplay = state.collectedKeys
      .map(key => `${keyMap[key]}${key.charAt(0).toUpperCase()}`)
      .join(' ');
    elements.keysDisplay.textContent = keyDisplay;
  }
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
  const isKey = obj.classList.contains('key-item');
  const keyFor = obj.dataset.keyFor;
  
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
    case 'key':
      if (isKey) {
        // PICKUP KEY
        obj.classList.add('picked-up');
        state.collectedKeys.push(keyFor);
        updateKeysDisplay(); // UPDATE HUD
        alert(`🔑 You found the ${keyFor} key!`);
        showChatBubble(state.playerId, '', '🔑');
        
        sendWS({
          type: 'pickupKey',
          playerId: state.playerId,
          keyFor: keyFor,
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
      // TOGGLE HIDING IN CLOSET
      state.isHiding = !state.isHiding;
      if (state.isHiding) {
        showChatBubble(state.playerId, 'Hiding!', '🫣');
        // Hide avatar when hiding
        let avatar = document.querySelector(`[data-player-id="${state.playerId}"]`);
        if (avatar) avatar.style.opacity = '0.1';
        alert('🫣 You are now hiding in the closet! Press E again to get out.');
        
        // Broadcast hide status to others
        sendWS({
          type: 'playerHiding',
          id: state.playerId,
          isHiding: true
        });
      } else {
        showChatBubble(state.playerId, 'Got out!', '👋');
        // Show avatar when unhiding
        let avatar = document.querySelector(`[data-player-id="${state.playerId}"]`);
        if (avatar) avatar.style.opacity = '1';
        alert('👋 You got out of the closet!');
        
        // Broadcast unhide status to others
        sendWS({
          type: 'playerHiding',
          id: state.playerId,
          isHiding: false
        });
      }
      break;
    case 'note':
      // READ OR WRITE NOTE
      handleNoteInteraction(obj);
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

// KEY SYNC - Hide for everyone
function hideKey(keyFor, x, y) {
  document.querySelectorAll('.furniture').forEach(f => {
    if (f.dataset.keyFor === keyFor && 
        parseInt(f.style.left) === x && 
        parseInt(f.style.top) === y) {
      f.classList.add('picked-up');
    }
  });
}

// DOOR SYNC - Unlock for everyone
function unlockDoorGlobally(roomId, doorId) {
  const door = document.querySelector(`[data-door-id="${doorId}"]`);
  if (door) {
    door.classList.remove('locked');
    door.classList.add('unlocked');
    if (!state.unlockedDoors.includes(doorId)) {
      state.unlockedDoors.push(doorId);
    }
  }
}

// ===============================================================
// HIDE/UNHIDE SYSTEM
// ===============================================================
function handlePlayerHideStatus(playerId, isHiding) {
  const avatar = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!avatar) return;
  
  if (isHiding) {
    avatar.style.opacity = '0.1';
    avatar.classList.add('hiding');
  } else {
    avatar.style.opacity = '1';
    avatar.classList.remove('hiding');
  }
}

// ===============================================================
// NOTE SYSTEM
// ===============================================================
function hideNote(x, y) {
  document.querySelectorAll('.furniture').forEach(f => {
    if (f.dataset.interaction === 'note' && 
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
  if (state.isHiding) {
    alert('🫣 You cannot kill while hiding!');
    return;
  }
  
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
    if (!state.isAlive) return;
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
  console.log('Accuse triggered for:', targetName);
  
  if (confirm(`Accuse ${targetName}?\n⚠️ If wrong, YOU DIE!`)) {
    console.log('Sending accusation to server for target:', targetId);
    sendWS({
      type: 'accusePlayer',
      accuserId: state.playerId,
      targetId: targetId
    });
  } else {
    console.log('Accusation cancelled by user');
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
// CREATE REALISTIC HOUSE WITH DOORS AND KEYS
// ===============================================================
function createRealisticHouse() {
  const rooms = [
    { id: 'kitchen', label: '🍳 Kitchen', x: 150, y: 150, width: 600, height: 500, className: 'kitchen', doorX: 150, doorY: 350, doorDir: 'left', locked: true },
    { id: 'living', label: '🛋️ Living Room', x: 850, y: 150, width: 700, height: 550, className: 'living', doorX: 850, doorY: 300, doorDir: 'left', locked: true },
    { id: 'hallway', label: '🚪 Hallway', x: 650, y: 750, width: 600, height: 250, className: 'hallway' },
    { id: 'bedroom', label: '🛏 Bedroom', x: 150, y: 1050, width: 600, height: 600, className: 'bedroom', doorX: 150, doorY: 1300, doorDir: 'left', locked: false },
    { id: 'bathroom', label: '🚿 Bathroom', x: 850, y: 1050, width: 700, height: 600, className: 'bathroom', doorX: 1050, doorY: 1050, doorDir: 'top', locked: false }
  ];
  
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = `room ${room.className}`;
    div.id = `room-${room.id}`;
    div.dataset.roomId = room.id;
    div.style.left = `${room.x}px`;
    div.style.top = `${room.y}px`;
    div.style.width = `${room.width}px`;
    div.style.height = `${room.height}px`;
    div.innerHTML = `<div class="room-label">${room.label}</div>`;
    elements.houseGrid.appendChild(div);
    
    // CREATE DOORS FOR ALL ROOMS EXCEPT HALLWAY
    if (room.doorX !== undefined) {
      const door = document.createElement('div');
      const lockStatus = room.locked ? 'locked' : 'unlocked';
      door.className = `door ${lockStatus}`;
      door.dataset.roomId = room.id;
      door.dataset.doorId = `door-${room.id}`;
      door.style.left = `${room.doorX}px`;
      door.style.top = `${room.doorY}px`;
      
      // Determine door label based on lock status
      const doorLabel = '🚪';
      const lockLabel = room.locked ? 'Locked' : 'Unlocked';
      door.innerHTML = `
        <div class="door-icon">${doorLabel}</div>
        <div class="door-label">${lockLabel}</div>
      `;
      
      door.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDoorInteraction(room.id, door);
      });
      
      elements.houseGrid.appendChild(door);
      
      // Pre-unlock non-locked doors
      if (!room.locked) {
        state.unlockedDoors.push(`door-${room.id}`);
      }
    }
  });
  
  // FURNITURE
  const furniture = [
    // Kitchen
    { emoji: '🔪', label: 'Knife', x: 300, y: 250, weapon: true, interaction: 'pickup', room: 'kitchen' },
    { emoji: '🧊', label: 'Fridge', x: 500, y: 300, interaction: 'open', room: 'kitchen' },
    { emoji: '🍳', label: 'Stove', x: 350, y: 280, interaction: 'use', room: 'kitchen' },
    { emoji: '🪑', label: 'Chair', x: 400, y: 450, interaction: 'sit', room: 'kitchen' },
    { emoji: '🍽️', label: 'Table', x: 450, y: 420, interaction: 'eat', room: 'kitchen' },
    { emoji: '🥘', label: 'Pot', x: 280, y: 350, weapon: true, interaction: 'pickup', room: 'kitchen' },
    { emoji: '🥄', label: 'Spoon', x: 520, y: 280, weapon: true, interaction: 'pickup', room: 'kitchen' },
    { emoji: '📦', label: 'Cabinets', x: 450, y: 200, interaction: 'use', room: 'kitchen' },
    
    // Living Room
    { emoji: '🛋️', label: 'Sofa', x: 1050, y: 380, interaction: 'sit', room: 'living' },
    { emoji: '📺', label: 'TV', x: 1050, y: 230, interaction: 'watch', room: 'living' },
    { emoji: '☕', label: 'Lamp', x: 1300, y: 320, weapon: true, interaction: 'pickup', room: 'living' },
    { emoji: '🌷', label: 'Vase', x: 1300, y: 480, weapon: true, interaction: 'pickup', room: 'living' },
    { emoji: '🔑', label: 'Bedroom Key', x: 950, y: 400, interaction: 'key', room: 'living', keyFor: 'bedroom' },
    { emoji: '📚', label: 'Bookshelf', x: 900, y: 200, interaction: 'inspect', room: 'living' },
    { emoji: '🎨', label: 'Painting', x: 1200, y: 150, interaction: 'inspect', room: 'living' },
    { emoji: '🪴', label: 'Plant', x: 850, y: 500, interaction: 'inspect', room: 'living' },
    { emoji: '📝', label: 'Note 1', x: 1000, y: 500, interaction: 'note', room: 'living', noteId: 'note1' },
    { emoji: '📄', label: 'Note 2', x: 1100, y: 520, interaction: 'note', room: 'living', noteId: 'note2' },
    { emoji: '🎮', label: 'Gaming Console', x: 950, y: 250, interaction: 'use', room: 'living' },
    
    // Bedroom
    { emoji: '🛏', label: 'Bed', x: 350, y: 1250, interaction: 'sleep', room: 'bedroom' },
    { emoji: '🛌', label: 'Pillow', x: 320, y: 1230, weapon: true, interaction: 'pickup', room: 'bedroom' },
    { emoji: '🗄', label: 'Closet', x: 550, y: 1350, interaction: 'hide', room: 'bedroom' },
    { emoji: '🕯', label: 'Nightstand', x: 450, y: 1250, interaction: 'inspect', room: 'bedroom' },
    { emoji: '🧸', label: 'Teddy Bear', x: 380, y: 1200, weapon: true, interaction: 'pickup', room: 'bedroom' },
    { emoji: '💼', label: 'Suitcase', x: 500, y: 1500, interaction: 'inspect', room: 'bedroom' },
    { emoji: '🖼️', label: 'Picture Frame', x: 200, y: 1150, interaction: 'inspect', room: 'bedroom' },
    { emoji: '📖', label: 'Book', x: 550, y: 1200, interaction: 'inspect', room: 'bedroom' },
    
    // Bathroom
    { emoji: '🪥', label: 'Sink', x: 1000, y: 1250, interaction: 'use', room: 'bathroom' },
    { emoji: '🪞', label: 'Mirror', x: 1000, y: 1170, interaction: 'inspect', room: 'bathroom' },
    { emoji: '🚽', label: 'Toilet', x: 1250, y: 1400, interaction: 'use', room: 'bathroom' },
    { emoji: '🔑', label: 'Kitchen Key', x: 1100, y: 1300, interaction: 'key', room: 'bathroom', keyFor: 'kitchen' },
    { emoji: '🛁', label: 'Bathtub', x: 1150, y: 1200, interaction: 'use', room: 'bathroom' },
    { emoji: '🧴', label: 'Soap', x: 1020, y: 1290, weapon: true, interaction: 'pickup', room: 'bathroom' },
    { emoji: '🧻', label: 'Toilet Paper', x: 1280, y: 1360, weapon: true, interaction: 'pickup', room: 'bathroom' },
    { emoji: '🧼', label: 'Brush', x: 1180, y: 1100, weapon: true, interaction: 'pickup', room: 'bathroom' }
  ];
  
  furniture.forEach(item => {
    const obj = document.createElement('div');
    let classNames = `furniture ${item.weapon ? 'weapon' : ''}`;
    
    if (item.interaction === 'key') classNames += ' key-item';
    if (item.interaction === 'note') classNames += ' note-item';
    
    obj.className = classNames;
    obj.dataset.item = item.label;
    obj.dataset.interaction = item.interaction;
    obj.dataset.room = item.room;
    obj.dataset.keyFor = item.keyFor || '';
    obj.dataset.noteId = item.noteId || '';
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
