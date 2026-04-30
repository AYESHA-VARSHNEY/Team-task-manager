// src/controllers/task.controller.js
const prisma = require('../utils/prisma');

// Create task (Admin only)
const createTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description, dueDate, priority = 'MEDIUM' } = req.body;
    // Convert empty string to null for assignedTo
    const assignedTo = req.body.assignedTo || null;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Verify assignee is a member
    if (assignedTo) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: assignedTo } },
      });
      if (!member) return res.status(400).json({ error: 'Assignee is not a project member' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        projectId,
        assignedTo,
        createdById: req.user.id,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

// Update task status (Members can update their own; Admins can update any)
const updateTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, dueDate, priority, status } = req.body;
    // Convert empty string to null
    const assignedTo = req.body.assignedTo === '' ? null : req.body.assignedTo;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a project member' });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Members can only update status of tasks assigned to them
    if (member.role === 'MEMBER') {
      if (task.assignedTo !== req.user.id) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      }
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: { status },
        include: { assignee: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } } },
      });
      return res.json(updated);
    }

    // Admin can update everything
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(assignedTo !== undefined && { assignedTo }),
      },
      include: { assignee: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete task (Admin only)
const deleteTask = async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.taskId } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTask, updateTask, deleteTask };
