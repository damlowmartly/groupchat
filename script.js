// ============================================
// HATO & JBRO COLLABORATION - CLIENT SCRIPT
// ============================================

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
  currentUser: null,
  ws: null,
  isDrawing: false,
  canvasContext: null
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
  // Login
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  usernameSelect: document.getElementById('username'),
  passwordInput: document.getElementById('password'),
  loginError: document.getElementById('login-error'),
  
  // Workspace
  workspace: document.getElementById('workspace'),
  currentUserDisplay: document.getElementById('current-user'),
  onlineUsers: document.getElementById('online-users'),
  connectionStatus: document.getElementById('connection-status'),
  
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  contentPanels: document.querySelectorAll('.content-panel'),
  
  // Draw
  canvas: document.getElementById('drawing-canvas'),
  clearCanvasBtn: document.getElementById('clear-canvas-btn'),
  canvasLabelInput: document.getElementById('canvas-label'),
  canvasLabelDisplay: document.getElementById('canvas-label-display'),
  
  // Messages
  messagesContainer: document.getElementById('messages-container'),
  messageInput: document.getElementById('message-input'),
  messageTypeSelect: document.getElementById('message-type'),
  sendMessageBtn: document.getElementById('send-message-btn'),
  
  // Notes
  noteInput: document.getElementById('note-input'),
  addNoteBtn: document.getElementById('add-note-btn'),
  notesList: document.getElementById('notes-list'),
  emailStatus: document.getElementById('email-status'),
  
  // Session
  endSessionBtn: document.getElementById('end-session-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  summaryModal: document.getElementById('summary-modal'),
  summaryContent: document.getElementById('summary-content')
};

// ============================================
// INITIALIZATION
// ============================================
function init() {
  // Check if already logged in
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    state.currentUser = savedUser;
    showWorkspace();
    initWebSocket();
  }
  
  // Setup event listeners
  setupLoginListeners();
  setupNavigationListeners();
  setupDrawingListeners();
  setupMessageListeners();
  setupNotesListeners();
  setupSessionListeners();
}

// ============================================
// LOGIN FLOW
// ============================================
function setupLoginListeners() {
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = elements.usernameSelect.value;
    const password = elements.passwordInput.value;
    
    // Simple authentication (both users share same password)
    if ((username === 'Hato' || username === 'Jbro') && password === 'skyf123') {
      state.currentUser = username;
      sessionStorage.setItem('currentUser', username);
      elements.loginError.textContent = '';
      showWorkspace();
      initWebSocket();
    } else {
      elements.loginError.textContent = '❌ Invalid credentials';
    }
  });
}

function showWorkspace() {
  elements.loginScreen.classList.add('hidden');
  elements.workspace.classList.remove('hidden');
  elements.currentUserDisplay.textContent = `Logged in as ${state.currentUser}`;
  
  // Initialize canvas
  initCanvas();
}

// ============================================
// WEBSOCKET CONNECTION
// ============================================
function initWebSocket() {
  // Determine WebSocket URL based on environment
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  state.ws = new WebSocket(wsUrl);
  
  state.ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
    
    // Send login message
    sendWebSocketMessage({
      type: 'login',
      user: state.currentUser
    });
  };
  
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  state.ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    
    // Attempt to reconnect after 3 seconds
    setTimeout(() => {
      if (state.currentUser) {
        initWebSocket();
      }
    }, 3000);
  };
  
  state.ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus(false);
  };
}

function sendWebSocketMessage(data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'session_state':
      // Restore session state for new user
      data.messages.forEach(msg => addMessageToUI(msg));
      data.drawingEvents.forEach(event => {
        if (event.action === 'move' && state.canvasContext) {
          drawLine(event.x, event.y, event.x, event.y);
        }
      });
      data.notes.forEach(note => addNoteToUI(note));
      break;
      
    case 'online_status':
      updateOnlineUsers(data.users);
      break;
      
    case 'chat':
    case 'system':
      addMessageToUI(data);
      break;
      
    case 'draw':
      if (data.user !== state.currentUser) {
        if (data.action === 'move') {
          drawLine(data.x, data.y, data.x, data.y);
        }
      }
      break;
      
    case 'clear_canvas':
      clearCanvas();
      break;
      
    case 'note_added':
      addNoteToUI(data.note);
      break;
      
    case 'note_deleted':
      removeNoteFromUI(data.noteId);
      break;
      
    case 'session_summary':
      showSessionSummary(data);
      break;
  }
}

