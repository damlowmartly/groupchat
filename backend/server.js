<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Collaborator Calendar</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: #0a0e27;
  color: #fff;
  margin: 0;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #00ff41;
}

.calendar {
  max-width: 900px;
  margin: auto;
  background: #111;
  border-radius: 10px;
  padding: 20px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calendar-header button {
  background: #00ff41;
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  font-weight: bold;
}

.weekdays, .days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-top: 10px;
}

.weekdays div {
  text-align: center;
  color: #0ff;
  font-weight: bold;
}

.day {
  min-height: 100px;
  border: 1px solid #222;
  padding: 5px;
  cursor: pointer;
  position: relative;
}

.day:hover {
  background: #1a1f4a;
}

.day-number {
  font-size: 0.9em;
  opacity: 0.7;
}

.task-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 3px;
}

/* Task Panel */
.task-panel {
  margin-top: 20px;
  background: #111;
  border-radius: 10px;
  padding: 15px;
}

.task {
  padding: 10px;
  border-left: 6px solid;
  margin-bottom: 8px;
  background: #1a1a1a;
}

.task-time {
  font-size: 0.85em;
  color: #aaa;
}

/* Create Task */
.create-task {
  margin-top: 20px;
  background: #111;
  border-radius: 10px;
  padding: 15px;
}

.create-task input, textarea {
  width: 100%;
  margin-bottom: 10px;
  padding: 8px;
}

.create-task button {
  background: #00ff41;
  border: none;
  padding: 10px;
  width: 100%;
  font-weight: bold;
  cursor: pointer;
}
</style>
</head>
<body>

<h1>📅 Collaborator Task Calendar</h1>

<div class="calendar">
  <div class="calendar-header">
    <button onclick="prevMonth()">◀</button>
    <h2 id="monthYear"></h2>
    <button onclick="nextMonth()">▶</button>
  </div>

  <div class="weekdays">
    <div>Sun</div><div>Mon</div><div>Tue</div>
    <div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
  </div>

  <div class="days" id="calendarDays"></div>
</div>

<div class="task-panel">
  <h3 id="selectedDateTitle">Select a date</h3>
  <div id="taskList"></div>
</div>

<div class="create-task">
  <h3>➕ Create Task</h3>
  <input type="date" id="taskDate">
  <input type="time" id="taskTime">
  <input type="text" id="taskTitle" placeholder="Task title">
  <textarea id="taskDesc" placeholder="Task description"></textarea>
  <button onclick="addTask()">Create Task</button>
</div>

<script>
let currentDate = new Date();
let selectedDate = null;
let tasks = JSON.parse(localStorage.getItem('calendarTasks')) || [];

const colors = [
  '#00ff41', '#0ff', '#ff00ff', '#ffa500',
  '#00ffff', '#ff4444', '#9b59b6'
];

function saveTasks() {
  localStorage.setItem('calendarTasks', JSON.stringify(tasks));
}

function renderCalendar() {
  const daysEl = document.getElementById('calendarDays');
  daysEl.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById('monthYear').textContent =
    currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    daysEl.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.onclick = () => selectDate(dateStr);

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    dayEl.appendChild(num);

    tasks
      .filter(t => t.date === dateStr)
      .forEach(t => {
        const dot = document.createElement('span');
        dot.className = 'task-dot';
        dot.style.background = t.color;
        dayEl.appendChild(dot);
      });

    daysEl.appendChild(dayEl);
  }
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  document.getElementById('selectedDateTitle').textContent =
    `Tasks on ${dateStr}`;
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('taskList');
  list.innerHTML = '';

  tasks
    .filter(t => t.date === selectedDate)
    .sort((a,b) => a.time.localeCompare(b.time))
    .forEach(t => {
      const div = document.createElement('div');
      div.className = 'task';
      div.style.borderColor = t.color;
      div.innerHTML = `
        <strong>${t.title}</strong>
        <div class="task-time">⏰ ${t.time}</div>
        <div>${t.desc}</div>
      `;
      list.appendChild(div);
    });
}

function addTask() {
  const date = document.getElementById('taskDate').value;
  const time = document.getElementById('taskTime').value;
  const title = document.getElementById('taskTitle').value;
  const desc = document.getElementById('taskDesc').value;

  if (!date || !time || !title) {
    alert('Fill date, time and title');
    return;
  }

  const color = colors[tasks.length % colors.length];

  tasks.push({ date, time, title, desc, color });
  saveTasks();
  renderCalendar();

  if (date === selectedDate) renderTasks();

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

renderCalendar();
</script>

</body>
</html>
