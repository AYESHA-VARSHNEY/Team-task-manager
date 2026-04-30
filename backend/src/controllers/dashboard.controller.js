// src/controllers/dashboard.controller.js
const prisma = require('../utils/prisma');

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // All projects user is part of
    const memberProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberProjects.map(m => m.projectId);

    // All tasks across those projects
    const allTasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // My tasks (assigned to me)
    const myTasks = allTasks.filter(t => t.assignedTo === userId);

    // Stats
    const totalTasks = allTasks.length;
    const byStatus = {
      TODO: allTasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
      DONE: allTasks.filter(t => t.status === 'DONE').length,
    };
    const overdueTasks = allTasks.filter(
      t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    );

    // Tasks per user (within user's projects)
    const tasksPerUser = {};
    allTasks.forEach(t => {
      if (t.assignee) {
        const key = t.assignee.name;
        tasksPerUser[key] = (tasksPerUser[key] || 0) + 1;
      }
    });

    res.json({
      totalTasks,
      byStatus,
      overdueTasks: overdueTasks.length,
      overdueTasksList: overdueTasks.slice(0, 5),
      tasksPerUser,
      myTasks: myTasks.slice(0, 5),
      projectCount: projectIds.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };