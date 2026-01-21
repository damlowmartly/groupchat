// backend/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Use JSON middleware for POST requests
app.use(express.json());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Simple in-memory task storage (replace with DB for production)
let tasks = [];

// Endpoint to get all tasks
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

// Endpoint to add a new task
app.post('/tasks', (req, res) => {
  const { date, time, title, desc, color } = req.body;
  if (!date || !time || !title) {
    return res.status(400).json({ error: 'Missing date, time, or title' });
  }

  const newTask = { date, time, title, desc: desc || '', color };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

// Fallback: serve index.html for all other routes (for SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
