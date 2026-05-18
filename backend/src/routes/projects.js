const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/types', (req, res) => {
  try {
    const types = db.prepare('SELECT * FROM project_types WHERE company_id=? ORDER BY name').all(req.companyId);
    res.json(types);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/types', (req, res) => {
  try {
    const cid = req.companyId;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Type name required' });
    const r = db.prepare('INSERT INTO project_types (name, company_id) VALUES (?,?)').run(name.trim(), cid);
    res.json({ id: r.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Type already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/types/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM project_types WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', (req, res) => {
  try {
    const cid = req.companyId;
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM projects WHERE company_id=? GROUP BY status
    `).all(cid);
    const taskCounts = db.prepare(`
      SELECT p.id, p.name, COUNT(t.id) as task_count,
             SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed_count
      FROM projects p LEFT JOIN tasks t ON t.project_id=p.id AND t.company_id=p.company_id
      WHERE p.company_id=?
      GROUP BY p.id
    `).all(cid);
    res.json({ counts, taskCounts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { status, search } = req.query;
    let sql = `
      SELECT p.*,
             COUNT(t.id) as task_count,
             SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN t.status='overdue'   THEN 1 ELSE 0 END) as overdue_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id AND t.company_id=p.company_id
      WHERE p.company_id=?
    `;
    const params = [cid];
    if (status && status !== 'all') { sql += ' AND p.status=?'; params.push(status); }
    if (search) { sql += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
    const projects = db.prepare(sql).all(...params);
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { name, client_id, client_name, start_date, status, type_ids, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });

    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const client = db.prepare('SELECT name FROM clients WHERE id=? AND company_id=?').get(client_id, cid);
      resolvedClientName = client?.name || '';
    }

    const r = db.prepare(`
      INSERT INTO projects (name, client_id, client_name, start_date, status, type_ids, description, company_id)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      name.trim(), client_id || null, resolvedClientName,
      start_date || null, status || 'active',
      JSON.stringify(type_ids || []), description || '', cid
    );
    const project = db.prepare('SELECT * FROM projects WHERE id=? AND company_id=?').get(r.lastInsertRowid, cid);
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { name, client_id, client_name, start_date, status, type_ids, description } = req.body;

    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const client = db.prepare('SELECT name FROM clients WHERE id=? AND company_id=?').get(client_id, cid);
      resolvedClientName = client?.name || '';
    }

    const r = db.prepare(`
      UPDATE projects SET name=?, client_id=?, client_name=?, start_date=?,
        status=?, type_ids=?, description=?
      WHERE id=? AND company_id=?
    `).run(
      name, client_id || null, resolvedClientName,
      start_date || null, status,
      JSON.stringify(type_ids || []), description || '',
      req.params.id, cid
    );
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    const project = db.prepare('SELECT * FROM projects WHERE id=? AND company_id=?').get(req.params.id, cid);
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const tasks = db.prepare('SELECT id FROM tasks WHERE project_id=? AND company_id=?').all(req.params.id, cid);
    tasks.forEach(t => {
      db.prepare('DELETE FROM task_resources WHERE task_id=? AND company_id=?').run(t.id, cid);
    });
    db.prepare('DELETE FROM tasks WHERE project_id=? AND company_id=?').run(req.params.id, cid);
    const r = db.prepare('DELETE FROM projects WHERE id=? AND company_id=?').run(req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
