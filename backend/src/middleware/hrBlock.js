/** Accountant and viewer cannot access HR / payroll admin APIs */
module.exports = function hrBlock(req, res, next) {
  if (['accountant', 'viewer'].includes(req.userRole)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
