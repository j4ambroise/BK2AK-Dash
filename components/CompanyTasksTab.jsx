import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 30000; // background sync every 30s while the tab is open

const STATUS_OPTIONS = ['Not Started', 'Working on it', 'Done', 'Stuck'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

const STATUS_COLORS = {
  'Not Started': 'bg-neutral-700 text-neutral-200',
  'Working on it': 'bg-amber-600/80 text-white',
  Done: 'bg-emerald-600/80 text-white',
  Stuck: 'bg-red-600/80 text-white',
};

export default function CompanyTasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', status: 'Not Started', priority: 'Low', due_date: '', notes: '' });
  const [savingNew, setSavingNew] = useState(false);
  const pollRef = useRef(null);

  const fetchTasks = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/company-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      if (!isBackground) setError('Could not load tasks. Monday sync may be temporarily unavailable.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    pollRef.current = setInterval(() => fetchTasks(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchTasks]);

  async function patchTask(id, updates) {
    // optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    try {
      const res = await fetch(`/api/company-tasks?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch (e) {
      setError('Update failed to sync to Monday. Refresh to check the current state.');
      fetchTasks();
    }
  }

  async function createTask() {
    if (!newTask.title.trim()) {
      setError('Give the task a title before saving.');
      return;
    }
    setSavingNew(true);
    setError(null);
    try {
      const res = await fetch('/api/company-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (!res.ok) throw new Error('Create failed');
      setNewTask({ title: '', status: 'Not Started', priority: 'Low', due_date: '', notes: '' });
      setShowNewForm(false);
      await fetchTasks();
    } catch (e) {
      setError('Could not create the task in Monday. Try again.');
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <p className="text-xs text-neutral-500">Synced with the BK2AK Monday board · updates every 30s</p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          + New task
        </button>
      </div>

      {error && <div className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</div>}

      {showNewForm && (
        <div className="flex flex-col gap-2 rounded border border-neutral-800 bg-neutral-950 p-3">
          <input
            value={newTask.title}
            onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
            placeholder="Task title"
            className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-white outline-none focus:border-neutral-500"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={newTask.status}
              onChange={(e) => setNewTask((t) => ({ ...t, status: e.target.value }))}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value }))}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask((t) => ({ ...t, due_date: e.target.value }))}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
            />
          </div>
          <textarea
            value={newTask.notes}
            onChange={(e) => setNewTask((t) => ({ ...t, notes: e.target.value }))}
            placeholder="Notes"
            className="min-h-[60px] rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-white outline-none focus:border-neutral-500"
          />
          <div className="flex gap-2">
            <button
              onClick={createTask}
              disabled={savingNew}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {savingNew ? 'Creating…' : 'Create in Monday'}
            </button>
            <button onClick={() => setShowNewForm(false)} className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      {!loading && tasks.length === 0 && (
        <div className="text-sm text-neutral-500">No tasks yet. Create one above, or add it on the Monday board directly.</div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-950 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{task.title}</div>
              {task.notes && <div className="truncate text-xs text-neutral-500">{task.notes}</div>}
            </div>

            <select
              value={task.status}
              onChange={(e) => patchTask(task.id, { status: e.target.value })}
              className={`rounded px-2 py-1 text-xs font-medium outline-none ${STATUS_COLORS[task.status] || 'bg-neutral-700 text-neutral-200'}`}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={task.priority}
              onChange={(e) => patchTask(task.id, { priority: e.target.value })}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <input
              type="date"
              value={task.due_date || ''}
              onChange={(e) => patchTask(task.id, { due_date: e.target.value })}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
            />

            {task.assignee && (
              <span className="shrink-0 text-xs text-neutral-500">{task.assignee}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