function updateConnectionStatus(connected) {
  const statusDot = elements.connectionStatus.querySelector('.status-dot');
  const statusText = elements.connectionStatus.querySelector('.status-text');
  
  if (connected) {
    statusDot.classList.add('connected');
    statusDot.classList.remove('disconnected');
    statusText.textContent = 'Connected';
  } else {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
  }
}

function updateOnlineUsers(users) {
  elements.onlineUsers.innerHTML = '';
  users.forEach(user => {
    const badge = document.createElement('div');
    badge.className = 'user-badge';
    badge.textContent = user;
    elements.onlineUsers.appendChild(badge);
  });
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigationListeners() {
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      elements.navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding panel
      elements.contentPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `${targetTab}-panel`) {
          panel.classList.add('active');
        }
      });
    });
  });
}

// ============================================
// DRAWING CANVAS
// ============================================
function initCanvas() {
  const canvas = elements.canvas;
  canvas.width = 800;
  canvas.height = 600;
  
  state.canvasContext = canvas.getContext('2d');
  state.canvasContext.lineWidth = 2;
  state.canvasContext.lineCap = 'round';
  state.canvasContext.strokeStyle = '#000';
}

function setupDrawingListeners() {
  const canvas = elements.canvas;
  
  let lastX = 0;
  let lastY = 0;
  
  canvas.addEventListener('mousedown', (e) => {
    state.isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    sendWebSocketMessage({
      type: 'draw',
      action: 'start',
      x: lastX,
      y: lastY
    });
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!state.isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    drawLine(lastX, lastY, x, y);
    
    sendWebSocketMessage({
      type: 'draw',
      action: 'move',
      x: x,
      y: y
    });
    
    lastX = x;
    lastY = y;
  });
  
  canvas.addEventListener('mouseup', () => {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    
    sendWebSocketMessage({
      type: 'draw',
      action: 'end'
    });
  });
  
  canvas.addEventListener('mouseleave', () => {
    state.isDrawing = false;
  });
  
  // Clear canvas button
  elements.clearCanvasBtn.addEventListener('click', () => {
    if (confirm('Clear canvas for both users?')) {
      sendWebSocketMessage({
        type: 'clear_canvas'
      });
    }
  });
  
  // Canvas label
  elements.canvasLabelInput.addEventListener('input', (e) => {
    elements.canvasLabelDisplay.textContent = e.target.value;
    elements.canvasLabelDisplay.style.display = e.target.value ? 'block' : 'none';
  });
}

