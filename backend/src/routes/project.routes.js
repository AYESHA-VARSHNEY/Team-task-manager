// src/routes/project.routes.js
const express = require('express');
const { authenticate, requireProjectAdmin } = require('../middleware/auth.middleware');
const {
  createProject, getMyProjects, getProject,
  addMember, removeMember, deleteProject,
} = require('../controllers/project.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', getMyProjects);
router.post('/', createProject);
router.get('/:projectId', getProject);
router.delete('/:projectId', requireProjectAdmin, deleteProject);
router.post('/:projectId/members', requireProjectAdmin, addMember);
router.delete('/:projectId/members/:userId', requireProjectAdmin, removeMember);

module.exports = router;