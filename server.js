// ============================================
// HATO & JBRO COLLABORATION SERVER
// WebSocket-based real-time collaboration
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

// In-memory session data
const sessionData = {
  users: new Map(), // username -> ws connection
  messages: []
};

// Track connected users
const connectedUsers = new Set();

// ============================================
// WEBSOCKET CONNECTION HANDLER
// ============================================
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  let currentUser = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // ============================================
      // HANDLE USER LOGIN
      // ============================================
      if (data.type === 'login') {
        currentUser = data.user;
        sessionData.users.set(currentUser, ws);
        connectedUsers.add(currentUser);
        
        console.log(`${currentUser} connected`);
        
        // Send current session state to new user
        ws.send(JSON.stringify({
          type: 'session_state',
          messages: sessionData.messages
        }));
        
        // Broadcast online status to all users
        broadcastOnlineStatus();
        
        // Send system message
        const systemMsg = {
          type: 'system',
          content: `${currentUser} joined the session`,
          timestamp: new Date().toISOString()
        };
        sessionData.messages.push(systemMsg);
        broadcast(systemMsg);
      }
      
      // ============================================
      // HANDLE CHAT MESSAGES
      // ============================================
      else if (data.type === 'chat' || data.type === 'reminder' || data.type === 'todo' || 
               data.type === 'note' || data.type === 'poll' || data.type === 'important') {
        const msg = {
          type: data.type,
          user: currentUser,
          content: data.content,
          timestamp: data.timestamp || new Date().toISOString()
        };
        sessionData.messages.push(msg);
        broadcast(msg);
      }
      
      // ============================================
      // HANDLE CLEAR CHAT
      // ============================================
      else if (data.type === 'clear_chat') {
        sessionData.messages = [];
        broadcast({
          type: 'system',
          content: `Chat cleared by ${currentUser}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // ============================================
      // HANDLE SESSION SUMMARY REQUEST
      // ============================================
      else if (data.type === 'get_summary') {
        const summary = {
          type: 'session_summary',
          totalMessages: sessionData.messages.length,
          participants: Array.from(connectedUsers),
          messages: sessionData.messages
        };
        ws.send(JSON.stringify(summary));
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // ============================================
  // HANDLE DISCONNECTION
  // ============================================
  ws.on('close', () => {
    if (currentUser) {
      sessionData.users.delete(currentUser);
      connectedUsers.delete(currentUser);
      console.log(`${currentUser} disconnected`);
      
      // Broadcast system message
      const systemMsg = {
        type: 'system',
        content: `${currentUser} left the session`,
        timestamp: new Date().toISOString()
      };
      sessionData.messages.push(systemMsg);
      broadcast(systemMsg);
      
      // Update online status
      broadcastOnlineStatus();
    }
  });
});

// ============================================
// BROADCAST FUNCTIONS
// ============================================
function broadcast(data) {
  const message = JSON.stringify(data);
  sessionData.users.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

function broadcastOnlineStatus() {
  broadcast({
    type: 'online_status',
    users: Array.from(connectedUsers)
  });
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for Hato & Jbro collaboration`);
});
