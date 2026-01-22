const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON parsing
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory tasks
let tasks = [];

// API endpoints
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/tasks', (req, res) => {
  const { date, time, title, desc, color } = req.body;
  if (!date || !time || !title) {
    return res.status(400).json({ error: 'Missing date, time, or title' });
  }
  const newTask = { date, time, title, desc: desc || '', color };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

// ✅ Express 5 SPA fallback (MUST be app.use)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