function drawLine(x1, y1, x2, y2) {
  const ctx = state.canvasContext;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function clearCanvas() {
  state.canvasContext.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
}

// ============================================
// MESSAGES (FB/Instagram Style)
// ============================================
function setupMessageListeners() {
  elements.sendMessageBtn.addEventListener('click', sendMessage);
  
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function sendMessage() {
  const content = elements.messageInput.value.trim();
  if (!content) return;
  
  const messageType = elements.messageTypeSelect.value;
  
  sendWebSocketMessage({
    type: 'chat',
    content: content,
    messageType: messageType
  });
  
  elements.messageInput.value = '';
}

function addMessageToUI(message) {
  if (message.type === 'system') {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = message.content;
    elements.messagesContainer.appendChild(systemDiv);
  } else {
    const messageDiv = document.createElement('div');
    const isCurrentUser = message.user === state.currentUser;
    messageDiv.className = `message-bubble ${isCurrentUser ? 'current-user' : 'other-user'}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = message.user;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${message.messageType || 'chat'}`;
    contentDiv.textContent = message.content;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = formatTimestamp(message.timestamp);
    
    if (!isCurrentUser) {
      messageDiv.appendChild(headerDiv);
    }
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timestampDiv);
    
    elements.messagesContainer.appendChild(messageDiv);
  }
  
  // Smooth scroll to bottom
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// ============================================
// NOTES & EMAIL (Formspree Integration)
// ============================================
function setupNotesListeners() {
  elements.addNoteBtn.addEventListener('click', () => {
    const content = elements.noteInput.value.trim();
    if (!content) return;
    
    sendWebSocketMessage({
      type: 'add_note',
      content: content
    });
    
    elements.noteInput.value = '';
  });
}

function addNoteToUI(note) {
  // Remove placeholder if exists
  const placeholder = elements.notesList.querySelector('.notes-placeholder');
  if (placeholder) {
    placeholder.remove();
  }
  
  const noteCard = document.createElement('div');
  noteCard.className = 'note-card';
  noteCard.dataset.noteId = note.id;
  
  noteCard.innerHTML = `
    <div class="note-header">
      <div class="note-meta">
        <strong>${note.user}</strong> • ${formatTimestamp(note.timestamp)}
      </div>
      <div class="note-actions">
        <button class="btn-icon email" onclick="sendNoteViaEmail(${note.id})" title="Send via Email">📩</button>
        <button class="btn-icon delete" onclick="deleteNote(${note.id})" title="Delete">🗑</button>
      </div>
    </div>
    <div class="note-content">${escapeHtml(note.content)}</div>
  `;
  
  elements.notesList.appendChild(noteCard);
}

function removeNoteFromUI(noteId) {
  const noteCard = elements.notesList.querySelector(`[data-note-id="${noteId}"]`);
  if (noteCard) {
    noteCard.remove();
  }
  
  // Add placeholder if no notes remain
  if (elements.notesList.children.length === 0) {
    elements.notesList.innerHTML = '<p class="notes-placeholder">No notes yet. Add one above to get started.</p>';
  }
}

// ============================================
// FORMSPREE EMAIL INTEGRATION
// Note: Formspree form action is in index.html
// Set FORMSPREE_ID environment variable on Render
// Or manually replace {FORMSPREE_ID} in HTML
// ============================================
window.sendNoteViaEmail = async function(noteId) {
  const noteCard = elements.notesList.querySelector(`[data-note-id="${noteId}"]`);
  if (!noteCard) return;
  
  const noteContent = noteCard.querySelector('.note-content').textContent;
  const noteMeta = noteCard.querySelector('.note-meta').textContent;
  
  // Get Formspree form
  const formspreeForm = document.getElementById('formspree-form');
  const formAction = formspreeForm.getAttribute('action');
  
  // Check if Formspree ID is set
  if (formAction.includes('{FORMSPREE_ID}')) {
    showEmailStatus('error', '❌ Formspree ID not configured. Set FORMSPREE_ID environment variable on Render.');
    return;
  }
  
  // Prepare email data
  const emailData = {
    _replyto: 'noreply@collaboration.app', // Can be customized
    subject: `Note from ${state.currentUser} - Hato & Jbro Workspace`,
    message: `${noteMeta}\n\n${noteContent}`
  };
  
  try {
    showEmailStatus('info', '📧 Sending email...');
    
    const response = await fetch(formAction, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      showEmailStatus('success', '✅ Email sent successfully!');
    } else {
      const error = await response.json();
      showEmailStatus('error', `❌ Failed to send email: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    showEmailStatus('error', `❌ Error sending email: ${error.message}`);
  }
};

window.deleteNote = function(noteId) {
  if (confirm('Delete this note?')) {
    sendWebSocketMessage({
      type: 'delete_note',
      noteId: noteId
    });
  }
};

function showEmailStatus(type, message) {
  elements.emailStatus.className = `email-status ${type}`;
  elements.emailStatus.textContent = message;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.emailStatus.className = 'email-status';
    elements.emailStatus.textContent = '';
  }, 5000);
}

// ============================================
// SESSION MANAGEMENT
// ============================================
function setupSessionListeners() {
  elements.endSessionBtn.addEventListener('click', () => {
    sendWebSocketMessage({
      type: 'get_summary'
    });
  });
  
  elements.logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      sessionStorage.removeItem('currentUser');
      if (state.ws) {
        state.ws.close();
      }
      window.location.reload();
    }
  });
  
  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.summaryModal.classList.add('hidden');
    });
  });
}

function showSessionSummary(data) {
  const summaryHTML = `
    <div class="summary-stat">
      <strong>Total Messages:</strong> ${data.totalMessages}
    </div>
    <div class="summary-stat">
      <strong>Drawing Events:</strong> ${data.totalDrawEvents}
    </div>
    <div class="summary-stat">
      <strong>Notes Created:</strong> ${data.totalNotes}
    </div>
    <div class="summary-stat">
      <strong>Participants:</strong> ${data.participants.join(', ')}
    </div>
    <div class="summary-stat">
      <strong>Recent Messages:</strong>
      <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
        ${data.messages.slice(-5).map(msg => 
          msg.type === 'chat' 
            ? `<li><strong>${msg.user}:</strong> ${escapeHtml(msg.content)}</li>`
            : `<li><em>${msg.content}</em></li>`
        ).join('')}
      </ul>
    </div>
  `;
  
  elements.summaryContent.innerHTML = summaryHTML;
  elements.summaryModal.classList.remove('hidden');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// START APPLICATION
// ============================================
document.addEventListener('DOMContentLoaded', init);
