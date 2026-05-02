// src/controllers/project.controller.js
//
// Project routes - all operations check req.user (set by auth middleware)
// Role checking (admin vs member) is handled in middleware, not here
// this keeps controllers focused on business logic only.
//
// TODO: Add pagination to getMyProjects once teams scale beyond ~50 projects.
// Prisma's `take` and `skip` can handle this without schema changes.

const prisma = require('../utils/prisma');

// -------------------------------------------------------------------
// POST /api/projects
// -------------------------------------------------------------------
// Why we create the ProjectMember record in the same transaction as the project:
// If we created them separately, a server crash between the two operations
// would leave a project with no admin — a data integrity bug.
// Prisma's nested `create` handles this atomically.
const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    console.log(`[Projects] Creating project "${name}" — createdBy userId: ${req.user.id}`);

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        createdBy: req.user.id,
        // Atomically enroll the creator as ADMIN member in the same DB transaction
        members: {
          create: { userId: req.user.id, role: 'ADMIN' },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    console.log(`[Projects] Project created — projectId: ${newProject.id}`);
    return res.status(201).json(newProject);

  } catch (err) {
    console.error('[Projects] Error creating project:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// GET /api/projects
// -------------------------------------------------------------------
// Returns only projects where the current user is a member (any role).
// We order by createdAt DESC so newest projects surface first.
const getMyProjects = async (req, res, next) => {
  try {
    console.log(`[Projects] Fetching projects for userId: ${req.user.id}`);

    const userProjects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: {
        creator: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        // _count avoids fetching all task records just to get a count
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[Projects] Found ${userProjects.length} projects for userId: ${req.user.id}`);
    return res.json(userProjects);

  } catch (err) {
    console.error('[Projects] Error fetching projects:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// GET /api/projects/:projectId
// -------------------------------------------------------------------
// Member access is verified here (not in middleware) because we need
// the member record anyway to determine currentUserRole for the frontend.
const getProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    console.log(`[Projects] Fetching project detail — projectId: ${projectId}, userId: ${req.user.id}`);

    const memberRecord = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!memberRecord) {
      console.log(`[Projects] Access denied — userId: ${req.user.id} is not a member of projectId: ${projectId}`);
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const projectDetails = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true } },
            creator: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Attach the current user's role so the frontend can conditionally
    // render admin-only controls (Add Task, Remove Member, etc.)
    return res.json({ ...projectDetails, currentUserRole: memberRecord.role });

  } catch (err) {
    console.error('[Projects] Error fetching project details:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// POST /api/projects/:projectId/members  [Admin only]
// -------------------------------------------------------------------
const addMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { email, role = 'MEMBER' } = req.body;

    console.log(`[Projects] Adding member with email: ${email} to projectId: ${projectId} as role: ${role}`);

    // Look up by email — frontend sends email, not userId,
    // which is the UX-friendly way for admins to invite teammates
    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      console.log(`[Projects] Add member failed — no user found for email: ${email}`);
      return res.status(404).json({ error: 'User not found. They must sign up first.' });
    }

    const existingMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: userToAdd.id } },
    });
    if (existingMembership) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    const newMemberDetails = await prisma.projectMember.create({
      data: { projectId, userId: userToAdd.id, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    console.log(`[Projects] Member added — userId: ${userToAdd.id} to projectId: ${projectId}`);
    return res.status(201).json(newMemberDetails);

  } catch (err) {
    console.error('[Projects] Error adding member:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// DELETE /api/projects/:projectId/members/:userId  [Admin only]
// -------------------------------------------------------------------
const removeMember = async (req, res, next) => {
  try {
    const { projectId, userId: targetUserId } = req.params;

    // Prevent admins from accidentally locking themselves out of a project
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself from the project' });
    }

    console.log(`[Projects] Removing userId: ${targetUserId} from projectId: ${projectId}`);

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    console.log(`[Projects] Member removed successfully`);
    return res.json({ message: 'Member removed from project' });

  } catch (err) {
    console.error('[Projects] Error removing member:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// DELETE /api/projects/:projectId  [Admin only]
// -------------------------------------------------------------------
// Prisma cascade deletes handle ProjectMembers and Tasks automatically
// because of `onDelete: Cascade` in the schema relations.
// TODO: Add a soft-delete / archive pattern before production use
// so teams can recover accidentally deleted projects.
const deleteProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    console.log(`[Projects] Deleting projectId: ${projectId} — requested by userId: ${req.user.id}`);

    await prisma.project.delete({ where: { id: projectId } });

    console.log(`[Projects] Project deleted — projectId: ${projectId}`);
    return res.json({ message: 'Project deleted successfully' });

  } catch (err) {
    console.error('[Projects] Error deleting project:', err.message);
    next(err);
  }
};

module.exports = {
  createProject,
  getMyProjects,
  getProject,
  addMember,
  removeMember,
  deleteProject,
};
