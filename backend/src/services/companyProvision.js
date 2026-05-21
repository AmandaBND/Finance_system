const { randomUUID } = require('crypto');
const { format, addDays } = require('date-fns');
const { SEED_COMPANY_ID } = require('../saasPhase1Migrate');

function defaultTrialEnd() {
  return format(addDays(new Date(), 30), 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Creates company + owner user + per-company settings rows. Runs in a transaction.
 */
function provisionNewCompany(db, { companyName, ownerEmail, ownerName, passwordHash, plan, heardFrom, googleUid, avatarUrl }) {
  const companyId = randomUUID();
  const ownerId = randomUUID();
  const email = String(ownerEmail).toLowerCase().trim();
  const trialEnds = defaultTrialEnd();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO companies (id, name, email, plan, first_login, heard_from, trial_ends_at, status)
      VALUES (?, ?, ?, ?, 1, ?, ?, 'active')
    `).run(companyId, companyName, email, plan || 'free', heardFrom || null, trialEnds);

    db.prepare(`
      INSERT INTO app_users (id, company_id, email, name, password_hash, role, google_uid, avatar_url)
      VALUES (?, ?, ?, ?, ?, 'owner', ?, ?)
    `).run(ownerId, companyId, email, ownerName || email, passwordHash || null, googleUid || null, avatarUrl || null);

    db.prepare(`UPDATE companies SET owner_id=? WHERE id=?`).run(ownerId, companyId);

    const seed = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(SEED_COMPANY_ID);
    if (seed) {
      const row = { ...seed };
      delete row.id;
      row.company_id = companyId;
      row.company_name = companyName;
      row.company_email = email;
      row.admin_username = null;
      row.admin_password_hash = null;
      row.logo_path = null;
      const cols = Object.keys(row).filter(k => row[k] !== undefined);
      const placeholders = cols.map(() => '?').join(',');
      const vals = cols.map(c => row[c]);
      db.prepare(`INSERT INTO settings (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
    } else {
      db.prepare(`
        INSERT INTO settings (company_name, company_email, currency, currency_symbol, allowed_currencies, company_id)
        VALUES (?, ?, 'USD', '$', '["LKR","USD"]', ?)
      `).run(companyName, email, companyId);
    }

    const gwSeed = db.prepare('SELECT * FROM payment_gateway_settings WHERE company_id=? LIMIT 1').get(SEED_COMPANY_ID);
    if (gwSeed) {
      const g = { ...gwSeed };
      delete g.id;
      g.company_id = companyId;
      const gcols = Object.keys(g).filter(k => g[k] !== undefined);
      db.prepare(`INSERT INTO payment_gateway_settings (${gcols.join(',')}) VALUES (${gcols.map(() => '?').join(',')})`).run(...gcols.map(c => g[c]));
    } else {
      db.prepare(`INSERT INTO payment_gateway_settings (company_id) VALUES (?)`).run(companyId);
    }

    db.prepare(`INSERT INTO ai_cache (company_id, insights, predictions, recommendations, summary) VALUES (?, '[]','[]','[]','')`).run(companyId);

    try {
      db.prepare(`INSERT INTO platform_events (company_id, actor_email, event_type, message) VALUES (?,?,?,?)`).run(
        companyId, email, 'signup', `${companyName} registered (${plan || 'free'})`
      );
    } catch (_) {}
  });

  tx();
  return { companyId, ownerId };
}

module.exports = { provisionNewCompany, SEED_COMPANY_ID };
