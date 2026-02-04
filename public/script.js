// ============================================
// HATO & JBRO MESSENGER - CLIENT SCRIPT
// ============================================

const state = {
  currentUser: null,
  ws: null,
  messages: [],
  savedItems: [],
  reminders: [],
  todos: []
};

const elements = {
  // Login
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  usernameSelect: document.getElementById('username'),
  passwordInput: document.getElementById('password'),
  loginError: document.getElementById('login-error'),
  
  // Messenger
  messenger: document.getElementById('messenger'),
  messagesArea: document.getElementById('messages-area'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  
  // Header
  statusDot: document.getElementById('status-dot'),
  partnerName: document.getElementById('partner-name'),
  menuBtn: document.getElementById('menu-btn'),
  
  // Side Menu
  sideMenu: document.getElementById('side-menu'),
  closeMenuBtn: document.getElementById('close-menu'),
  currentUserDisplay: document.getElementById('current-user-display'),
  userAvatarText: document.getElementById('user-avatar-text'),
  statMessages: document.getElementById('stat-messages'),
  statTodos: document.getElementById('stat-todos'),
  statReminders: document.getElementById('stat-reminders'),
  savedItemsList: document.getElementById('saved-items-list'),
  emailNotesBtn: document.getElementById('email-notes-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  
  // Quick Actions
  quickBtns: document.querySelectorAll('.quick-btn'),
  
  // Modals
  reminderModal: document.getElementById('reminder-modal'),
  todoModal: document.getElementById('todo-modal'),
  noteModal: document.getElementById('note-modal'),
  pollModal: document.getElementById('poll-modal'),
  emailModal: document.getElementById('email-modal')
};

// ============================================
// INITIALIZATION
// ============================================
function init() {
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    state.currentUser = savedUser;
    showMessenger();
    initWebSocket();
  }
  
  setupLoginListeners();
  setupMessengerListeners();
  setupMenuListeners();
  setupQuickActionsListeners();
  setupModalListeners();
  
  // Set current date
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'short', day: 'numeric' 
  });
  document.getElementById('current-date').textContent = today;
}

// ============================================
// LOGIN
// ============================================
function setupLoginListeners() {
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = elements.usernameSelect.value;
    const password = elements.passwordInput.value;
    
    if ((username === 'Hato' || username === 'Jbro') && password === 'skyf123') {
      state.currentUser = username;
      sessionStorage.setItem('currentUser', username);
      elements.loginError.textContent = '';
      showMessenger();
      initWebSocket();
    } else {
      elements.loginError.textContent = '❌ Invalid credentials';
    }
  });
}

function showMessenger() {
  elements.loginScreen.classList.add('hidden');
  elements.messenger.classList.remove('hidden');
  elements.currentUserDisplay.textContent = state.currentUser;
  elements.userAvatarText.textContent = state.currentUser.charAt(0);
}

// ============================================
// WEBSOCKET
// ============================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  state.ws = new WebSocket(wsUrl);
  
  state.ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
    sendWS({ type: 'login', user: state.currentUser });
  };
  
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  state.ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    setTimeout(() => {
      if (state.currentUser) initWebSocket();
    }, 3000);
  };
  
  state.ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus(false);
  };
}

function sendWS(data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'session_state':
      data.messages.forEach(msg => addMessageToUI(msg, false));
      break;
    case 'online_status':
      updateOnlineStatus(data.users);
      break;
    case 'chat':
    case 'system':
    case 'reminder':
    case 'todo':
    case 'note':
    case 'poll':
    case 'important':
      addMessageToUI(data, true);
      break;
  }
}

function updateConnectionStatus(connected) {
  if (connected) {
    elements.statusDot.classList.add('online');
  } else {
    elements.statusDot.classList.remove('online');
  }
}

function updateOnlineStatus(users) {
  const partner = users.find(u => u !== state.currentUser);
  if (partner) {
    elements.partnerName.textContent = partner;
    elements.statusDot.classList.add('online');
  } else {
    elements.partnerName.textContent = 'Offline';
    elements.statusDot.classList.remove('online');
  }
}

// ============================================
// MESSAGING
// ============================================
function setupMessengerListeners() {
  elements.sendBtn.addEventListener('click', sendMessage);
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
  
  sendWS({
    type: 'chat',
    content: content,
    user: state.currentUser,
    timestamp: new Date().toISOString()
  });
  
  elements.messageInput.value = '';
}

function addMessageToUI(message, shouldScroll = true) {
  if (message.type === 'system') {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = message.content;
    elements.messagesArea.appendChild(div);
  } else {
    const isSent = message.user === state.currentUser;
    const div = document.createElement('div');
    div.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
    
    if (!isSent) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = message.user;
      div.appendChild(sender);
    }
    
    const content = document.createElement('div');
    content.className = `message-content ${message.type || 'chat'}`;
    
    if (message.type === 'poll') {
      content.innerHTML = createPollHTML(message);
    } else {
      content.textContent = message.content;
    }
    
    div.appendChild(content);
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(message.timestamp);
    div.appendChild(time);
    
    elements.messagesArea.appendChild(div);
    state.messages.push(message);
  }
  
  if (shouldScroll) {
    elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
  }
  
  updateStats();
}

function createPollHTML(message) {
  const poll = JSON.parse(message.content);
  return `
    <div class="poll-question">${poll.question}</div>
    <div class="poll-option" onclick="votePoll('${poll.id}', 0)">${poll.options[0]}</div>
    <div class="poll-option" onclick="votePoll('${poll.id}', 1)">${poll.options[1]}</div>
  `;
}

window.votePoll = function(pollId, option) {
  alert(`You voted for option ${option + 1}!`);
};

function formatTime(isoString) {
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

// ============================================
// MENU
// ============================================
function setupMenuListeners() {
  elements.menuBtn.addEventListener('click', () => {
    elements.sideMenu.classList.add('active');
  });
  
  elements.closeMenuBtn.addEventListener('click', () => {
    elements.sideMenu.classList.remove('active');
  });
  
  elements.emailNotesBtn.addEventListener('click', () => {
    elements.emailModal.classList.remove('hidden');
    updateEmailPreview();
  });
  
  elements.clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear all messages for both users?')) {
      sendWS({ type: 'clear_chat' });
      elements.messagesArea.innerHTML = `
        <div class="date-divider">
          <span id="current-date">Today</span>
        </div>
      `;
      state.messages = [];
      updateStats();
    }
  });
  
  elements.logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      sessionStorage.removeItem('currentUser');
      if (state.ws) state.ws.close();
      window.location.reload();
    }
  });
}

function updateStats() {
  const messageCount = state.messages.filter(m => m.type === 'chat').length;
  const todoCount = state.todos.length;
  const reminderCount = state.reminders.length;
  
  elements.statMessages.textContent = messageCount;
  elements.statTodos.textContent = todoCount;
  elements.statReminders.textContent = reminderCount;
}

// ============================================
// QUICK ACTIONS
// ============================================
function setupQuickActionsListeners() {
  elements.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });
}

function handleQuickAction(action) {
  switch (action) {
    case 'reminder':
      elements.reminderModal.classList.remove('hidden');
      break;
    case 'todo':
      elements.todoModal.classList.remove('hidden');
      break;
    case 'note':
      elements.noteModal.classList.remove('hidden');
      break;
    case 'poll':
      elements.pollModal.classList.remove('hidden');
      break;
    case 'important':
      const content = prompt('Important message:');
      if (content) {
        sendWS({
          type: 'important',
          content: content,
          user: state.currentUser,
          timestamp: new Date().toISOString()
        });
      }
      break;
  }
}

