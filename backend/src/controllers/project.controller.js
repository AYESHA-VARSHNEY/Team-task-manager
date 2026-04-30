// src/controllers/project.controller.js
const prisma = require('../utils/prisma');

// Create project — creator becomes ADMIN member
const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const project = await prisma.project.create({
      data: {
        name,
        description,
        createdBy: req.user.id,
        members: {
          create: { userId: req.user.id, role: 'ADMIN' },
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// Get all projects where current user is a member
const getMyProjects = async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: {
        creator: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

// Get single project
const getProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member of this project' });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true } },
            creator: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json({ ...project, currentUserRole: member.role });
  } catch (err) {
    next(err);
  }
};

// Add member (Admin only)
const addMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { email, role = 'MEMBER' } = req.body;

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) return res.status(404).json({ error: 'User not found' });

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: userToAdd.id } },
    });
    if (existing) return res.status(409).json({ error: 'User already a member' });

    const member = await prisma.projectMember.create({
      data: { projectId, userId: userToAdd.id, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
};

// Remove member (Admin only)
const removeMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

// Delete project (Admin only)
const deleteProject = async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.projectId } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createProject, getMyProjects, getProject, addMember, removeMember, deleteProject };