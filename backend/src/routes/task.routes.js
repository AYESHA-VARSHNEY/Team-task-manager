// src/routes/task.routes.js
const express = require('express');
const { authenticate, requireProjectAdmin } = require('../middleware/auth.middleware');
const { createTask, updateTask, deleteTask } = require('../controllers/task.controller');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Tasks are nested under projects: /api/projects/:projectId/tasks
router.post('/', requireProjectAdmin, createTask);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', requireProjectAdmin, deleteTask);

module.exports = router;