/** Block viewer role from mutating requests */
module.exports = function viewerReadOnly(req, res, next) {
  if (req.userRole !== 'viewer') return next();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({ error: 'Read-only access' });
  }
  next();
};
