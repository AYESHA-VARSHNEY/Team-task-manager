// src/controllers/dashboard.controller.js
//
// Developer Notes:
// This endpoint aggregates stats for the current user's dashboard view.
// We fetch all tasks across the user's projects in a single query and
// compute stats in-memory (JS filter) rather than multiple DB queries.
//
// Why in-memory aggregation instead of Prisma groupBy?
// For the data volumes expected here (<500 tasks per user), JS filter
// is faster end-to-end than multiple round-trips to the DB.
// If this becomes a bottleneck, switch to Prisma's `groupBy` or raw SQL.
//
// TODO: Cache this response (e.g. Redis, 30s TTL) once user counts grow,
// since this is likely the most-called endpoint in the app.

const prisma = require('../utils/prisma');

// -------------------------------------------------------------------
// GET /api/dashboard
// -------------------------------------------------------------------
const getDashboard = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const currentTime = new Date();

    console.log(`[Dashboard] Building stats for userId: ${currentUserId}`);

    // get all projects this user is part of
    const userMemberships = await prisma.projectMember.findMany({
      where: { userId: currentUserId },
      select: { projectId: true },
    });
    const memberProjectIds = userMemberships.map(m => m.projectId);

    console.log(`[Dashboard] User is member of ${memberProjectIds.length} projects`);

    // fetch all tasks from those projects in one go
    // We include assignee and project name for the "My Tasks" sidebar
    const allProjectTasks = await prisma.task.findMany({
      where: { projectId: { in: memberProjectIds } },
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    console.log(`[Dashboard] Total tasks across projects: ${allProjectTasks.length}`);

    // Step 3: Tasks specifically assigned to the current user (for "My Tasks" panel)
    const myAssignedTasks = allProjectTasks.filter(t => t.assignedTo === currentUserId);

    // Step 4: Status breakdown — counts used for the stats cards
    const taskCountByStatus = {
      TODO: allProjectTasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: allProjectTasks.filter(t => t.status === 'IN_PROGRESS').length,
      DONE: allProjectTasks.filter(t => t.status === 'DONE').length,
    };

    // Step 5: Overdue tasks — past due date AND still in TODO (not started)
    // We only flag TODO tasks as overdue — IN_PROGRESS means someone is actively
    // working on it, which shouldn't be highlighted as an urgent problem
    const overdueTasksList = allProjectTasks.filter(
      t => t.dueDate && new Date(t.dueDate) < currentTime && t.status === 'TODO'
    );

    console.log(`[Dashboard] Overdue (TODO + past due): ${overdueTasksList.length}`);

    // Step 6: Tasks per team member — used for workload distribution view
    const taskCountPerUser = {};
    allProjectTasks.forEach(task => {
      if (task.assignee) {
        const memberName = task.assignee.name;
        taskCountPerUser[memberName] = (taskCountPerUser[memberName] || 0) + 1;
      }
    });

    return res.json({
      projectCount: memberProjectIds.length,
      totalTasks: allProjectTasks.length,
      byStatus: taskCountByStatus,
      overdueTasks: overdueTasksList.length,
      overdueTasksList: overdueTasksList.slice(0, 5),
      tasksPerUser: taskCountPerUser,
      myTasks: myAssignedTasks.slice(0, 5), // cap at 5 for sidebar display
    });

  } catch (err) {
    console.error('[Dashboard] Error building dashboard stats:', err.message);
    next(err);
  }
};

module.exports = { getDashboard };
