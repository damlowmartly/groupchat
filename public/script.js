// ============================================
// HATO & JBRO MESSENGER - ENHANCED VERSION
// ============================================

const state = {
  currentUser: null,
  ws: null,
  messages: [],
  savedItems: [],
  reminders: [],
  todos: [],
  polls: {} // Store poll data with votes
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
  menuOverlay: document.getElementById('menu-overlay'),
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
      data.messages.forEach(msg => {
        addMessageToUI(msg, false);
        // Restore poll state
        if (msg.type === 'poll') {
          const pollData = JSON.parse(msg.pollData);
          state.polls[pollData.id] = pollData;
        }
      });
      break;
    case 'online_status':
      updateOnlineStatus(data.users);
      break;
    case 'poll_vote':
      updatePollVote(data.pollId, data.option, data.user);
      break;
    case 'reminder_to_note':
      handleReminderConversion(data);
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
  
  // Mobile keyboard handling - scroll to bottom when keyboard opens
  elements.messageInput.addEventListener('focus', () => {
    setTimeout(() => {
      elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
      // Ensure input container is visible
      elements.messageInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  });
  
  // Prevent body scroll when typing on mobile
  elements.messageInput.addEventListener('touchstart', (e) => {
    e.stopPropagation();
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
    div.dataset.messageId = message.timestamp;
    
    if (!isSent) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = message.user;
      div.appendChild(sender);
    }
    
    const content = document.createElement('div');
    content.className = `message-content ${message.type || 'chat'}`;
    
    if (message.type === 'poll') {
      const pollData = JSON.parse(message.pollData || message.content);
      state.polls[pollData.id] = pollData;
      content.innerHTML = createPollHTML(pollData);
      content.dataset.pollId = pollData.id;
    } else if (message.type === 'reminder') {
      content.innerHTML = createReminderHTML(message);
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

function createReminderHTML(message) {
  const reminderData = JSON.parse(message.reminderData || '{}');
  return `
    <div>
      <strong>⏰ ${reminderData.text}</strong>
      <div style="font-size: 0.85rem; margin-top: 0.25rem; opacity: 0.9;">
        📅 ${new Date(reminderData.time).toLocaleString()}
      </div>
      <button 
        onclick="convertReminderToNote('${message.timestamp}')" 
        style="background: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.5); color: white; padding: 0.375rem 0.75rem; border-radius: 6px; margin-top: 0.5rem; cursor: pointer; font-size: 0.8125rem;"
      >
        💾 Save as Note
      </button>
    </div>
  `;
}

window.convertReminderToNote = function(messageTimestamp) {
  const message = state.messages.find(m => m.timestamp === messageTimestamp);
  if (!message) return;
  
  const reminderData = JSON.parse(message.reminderData);
  const noteContent = `${reminderData.text}\nScheduled for: ${new Date(reminderData.time).toLocaleString()}`;
  
  const note = { 
    text: noteContent, 
    id: Date.now(), 
    user: state.currentUser,
    fromReminder: true
  };
  state.savedItems.push(note);
  addSavedItem(note);
  
  sendWS({
    type: 'reminder_to_note',
    originalMessage: messageTimestamp,
    noteContent: noteContent,
    user: state.currentUser,
    timestamp: new Date().toISOString()
  });
  
  // Show success message
  const notif = document.createElement('div');
  notif.className = 'system-message';
  notif.textContent = '✅ Reminder saved as note!';
  elements.messagesArea.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
};

function handleReminderConversion(data) {
  const note = {
    text: data.noteContent,
    id: Date.now(),
    user: data.user,
    fromReminder: true
  };
  
  if (data.user !== state.currentUser) {
    state.savedItems.push(note);
    addSavedItem(note);
  }
  
  const notif = document.createElement('div');
  notif.className = 'system-message';
  notif.textContent = `${data.user} saved a reminder as note`;
  elements.messagesArea.appendChild(notif);
};

function createPollHTML(poll) {
  const totalVotes = (poll.votes?.[0]?.length || 0) + (poll.votes?.[1]?.length || 0);
  
  return `
    <div class="poll-question">${poll.question}</div>
    ${poll.options.map((option, index) => {
      const votes = poll.votes?.[index] || [];
      const percentage = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;
      const hasVoted = votes.includes(state.currentUser);
      
      return `
        <div class="poll-option ${hasVoted ? 'selected' : ''}" onclick="votePoll('${poll.id}', ${index})">
          <span class="poll-option-text">${option}</span>
          ${votes.length > 0 ? `
            <div class="poll-votes">
              <div class="poll-voters">
                ${votes.map(voter => `<span class="poll-voter-badge">${voter}</span>`).join('')}
              </div>
              <span class="poll-percentage">${percentage}%</span>
            </div>
            <div class="poll-progress-bar">
              <div class="poll-progress-fill" style="width: ${percentage}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('')}
  `;
}

window.votePoll = function(pollId, option) {
  const poll = state.polls[pollId];
  if (!poll) return;
  
  // Initialize votes if needed
  if (!poll.votes) {
    poll.votes = [[], []];
  }
  
  // Remove user's previous vote
  poll.votes.forEach(voteArray => {
    const index = voteArray.indexOf(state.currentUser);
    if (index > -1) voteArray.splice(index, 1);
  });
  
  // Add new vote
  poll.votes[option].push(state.currentUser);
  
  // Broadcast vote
  sendWS({
    type: 'poll_vote',
    pollId: pollId,
    option: option,
    user: state.currentUser,
    pollData: JSON.stringify(poll)
  });
  
  // Update UI
  updatePollUI(pollId);
};

function updatePollVote(pollId, option, user) {
  const poll = state.polls[pollId];
  if (!poll) return;
  
  // Initialize votes if needed
  if (!poll.votes) {
    poll.votes = [[], []];
  }
  
  // Remove user's previous vote
  poll.votes.forEach(voteArray => {
    const index = voteArray.indexOf(user);
    if (index > -1) voteArray.splice(index, 1);
  });
  
  // Add new vote
  poll.votes[option].push(user);
  
  // Update UI
  updatePollUI(pollId);
}

function updatePollUI(pollId) {
  const pollElement = document.querySelector(`[data-poll-id="${pollId}"]`);
  if (!pollElement) return;
  
  const poll = state.polls[pollId];
  pollElement.innerHTML = createPollHTML(poll);
}

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
    elements.menuOverlay.classList.add('active');
  });
  
  const closeMenu = () => {
    elements.sideMenu.classList.remove('active');
    elements.menuOverlay.classList.remove('active');
  };
  
  elements.closeMenuBtn.addEventListener('click', closeMenu);
  elements.menuOverlay.addEventListener('click', closeMenu);
  
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
      state.polls = {};
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
        content: `⏰ ${text}`,
        reminderData: JSON.stringify(reminder),
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
      const todo = { text, urgent, id: Date.now(), completed: false };
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
        id: Date.now().toString(),
        question,
        options: [option1, option2],
        votes: [[], []]
      };
      
      state.polls[poll.id] = poll;
      
      sendWS({
        type: 'poll',
        content: '',
        pollData: JSON.stringify(poll),
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
  div.dataset.noteId = note.id;
  div.innerHTML = `
    ${note.text}
    ${note.fromReminder ? '<span style="font-size: 0.75rem; opacity: 0.8;"> (from reminder)</span>' : ''}
    <button class="saved-item-delete" onclick="deleteSavedItem(${note.id})">✕</button>
  `;
  elements.savedItemsList.appendChild(div);
}

window.deleteSavedItem = function(id) {
  state.savedItems = state.savedItems.filter(item => item.id !== id);
  const item = elements.savedItemsList.querySelector(`[data-note-id="${id}"]`);
  if (item) item.remove();
  
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
      const tag = item.fromReminder ? ' [From Reminder]' : '';
      preview += `${i + 1}. ${item.text}${tag}\n`;
    });
    preview += `\n`;
  }
  
  if (state.todos.length > 0) {
    preview += `✅ TO-DO LIST:\n`;
    state.todos.forEach((item, i) => {
      const prefix = item.urgent ? '🚨' : '•';
      const status = item.completed ? '[✓]' : '[ ]';
      preview += `${prefix} ${status} ${item.text}\n`;
    });
    preview += `\n`;
  }
  
  if (state.reminders.length > 0) {
    preview += `⏰ REMINDERS:\n`;
    state.reminders.forEach((item, i) => {
      preview += `• ${item.text} - ${new Date(item.time).toLocaleString()}\n`;
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
