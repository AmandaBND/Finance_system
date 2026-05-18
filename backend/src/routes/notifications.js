const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM notifications WHERE company_id=? ORDER BY created_at DESC LIMIT 50').all(req.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread-count', (req, res) => {
  try {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE company_id=? AND is_read=0').get(req.companyId);
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', (req, res) => {
  try {
    const r = db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE company_id=?').run(req.companyId);
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM notifications WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