// ============================================
// MODALS
// ============================================
function setupModalListeners() {
  // Close modal buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.add('hidden');
    });
  });
  
  // Reminder
  document.getElementById('save-reminder-btn').addEventListener('click', () => {
    const text = document.getElementById('reminder-text').value.trim();
    const time = document.getElementById('reminder-time').value;
    
    if (text && time) {
      const reminder = { text, time, id: Date.now() };
      state.reminders.push(reminder);
      
      sendWS({
        type: 'reminder',
        content: `⏰ Reminder: ${text} at ${new Date(time).toLocaleString()}`,
        user: state.currentUser,
        timestamp: new Date().toISOString()
      });
      
      elements.reminderModal.classList.add('hidden');
      document.getElementById('reminder-text').value = '';
      document.getElementById('reminder-time').value = '';
      updateStats();
    }
  });
  
  // Todo
  document.getElementById('save-todo-btn').addEventListener('click', () => {
    const text = document.getElementById('todo-text').value.trim();
    const urgent = document.getElementById('todo-urgent').checked;
    
    if (text) {
      const todo = { text, urgent, id: Date.now() };
      state.todos.push(todo);
      
      const prefix = urgent ? '🚨 URGENT' : '✅';
      sendWS({
        type: 'todo',
        content: `${prefix} To-Do: ${text}`,
        user: state.currentUser,
        timestamp: new Date().toISOString()
      });
      
      elements.todoModal.classList.add('hidden');
      document.getElementById('todo-text').value = '';
      document.getElementById('todo-urgent').checked = false;
      updateStats();
    }
  });
  
  // Note
  document.getElementById('save-note-btn').addEventListener('click', () => {
    const text = document.getElementById('note-text').value.trim();
    
    if (text) {
      const note = { text, id: Date.now(), user: state.currentUser };
      state.savedItems.push(note);
      
      sendWS({
        type: 'note',
        content: `📝 Note saved: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        user: state.currentUser,
        timestamp: new Date().toISOString()
      });
      
      addSavedItem(note);
      elements.noteModal.classList.add('hidden');
      document.getElementById('note-text').value = '';
    }
  });
  
  // Poll
  document.getElementById('send-poll-btn').addEventListener('click', () => {
    const question = document.getElementById('poll-question').value.trim();
    const option1 = document.getElementById('poll-option1').value.trim();
    const option2 = document.getElementById('poll-option2').value.trim();
    
    if (question && option1 && option2) {
      const poll = {
        id: Date.now(),
        question,
        options: [option1, option2]
      };
      
      sendWS({
        type: 'poll',
        content: JSON.stringify(poll),
        user: state.currentUser,
        timestamp: new Date().toISOString()
      });
      
      elements.pollModal.classList.add('hidden');
      document.getElementById('poll-question').value = '';
      document.getElementById('poll-option1').value = '';
      document.getElementById('poll-option2').value = '';
    }
  });
  
  // Email
  document.getElementById('send-email-btn').addEventListener('click', sendEmail);
}

function addSavedItem(note) {
  // Remove placeholder
  const placeholder = elements.savedItemsList.querySelector('.empty-state');
  if (placeholder) placeholder.remove();
  
  const div = document.createElement('div');
  div.className = 'saved-item';
  div.innerHTML = `
    ${note.text}
    <button class="saved-item-delete" onclick="deleteSavedItem(${note.id})">✕</button>
  `;
  elements.savedItemsList.appendChild(div);
}

window.deleteSavedItem = function(id) {
  state.savedItems = state.savedItems.filter(item => item.id !== id);
  elements.savedItemsList.querySelector(`[onclick="deleteSavedItem(${id})"]`).parentElement.remove();
  
  if (state.savedItems.length === 0) {
    elements.savedItemsList.innerHTML = '<p class="empty-state">No saved items yet</p>';
  }
};

// ============================================
// EMAIL FUNCTIONALITY
// ============================================
function updateEmailPreview() {
  let preview = `=== HATO & JBRO MESSENGER ===\n`;
  preview += `Date: ${new Date().toLocaleDateString()}\n\n`;
  
  if (state.savedItems.length > 0) {
    preview += `📝 SAVED NOTES:\n`;
    state.savedItems.forEach((item, i) => {
      preview += `${i + 1}. ${item.text}\n`;
    });
    preview += `\n`;
  }
  
  if (state.todos.length > 0) {
    preview += `✅ TO-DO LIST:\n`;
    state.todos.forEach((item, i) => {
      const prefix = item.urgent ? '🚨' : '•';
      preview += `${prefix} ${item.text}\n`;
    });
    preview += `\n`;
  }
  
  if (state.reminders.length > 0) {
    preview += `⏰ REMINDERS:\n`;
    state.reminders.forEach((item, i) => {
      preview += `• ${item.text} - ${item.time}\n`;
    });
    preview += `\n`;
  }
  
  const recentMessages = state.messages.filter(m => m.type === 'chat').slice(-10);
  if (recentMessages.length > 0) {
    preview += `💬 RECENT MESSAGES:\n`;
    recentMessages.forEach(msg => {
      preview += `[${msg.user}] ${msg.content}\n`;
    });
  }
  
  document.getElementById('email-content-preview').textContent = preview;
}

async function sendEmail() {
  const email = document.getElementById('email-address').value.trim();
  const formspreeId = document.getElementById('formspree-id').value.trim();
  const statusEl = document.getElementById('email-status');
  const menuStatusEl = document.getElementById('email-status-menu');
  
  if (!email || !formspreeId) {
    statusEl.className = 'email-status error';
    statusEl.textContent = '❌ Please fill in both email and Formspree ID';
    return;
  }
  
  const preview = document.getElementById('email-content-preview').textContent;
  
  statusEl.className = 'email-status info';
  statusEl.textContent = '📧 Sending email...';
  
  try {
    const response = await fetch(`https://formspree.io/f/${formspreeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _replyto: email,
        subject: `Hato & Jbro Messenger Notes - ${new Date().toLocaleDateString()}`,
        message: preview
      })
    });
    
    if (response.ok) {
      statusEl.className = 'email-status success';
      statusEl.textContent = '✅ Email sent successfully!';
      menuStatusEl.className = 'email-status-small success';
      menuStatusEl.textContent = '✅ Last email sent successfully';
      
      setTimeout(() => {
        elements.emailModal.classList.add('hidden');
        statusEl.className = 'email-status';
        statusEl.textContent = '';
      }, 2000);
    } else {
      const error = await response.json();
      statusEl.className = 'email-status error';
      statusEl.textContent = `❌ Failed: ${error.error || 'Unknown error'}`;
    }
  } catch (error) {
    statusEl.className = 'email-status error';
    statusEl.textContent = `❌ Error: ${error.message}`;
  }
}

// ============================================
// START APP
// ============================================
document.addEventListener('DOMContentLoaded', init);
