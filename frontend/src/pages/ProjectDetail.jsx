import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, ArrowLeft, Plus, Trash2, UserPlus, Users, X, Edit2, Check, LogOut } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const priorityColor = { LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700', HIGH: 'bg-red-100 text-red-700' };
const STATUS_COLS = ['TODO', 'IN_PROGRESS', 'DONE'];
const statusLabel = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
const statusColColor = { TODO: 'border-gray-300 bg-gray-50', IN_PROGRESS: 'border-blue-300 bg-blue-50', DONE: 'border-green-300 bg-green-50' };

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchProject = async () => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}`, { headers });
      setProject(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [projectId]);

  const isAdmin = project?.currentUserRole === 'ADMIN';

  const createTask = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(`${API}/projects/${projectId}/tasks`, taskForm, { headers });
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
      fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(`${API}/projects/${projectId}/tasks/${taskId}`, { status }, { headers });
      fetchProject();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task');
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/projects/${projectId}/tasks/${taskId}`, { headers });
      fetchProject();
    } catch (err) {
      alert('Failed to delete task');
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(`${API}/projects/${projectId}/members`, { email: memberEmail, role: memberRole }, { headers });
      setShowAddMember(false);
      setMemberEmail('');
      fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await axios.delete(`${API}/projects/${projectId}/members/${memberId}`, { headers });
      fetchProject();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!project) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Project not found or access denied.</p>
        <Link to="/dashboard" className="text-indigo-600 font-semibold">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const tasksByStatus = STATUS_COLS.reduce((acc, s) => {
    acc[s] = project.tasks?.filter(t => t.status === s) || [];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800">{project.name}</span>
          </div>
          {isAdmin && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-red-500 hover:text-red-600 text-sm">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            {project.description && <p className="text-gray-500 mt-1">{project.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button onClick={() => { setShowAddMember(true); setError(''); }}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-indigo-400 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  <UserPlus className="w-4 h-4" /> Add Member
                </button>
                <button onClick={() => { setShowAddTask(true); setError(''); }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              </>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-700 text-sm">Team Members</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.members?.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700">
                  {m.user.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">{m.user.name}</p>
                  <p className="text-xs text-gray-400">{m.role}</p>
                </div>
                {isAdmin && m.user.id !== user?.id && (
                  <button onClick={() => removeMember(m.user.id)} className="ml-1 text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STATUS_COLS.map(status => (
            <div key={status} className={`rounded-2xl border-2 ${statusColColor[status]} p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700 text-sm">{statusLabel[status]}</h3>
                <span className="text-xs bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-medium">
                  {tasksByStatus[status].length}
                </span>
              </div>
              <div className="space-y-3 min-h-16">
                {tasksByStatus[status].map(task => (
                  <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                      {isAdmin && (
                        <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{task.description}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[task.priority]}`}>{task.priority}</span>
                      {task.dueDate && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {task.assignee && (
                      <p className="text-xs text-gray-400 mb-3">
                        Assigned to: <span className="font-medium text-gray-600">{task.assignee.name}</span>
                      </p>
                    )}
                    {/* Status change buttons */}
                    {(isAdmin || task.assignedTo === user?.id) && (
                      <div className="flex gap-1 flex-wrap">
                        {STATUS_COLS.filter(s => s !== status).map(s => (
                          <button key={s} onClick={() => updateTaskStatus(task.id, s)}
                            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-400 px-2 py-1 rounded-lg transition-colors">
                            → {statusLabel[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Add New Task</h3>
              <button onClick={() => setShowAddTask(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <form onSubmit={createTask} className="space-y-4">
              <input type="text" required placeholder="Task title" value={taskForm.title}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              <textarea placeholder="Description (optional)" value={taskForm.description}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-24 resize-none"
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
                  <select value={taskForm.priority}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Due Date</label>
                  <input type="date" value={taskForm.dueDate}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Assign To</label>
                <select value={taskForm.assignedTo}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}>
                  <option value="">Unassigned</option>
                  {project.members?.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddTask(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Add Member</h3>
              <button onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <form onSubmit={addMember} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Member Email</label>
                <input type="email" required placeholder="member@example.com" value={memberEmail}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  onChange={(e) => setMemberEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
                <select value={memberRole}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  onChange={(e) => setMemberRole(e.target.value)}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddMember(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
