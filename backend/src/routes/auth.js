const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt, randomUUID } = require('crypto');
const { requireCompanyAuth, SECRET } = require('../middleware/companyAuth');
const { SEED_COMPANY_ID } = require('../saasPhase1Migrate');
const { provisionNewCompany } = require('../services/companyProvision');
const { sendOtpEmail } = require('../services/emailService');
const { getSriLankaTime } = require('../utils/timezoneHelper');

const PLAN_VALUES = new Set(['free', 'professional', 'business', 'enterprise']);

function normalizePlan(p) {
  const x = String(p || 'free').toLowerCase();
  return PLAN_VALUES.has(x) ? x : 'free';
}

function signSaasToken(user) {
  return jwt.sign(
    {
      type: 'saas',
      sub: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
    },
    SECRET,
    { expiresIn: '30d' }
  );
}

function signLegacyToken(username) {
  return jwt.sign({ type: 'legacy_admin', username, role: 'admin' }, SECRET, { expiresIn: '30d' });
}

// ── Legacy admin login (username + password) ───────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    if (email && password && !username) {
      const u = db.prepare('SELECT * FROM app_users WHERE lower(email)=lower(?)').get(String(email).trim());
      if (!u) return res.status(401).json({ error: 'Invalid email or password' });
      if (!u.password_hash) return res.status(400).json({ error: 'This account uses Google sign-in' });
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
      const company = db.prepare('SELECT * FROM companies WHERE id=?').get(u.company_id);
      if (!company || company.status !== 'active') return res.status(403).json({ error: 'Company suspended' });
      db.prepare('UPDATE app_users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(u.id);
      db.prepare('UPDATE companies SET last_activity_at=CURRENT_TIMESTAMP WHERE id=?').run(u.company_id);
      try {
        db.prepare('INSERT INTO app_user_login_log (user_id, company_id, ip) VALUES (?,?,?)').run(u.id, u.company_id, req.ip || '');
      } catch (_) {}
      const token = signSaasToken(u);
      return res.json({
        token,
        authType: 'saas',
        first_login: !!company.first_login,
        company: { id: company.id, name: company.name, plan: company.plan, first_login: !!company.first_login },
        user: { id: u.id, email: u.email, name: u.name, role: u.role },
      });
    }

    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const settings = db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE company_id=? LIMIT 1').get(SEED_COMPANY_ID)
      || db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE id=1').get();
    if (!settings) return res.status(500).json({ error: 'System not configured' });
    if (username !== (settings.admin_username || 'admin')) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!settings.admin_password_hash) {
      return res.status(500).json({ error: 'Admin password not set. Restart the server.' });
    }
    const valid = await bcrypt.compare(password, settings.admin_password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });
    try {
      db.prepare('UPDATE companies SET last_activity_at=CURRENT_TIMESTAMP WHERE id=?').run(SEED_COMPANY_ID);
    } catch (_) {}
    const token = signLegacyToken(username);
    return res.json({
      token,
      username,
      authType: 'legacy_admin',
      first_login: false,
      role: 'admin',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireCompanyAuth, (req, res) => {
  try {
    if (req.authType === 'legacy_admin') {
      const company = db.prepare('SELECT id, name, plan, first_login FROM companies WHERE id=?').get(req.companyId);
      return res.json({
        authType: 'legacy_admin',
        username: (req.authPayload && req.authPayload.username) || 'admin',
        role: 'admin',
        company: company || { id: SEED_COMPANY_ID, name: 'GroovyMark', plan: 'enterprise', first_login: false },
        first_login: false,
      });
    }
    const user = db.prepare('SELECT id, email, name, role, company_id, avatar_url FROM app_users WHERE id=?').get(req.appUserId);
    const company = db.prepare('SELECT id, name, plan, first_login, status FROM companies WHERE id=?').get(req.companyId);
    const settings = db.prepare('SELECT currency, currency_locked FROM settings WHERE company_id=? LIMIT 1').get(req.companyId) || {};
    return res.json({
      authType: 'saas',
      user,
      company,
      first_login: !!(company && company.first_login),
      currency_locked: !!settings.currency_locked,
      primary_currency: settings.currency || null,
      role: user?.role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/change-password', requireCompanyAuth, async (req, res) => {
  const { current_password, new_password, new_username } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Fields required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    if (req.authType === 'legacy_admin') {
      const settings = db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE company_id=? LIMIT 1').get(req.companyId)
        || db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE id=1').get();
      const valid = await bcrypt.compare(current_password, settings.admin_password_hash || '');
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(new_password, 10);
      const usernameToSet = (new_username && new_username.trim()) ? new_username.trim() : settings.admin_username;
      let r = db.prepare('UPDATE settings SET admin_username=?, admin_password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE company_id=?').run(usernameToSet, hash, req.companyId);
      if (!r.changes) {
        r = db.prepare('UPDATE settings SET admin_username=?, admin_password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').run(usernameToSet, hash);
      }
      if (!r.changes) return res.status(500).json({ error: 'Could not update settings' });
      return res.json({ message: 'Admin credentials updated' });
    }
    const u = db.prepare('SELECT * FROM app_users WHERE id=?').get(req.appUserId);
    if (!u.password_hash) return res.status(400).json({ error: 'Password change not available for Google-only accounts' });
    const valid = await bcrypt.compare(current_password, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    db.prepare('UPDATE app_users SET password_hash=? WHERE id=?').run(hash, req.appUserId);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Email signup: request OTP ─────────────────────────────────────────────
router.post('/signup/request-otp', async (req, res) => {
  try {
    const { company_name, full_name, email, password, confirm_password, plan, heard_from } = req.body;
    if (!company_name || !full_name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    if (password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const em = String(email).toLowerCase().trim();
    if (db.prepare('SELECT id FROM app_users WHERE lower(email)=?').get(em)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    db.prepare('DELETE FROM signup_pending WHERE lower(email)=?').run(em);
    const id = randomUUID();
    
    // Dev mode: use hardcoded OTP for testing
    const otp = '123456';
    const otp_hash = bcrypt.hashSync(otp, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const ph = await bcrypt.hash(password, 10);
    
    db.prepare(`
      INSERT INTO signup_pending (id, email, otp_hash, otp_expires_at, company_name, full_name, password_hash, plan, heard_from)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, em, otp_hash, expires, company_name, full_name, ph, normalizePlan(plan), heard_from || null);
    
    // Try to send email, but always log the dev code
    console.log(`📧 [DEV OTP] Email: ${em} | Code: ${otp} (expires in 10 min)`);
    await sendOtpEmail(em, otp).catch(e => console.warn('[OTP Email Failed]', e.message));
    
    // Log to platform events
    try {
      db.prepare(`INSERT INTO platform_events (event_type, message, created_at) VALUES (?,?,?)`).run(
        'signup_request', `New signup request: ${company_name} (${em}) - Plan: ${plan || 'free'}`, getSriLankaTime()
      );
    } catch (_) {}
    
    res.json({ 
      message: 'Verification code sent (dev mode: 123456)', 
      email: em,
      dev_code: otp 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signup/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const em = String(email || '').toLowerCase().trim();
    const row = db.prepare('SELECT * FROM signup_pending WHERE lower(email)=? ORDER BY created_at DESC LIMIT 1').get(em);
    if (!row) return res.status(404).json({ error: 'No pending signup for this email' });
    
    // Dev mode: use hardcoded OTP for testing
    const otp = '123456';
    const otp_hash = bcrypt.hashSync(otp, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    db.prepare('UPDATE signup_pending SET otp_hash=?, otp_expires_at=? WHERE id=?').run(otp_hash, expires, row.id);
    
    // Try to send email, but always log the dev code
    console.log(`📧 [DEV OTP RESEND] Email: ${em} | Code: ${otp} (expires in 10 min)`);
    await sendOtpEmail(em, otp).catch(e => console.warn('[OTP Email Failed]', e.message));
    
    // Log to platform events
    try {
      db.prepare(`INSERT INTO platform_events (event_type, message, created_at) VALUES (?,?,?)`).run(
        'signup_resend', `OTP resent to: ${em}`, getSriLankaTime()
      );
    } catch (_) {}
    
    res.json({ 
      message: 'Code resent (dev mode: 123456)',
      dev_code: otp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signup/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const em = String(email || '').toLowerCase().trim();
    if (!otp) return res.status(400).json({ error: 'OTP required' });
    const row = db.prepare('SELECT * FROM signup_pending WHERE lower(email)=? ORDER BY created_at DESC LIMIT 1').get(em);
    if (!row) return res.status(404).json({ error: 'No pending signup' });
    if (new Date(row.otp_expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    if (!bcrypt.compareSync(String(otp), row.otp_hash)) return res.status(400).json({ error: 'Invalid code' });
    if (db.prepare('SELECT id FROM app_users WHERE lower(email)=?').get(em)) {
      return res.status(409).json({ error: 'Account already exists' });
    }
    provisionNewCompany(db, {
      companyName: row.company_name,
      ownerEmail: em,
      ownerName: row.full_name,
      passwordHash: row.password_hash,
      plan: row.plan,
      heardFrom: row.heard_from,
      googleUid: null,
      avatarUrl: null,
    });
    db.prepare('DELETE FROM signup_pending WHERE id=?').run(row.id);
    const user = db.prepare('SELECT * FROM app_users WHERE lower(email)=?').get(em);
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(user.company_id);
    const token = signSaasToken(user);
    res.json({
      token,
      authType: 'saas',
      first_login: true,
      company: { id: company.id, name: company.name, plan: company.plan, first_login: true },
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google (Sign-In with Google ID token) ─────────────────────────────────
router.post('/google', async (req, res) => {
  let OAuth2Client;
  try {
    OAuth2Client = require('google-auth-library').OAuth2Client;
  } catch {
    return res.status(501).json({ error: 'Google sign-in not configured on server' });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(501).json({ error: 'GOOGLE_CLIENT_ID is not set' });
  const { credential, company_name, plan, heard_from } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential (ID token) required' });
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const p = ticket.getPayload();
    const email = (p.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'Google account has no email' });
    let user = db.prepare('SELECT * FROM app_users WHERE lower(email)=?').get(email);
    if (user) {
      const company = db.prepare('SELECT * FROM companies WHERE id=?').get(user.company_id);
      if (company.status !== 'active') return res.status(403).json({ error: 'Company suspended' });
      if (p.sub && !user.google_uid) db.prepare('UPDATE app_users SET google_uid=?, avatar_url=? WHERE id=?').run(p.sub, p.picture || null, user.id);
      db.prepare('UPDATE app_users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
      db.prepare('UPDATE companies SET last_activity_at=CURRENT_TIMESTAMP WHERE id=?').run(user.company_id);
      const token = signSaasToken(user);
      return res.json({
        token,
        authType: 'saas',
        first_login: !!company.first_login,
        company: { id: company.id, name: company.name, plan: company.plan, first_login: !!company.first_login },
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }
    if (!company_name) return res.status(400).json({ error: 'company_name required for new accounts', needsProfile: true });
    const existingGoogle = db.prepare('SELECT id FROM app_users WHERE google_uid=?').get(p.sub);
    if (existingGoogle) return res.status(409).json({ error: 'Google account already linked' });
    provisionNewCompany(db, {
      companyName: company_name,
      ownerEmail: email,
      ownerName: p.name || email,
      passwordHash: null,
      plan: normalizePlan(plan),
      heardFrom: heard_from || null,
      googleUid: p.sub,
      avatarUrl: p.picture || null,
    });
    user = db.prepare('SELECT * FROM app_users WHERE lower(email)=?').get(email);
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(user.company_id);
    const token = signSaasToken(user);
    return res.json({
      token,
      authType: 'saas',
      first_login: true,
      company: { id: company.id, name: company.name, plan: company.plan, first_login: true },
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('Google auth:', err);
    res.status(401).json({ error: 'Google token verification failed' });
  }
});

module.exports = router;
