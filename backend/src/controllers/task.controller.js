// src/controllers/task.controller.js
//
// Developer Notes:
// Task mutation is split by role — Admins have full CRUD, Members can only
// update `status` on tasks assigned to them. This single-responsibility
// split keeps the permission logic explicit and easy to audit.
//
// Why we don't use a separate PATCH /status endpoint:
// Keeping one PATCH /:taskId handler and branching by role inside is simpler
// than duplicating route definitions. The tradeoff is slightly more logic
// inside one function — acceptable at this scale.
//
// TODO: Add task activity log (who changed what, when) for audit trail.

const prisma = require('../utils/prisma');

// -------------------------------------------------------------------
// POST /api/projects/:projectId/tasks  [Admin only]
// -------------------------------------------------------------------
const createTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description, dueDate, priority = 'MEDIUM' } = req.body;

    // Empty string from the frontend select dropdown must be coerced to null —
    // Prisma will throw a foreign key error if an empty string is passed as a UUID
    const assigneeUserId = req.body.assignedTo || null;

    if (!title) return res.status(400).json({ error: 'Task title is required' });

    console.log(`[Tasks] Creating task "${title}" in projectId: ${projectId} — assignee: ${assigneeUserId || 'unassigned'}`);

    // Validate that the assignee is actually a project member before saving
    // Prevents assigning tasks to users who have been removed from the project
    if (assigneeUserId) {
      const assigneeMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: assigneeUserId } },
      });
      if (!assigneeMembership) {
        console.log(`[Tasks] Validation failed — userId: ${assigneeUserId} is not a member of projectId: ${projectId}`);
        return res.status(400).json({ error: 'Assignee is not a member of this project' });
      }
    }

    const taskPayload = {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
      projectId,
      assignedTo: assigneeUserId,
      createdById: req.user.id,
    };

    const createdTask = await prisma.task.create({
      data: taskPayload,
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    console.log(`[Tasks] Task created — taskId: ${createdTask.id}`);
    return res.status(201).json(createdTask);

  } catch (err) {
    console.error('[Tasks] Error creating task:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// PATCH /api/projects/:projectId/tasks/:taskId
// -------------------------------------------------------------------
// Admins: can update all fields (title, description, priority, due date, assignee, status)
// Members: can only update `status`, and only for tasks assigned to them
const updateTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, dueDate, priority, status } = req.body;

    // Coerce empty string assignedTo to null (same reason as createTask)
    const assigneeUserId = req.body.assignedTo === '' ? null : req.body.assignedTo;

    console.log(`[Tasks] Update requested — taskId: ${taskId} by userId: ${req.user.id}`);

    const memberRecord = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!memberRecord) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // --- MEMBER PATH: restricted to status update on own tasks only ---
    if (memberRecord.role === 'MEMBER') {
      if (existingTask.assignedTo !== req.user.id) {
        console.log(`[Tasks] Permission denied — userId: ${req.user.id} tried to update taskId: ${taskId} not assigned to them`);
        return res.status(403).json({ error: 'You can only update status of tasks assigned to you' });
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status },
        include: {
          assignee: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
      });

      console.log(`[Tasks] Member status update — taskId: ${taskId} → status: ${status}`);
      return res.json(updatedTask);
    }

    // --- ADMIN PATH: can update any field ---
    // We use conditional spread to only include fields that were actually sent,
    // so a PATCH with only `status` doesn't accidentally null out other fields
    const adminUpdatePayload = {
      ...(title && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(assigneeUserId !== undefined && { assignedTo: assigneeUserId }),
    };

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: adminUpdatePayload,
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    console.log(`[Tasks] Admin update complete — taskId: ${taskId}`);
    return res.json(updatedTask);

  } catch (err) {
    console.error('[Tasks] Error updating task:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// DELETE /api/projects/:projectId/tasks/:taskId  [Admin only]
// -------------------------------------------------------------------
const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    console.log(`[Tasks] Deleting taskId: ${taskId} — requested by userId: ${req.user.id}`);

    await prisma.task.delete({ where: { id: taskId } });

    console.log(`[Tasks] Task deleted — taskId: ${taskId}`);
    return res.json({ message: 'Task deleted successfully' });

  } catch (err) {
    console.error('[Tasks] Error deleting task:', err.message);
    next(err);
  }
};

module.exports = { createTask, updateTask, deleteTask };
