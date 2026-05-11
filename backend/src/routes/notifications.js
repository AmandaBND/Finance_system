const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread-count', (req, res) => {
  try {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read=0').get();
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1').run();
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM notifications WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
