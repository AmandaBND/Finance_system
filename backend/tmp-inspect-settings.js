const Database = require('better-sqlite3');
const db = new Database('data/financial.db', { readonly: true });
const row = db.prepare('SELECT * FROM settings LIMIT 1').get();
console.log(JSON.stringify(row, null, 2));
