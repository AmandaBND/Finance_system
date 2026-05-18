const express  = require('express');
const router   = express.Router();
const db       = require('../database');
const empAuth  = require('../middleware/employeeAuth');

router.use(empAuth);

function withResources(tasks, cid) {
  return tasks.map(t => ({
    ...t,
    resources: db.prepare('SELECT * FROM task_resources WHERE task_id=? AND company_id=? ORDER BY id').all(t.id, cid),
  }));
}

function elapsedSince(isoStr) {
  if (!isoStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000));
}

router.get('/tasks/notices', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const all = db.prepare(`SELECT * FROM employee_notices WHERE company_id=? AND is_active=1 ORDER BY created_at DESC`).all(companyId);
    const notices = all.filter(n => {
      if (n.target === 'all') return true;
      try {
        const ids = JSON.parse(n.employee_ids || '[]');
        return ids.includes(Number(employeeId));
      } catch { return false; }
    });
    res.json(notices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tasks', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const { status, date_from, date_to } = req.query;

    let sql = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.company_id=t.company_id
      WHERE t.company_id=? AND t.assigned_to = ?
    `;
    const params = [companyId, employeeId];

    if (status && status !== 'all') {
      if (status === 'ongoing') {
        sql += ` AND t.status IN ('in_progress','on_hold')`;
      } else if (status === 'upcoming') {
        sql += ` AND t.status = 'pending'`;
      } else {
        sql += ` AND t.status = ?`; params.push(status);
      }
    }
    if (date_from) { sql += ' AND t.due_date >= ?'; params.push(date_from); }
    if (date_to)   { sql += ' AND t.due_date <= ?'; params.push(date_to); }

    sql += ' ORDER BY CASE t.status WHEN \'overdue\' THEN 0 WHEN \'in_progress\' THEN 1 WHEN \'on_hold\' THEN 2 WHEN \'pending\' THEN 3 WHEN \'completed\' THEN 4 ELSE 5 END, t.due_date, t.priority';

    const tasks = db.prepare(sql).all(...params);
    res.json(withResources(tasks, companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tasks/:id/start', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const task = db.prepare('SELECT * FROM tasks WHERE company_id=? AND id=? AND assigned_to=?').get(companyId, req.params.id, employeeId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'completed') return res.status(400).json({ error: 'Task already completed' });
    if (task.status === 'overdue')   return res.status(400).json({ error: 'Task is overdue — cannot start' });
    if (task.timer_status === 'running') return res.json(withResources([task], companyId)[0]);

    db.prepare(`
      UPDATE tasks SET status='in_progress', timer_status='running',
        timer_started_at=datetime('now') WHERE id=? AND company_id=?
    `).run(task.id, companyId);

    const updated = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(task.id, companyId);
    res.json(withResources([updated], companyId)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tasks/:id/hold', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const task = db.prepare('SELECT * FROM tasks WHERE company_id=? AND id=? AND assigned_to=?').get(companyId, req.params.id, employeeId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.timer_status !== 'running') return res.status(400).json({ error: 'Timer is not running' });

    const extra = elapsedSince(task.timer_started_at);
    db.prepare(`
      UPDATE tasks SET status='on_hold', timer_status='paused',
        timer_started_at=NULL, total_seconds=total_seconds+?
      WHERE id=? AND company_id=?
    `).run(extra, task.id, companyId);

    const updated = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(task.id, companyId);
    res.json(withResources([updated], companyId)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tasks/:id/resume', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const task = db.prepare('SELECT * FROM tasks WHERE company_id=? AND id=? AND assigned_to=?').get(companyId, req.params.id, employeeId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'overdue') return res.status(400).json({ error: 'Task is overdue — cannot resume' });

    db.prepare(`
      UPDATE tasks SET status='in_progress', timer_status='running',
        timer_started_at=datetime('now') WHERE id=? AND company_id=?
    `).run(task.id, companyId);

    const updated = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(task.id, companyId);
    res.json(withResources([updated], companyId)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tasks/:id/complete', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const task = db.prepare('SELECT * FROM tasks WHERE company_id=? AND id=? AND assigned_to=?').get(companyId, req.params.id, employeeId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'overdue') return res.status(400).json({ error: 'Task is overdue — only admin can mark as completed' });
    if (task.status === 'completed') return res.status(400).json({ error: 'Task already completed' });

    const extra = task.timer_status === 'running' ? elapsedSince(task.timer_started_at) : 0;
    const totalSecs = (task.total_seconds || 0) + extra;

    db.prepare(`
      UPDATE tasks SET status='completed', timer_status='idle',
        timer_started_at=NULL, total_seconds=?,
        completed_at=datetime('now')
      WHERE id=? AND company_id=?
    `).run(totalSecs, task.id, companyId);

    const month = new Date().toISOString().slice(0, 7);
    const emp = db.prepare('SELECT name FROM employees WHERE id=? AND company_id=?').get(employeeId, companyId);
    db.prepare(`
      INSERT INTO employee_kpi (employee_id, employee_name, month, tasks_completed, company_id)
      VALUES (?,?,?,?,?)
      ON CONFLICT(employee_id, month) DO UPDATE SET tasks_completed = tasks_completed + 1
    `).run(employeeId, emp?.name || '', month, 1, companyId);

    const updated = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(task.id, companyId);
    res.json({ task: withResources([updated], companyId)[0], totalSeconds: totalSecs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/birthday-wish', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    const wish = db.prepare(
      `SELECT * FROM birthday_wishes WHERE company_id=? AND employee_id=? AND seen=0 ORDER BY sent_at DESC LIMIT 1`
    ).get(companyId, employeeId);
    res.json(wish || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/birthday-wish/seen', (req, res) => {
  try {
    const { employeeId, companyId } = req.employee;
    db.prepare(`UPDATE birthday_wishes SET seen=1 WHERE company_id=? AND employee_id=? AND seen=0`).run(companyId, employeeId);
    res.json({ message: 'Marked as seen' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
