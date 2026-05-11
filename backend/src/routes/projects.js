const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ── Project Types ──────────────────────────────────────────────────────────
router.get('/types', (req, res) => {
  try {
    const types = db.prepare('SELECT * FROM project_types ORDER BY name').all();
    res.json(types);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/types', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Type name required' });
    const r = db.prepare('INSERT INTO project_types (name) VALUES (?)').run(name.trim());
    res.json({ id: r.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Type already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/types/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM project_types WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Project Stats ──────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM projects GROUP BY status
    `).all();
    const taskCounts = db.prepare(`
      SELECT p.id, p.name, COUNT(t.id) as task_count,
             SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed_count
      FROM projects p LEFT JOIN tasks t ON t.project_id=p.id
      GROUP BY p.id
    `).all();
    res.json({ counts, taskCounts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Projects CRUD ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT p.*,
             COUNT(t.id) as task_count,
             SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN t.status='overdue'   THEN 1 ELSE 0 END) as overdue_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') { sql += ' AND p.status=?'; params.push(status); }
    if (search) { sql += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
    const projects = db.prepare(sql).all(...params);
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, client_id, client_name, start_date, status, type_ids, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });

    // Resolve client_name from client_id if not provided
    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const client = db.prepare('SELECT name FROM clients WHERE id=?').get(client_id);
      resolvedClientName = client?.name || '';
    }

    const r = db.prepare(`
      INSERT INTO projects (name, client_id, client_name, start_date, status, type_ids, description)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      name.trim(), client_id || null, resolvedClientName,
      start_date || null, status || 'active',
      JSON.stringify(type_ids || []), description || ''
    );
    const project = db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid);
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, client_id, client_name, start_date, status, type_ids, description } = req.body;

    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const client = db.prepare('SELECT name FROM clients WHERE id=?').get(client_id);
      resolvedClientName = client?.name || '';
    }

    db.prepare(`
      UPDATE projects SET name=?, client_id=?, client_name=?, start_date=?,
        status=?, type_ids=?, description=?
      WHERE id=?
    `).run(
      name, client_id || null, resolvedClientName,
      start_date || null, status,
      JSON.stringify(type_ids || []), description || '',
      req.params.id
    );
    const project = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    // Delete resources first, then tasks, then project
    const tasks = db.prepare('SELECT id FROM tasks WHERE project_id=?').all(req.params.id);
    tasks.forEach(t => {
      db.prepare('DELETE FROM task_resources WHERE task_id=?').run(t.id);
    });
    db.prepare('DELETE FROM tasks WHERE project_id=?').run(req.params.id);
    db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
