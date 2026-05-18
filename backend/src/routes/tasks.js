const express = require('express');
const router  = express.Router();
const db      = require('../database');

function withResources(tasks, cid) {
  return tasks.map(t => ({
    ...t,
    resources: db.prepare('SELECT * FROM task_resources WHERE task_id=? AND company_id=? ORDER BY id').all(t.id, cid),
  }));
}

router.get('/calendar', (req, res) => {
  try {
    const cid = req.companyId;
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });
    const [year, mon] = month.split('-');
    const start = `${year}-${mon}-01`;
    const end = new Date(+year, +mon, 0).toISOString().split('T')[0];

    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name,
             e.name as employee_display_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.company_id=t.company_id
      LEFT JOIN employees e ON e.id = t.assigned_to AND e.company_id=t.company_id
      WHERE t.company_id=? AND ((t.due_date BETWEEN ? AND ?) OR (t.start_date BETWEEN ? AND ?))
      ORDER BY t.due_date, t.due_time
    `).all(cid, start, end, start, end);

    const events = db.prepare(`
      SELECT * FROM calendar_events
      WHERE company_id=? AND event_date BETWEEN ? AND ?
      ORDER BY event_date, event_time
    `).all(cid, start, end);

    res.json({ tasks: withResources(tasks, cid), events });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/calendar/events', (req, res) => {
  try {
    const cid = req.companyId;
    const { title, description, event_date, event_time, color } = req.body;
    if (!title?.trim() || !event_date) return res.status(400).json({ error: 'title and event_date required' });
    const r = db.prepare(`
      INSERT INTO calendar_events (title, description, event_date, event_time, color, company_id)
      VALUES (?,?,?,?,?,?)
    `).run(title.trim(), description || '', event_date, event_time || null, color || 'blue', cid);
    res.json(db.prepare('SELECT * FROM calendar_events WHERE id=? AND company_id=?').get(r.lastInsertRowid, cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/calendar/events/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { title, description, event_date, event_time, color } = req.body;
    const r = db.prepare(`
      UPDATE calendar_events SET title=?, description=?, event_date=?, event_time=?, color=?
      WHERE id=? AND company_id=?
    `).run(title, description || '', event_date, event_time || null, color || 'blue', req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json(db.prepare('SELECT * FROM calendar_events WHERE id=? AND company_id=?').get(req.params.id, cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/calendar/events/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM calendar_events WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/notices', (req, res) => {
  try {
    const notices = db.prepare('SELECT * FROM employee_notices WHERE company_id=? ORDER BY created_at DESC').all(req.companyId);
    res.json(notices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notices', (req, res) => {
  try {
    const cid = req.companyId;
    const { title, message, target, employee_ids } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message required' });
    const r = db.prepare(`
      INSERT INTO employee_notices (title, message, target, employee_ids, company_id)
      VALUES (?,?,?,?,?)
    `).run(title.trim(), message.trim(), target || 'all', JSON.stringify(employee_ids || []), cid);
    res.json(db.prepare('SELECT * FROM employee_notices WHERE id=? AND company_id=?').get(r.lastInsertRowid, cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notices/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { title, message, target, employee_ids, is_active } = req.body;
    const r = db.prepare(`
      UPDATE employee_notices SET title=?, message=?, target=?, employee_ids=?, is_active=?
      WHERE id=? AND company_id=?
    `).run(title, message, target || 'all', JSON.stringify(employee_ids || []),
      is_active !== undefined ? (is_active ? 1 : 0) : 1, req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json(db.prepare('SELECT * FROM employee_notices WHERE id=? AND company_id=?').get(req.params.id, cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notices/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM employee_notices WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { project_id, assigned_to, status, date_from, date_to, search } = req.query;
    let sql = `
      SELECT t.*, p.name as project_name, e.name as employee_display_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.company_id=t.company_id
      LEFT JOIN employees e ON e.id = t.assigned_to AND e.company_id=t.company_id
      WHERE t.company_id=?
    `;
    const params = [cid];
    if (project_id) { sql += ' AND t.project_id=?'; params.push(project_id); }
    if (assigned_to) { sql += ' AND t.assigned_to=?'; params.push(assigned_to); }
    if (status && status !== 'all') { sql += ' AND t.status=?'; params.push(status); }
    if (date_from) { sql += ' AND t.due_date >= ?'; params.push(date_from); }
    if (date_to)   { sql += ' AND t.due_date <= ?'; params.push(date_to); }
    if (search)    { sql += ' AND t.title LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY t.due_date, t.priority, t.created_at DESC';
    const tasks = db.prepare(sql).all(...params);
    res.json(withResources(tasks, cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const {
      project_id, title, description, assigned_to,
      start_date, due_date, due_time, submission_link,
      priority, resources
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Task title required' });
    if (!assigned_to)   return res.status(400).json({ error: 'Employee assignment required' });

    const emp = db.prepare('SELECT name FROM employees WHERE id=? AND company_id=?').get(assigned_to, cid);

    const r = db.prepare(`
      INSERT INTO tasks
        (project_id, title, description, assigned_to, assigned_name,
         start_date, due_date, due_time, submission_link, priority, company_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      project_id || null, title.trim(), description || '',
      assigned_to, emp?.name || '',
      start_date || null, due_date || null, due_time || null,
      submission_link || '', priority || 3, cid
    );

    if (Array.isArray(resources)) {
      resources.forEach(({ name, url }) => {
        if (name?.trim() && url?.trim()) {
          db.prepare('INSERT INTO task_resources (task_id, name, url, company_id) VALUES (?,?,?,?)').run(r.lastInsertRowid, name.trim(), url.trim(), cid);
        }
      });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(r.lastInsertRowid, cid);
    res.json(withResources([task], cid)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const {
      project_id, title, description, assigned_to,
      start_date, due_date, due_time, submission_link,
      priority, resources
    } = req.body;

    const emp = assigned_to ? db.prepare('SELECT name FROM employees WHERE id=? AND company_id=?').get(assigned_to, cid) : null;

    const r = db.prepare(`
      UPDATE tasks SET
        project_id=?, title=?, description=?, assigned_to=?, assigned_name=?,
        start_date=?, due_date=?, due_time=?, submission_link=?, priority=?
      WHERE id=? AND company_id=?
    `).run(
      project_id || null, title, description || '',
      assigned_to, emp?.name || '',
      start_date || null, due_date || null, due_time || null,
      submission_link || '', priority || 3,
      req.params.id, cid
    );
    if (!r.changes) return res.status(404).json({ error: 'Not found' });

    db.prepare('DELETE FROM task_resources WHERE task_id=? AND company_id=?').run(req.params.id, cid);
    if (Array.isArray(resources)) {
      resources.forEach(({ name, url }) => {
        if (name?.trim() && url?.trim()) {
          db.prepare('INSERT INTO task_resources (task_id, name, url, company_id) VALUES (?,?,?,?)').run(req.params.id, name.trim(), url.trim(), cid);
        }
      });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(req.params.id, cid);
    res.json(withResources([task], cid)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', (req, res) => {
  try {
    const cid = req.companyId;
    const { status } = req.body;
    const allowed = ['pending', 'in_progress', 'on_hold', 'completed', 'overdue', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existing = db.prepare('SELECT timer_status FROM tasks WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completed_at = status === 'completed' ? new Date().toISOString() : null;
    const timer_status = status === 'completed' ? 'idle' : existing.timer_status;

    db.prepare(`UPDATE tasks SET status=?, completed_at=?, timer_status=? WHERE id=? AND company_id=?`).run(
      status, completed_at, timer_status, req.params.id, cid
    );
    const task = db.prepare('SELECT * FROM tasks WHERE id=? AND company_id=?').get(req.params.id, cid);
    res.json(withResources([task], cid)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    db.prepare('DELETE FROM task_resources WHERE task_id=? AND company_id=?').run(req.params.id, cid);
    const r = db.prepare('DELETE FROM tasks WHERE id=? AND company_id=?').run(req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
