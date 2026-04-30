import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CheckSquare, FolderKanban, Clock, AlertCircle, Users, Plus, LogOut, ChevronRight, CheckCircle2, Circle, Timer } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const statusColor = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
};
const priorityColor = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, projRes] = await Promise.all([
          axios.get(`${API}/dashboard`, { headers }),
          axios.get(`${API}/projects`, { headers }),
        ]);
        setStats(statsRes.data);
        setProjects(projRes.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading your workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800">TaskFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Welcome, <span className="font-semibold text-gray-700">{user?.name || 'User'}</span>
          </span>
          <button onClick={logout}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <FolderKanban className="w-6 h-6 text-indigo-500" />
              <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">Total</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats?.projectCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Projects</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <span className="text-xs font-medium text-green-500 bg-green-50 px-2 py-1 rounded-full">Done</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats?.byStatus?.DONE ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Completed Tasks</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <Timer className="w-6 h-6 text-blue-500" />
              <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Active</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats?.byStatus?.IN_PROGRESS ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">In Progress</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">Urgent</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats?.overdueTasks ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Overdue Tasks</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Projects List */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">My Projects</h2>
              <Link to="/create-project"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> New Project
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No projects yet. Create your first one!</p>
                <Link to="/create-project"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">
                  <Plus className="w-4 h-4" /> Create Project
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <Link key={project.id} to={`/projects/${project.id}`}
                    className="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-gray-500 truncate mt-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" /> {project.members?.length || 0} members
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <CheckSquare className="w-3.5 h-3.5" /> {project._count?.tasks || 0} tasks
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors ml-3 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* My Tasks Sidebar */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">My Recent Tasks</h2>
            <div className="space-y-3">
              {(!stats?.myTasks || stats.myTasks.length === 0) ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                  <Circle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No tasks assigned to you yet</p>
                </div>
              ) : (
                stats.myTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-700 leading-snug">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[task.status]}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{task.project?.name}</p>
                  </div>
                ))
              )}
            </div>

            {/* Status breakdown */}
            {stats?.totalTasks > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Task Status Overview</h3>
                {[
                  { label: 'To Do', count: stats.byStatus.TODO, color: 'bg-gray-400' },
                  { label: 'In Progress', count: stats.byStatus.IN_PROGRESS, color: 'bg-blue-500' },
                  { label: 'Done', count: stats.byStatus.DONE, color: 'bg-green-500' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{label}</span><span>{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all`}
                        style={{ width: `${stats.totalTasks ? (count / stats.totalTasks) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
