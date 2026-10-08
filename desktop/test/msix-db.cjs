// Run only after stop-msix-test.ps1 has confirmed all packaged processes exited.
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const database = new DatabaseSync(process.argv[2], { readOnly: true });
try {
  assert.deepEqual(database.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']);
  assert.equal(database.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM flyway_schema_history WHERE success = 1').get().n, 3);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM company_profile').get().n, 1);
  console.log('MSIX_DB_OK: quick_check=ok, no foreign key violations, 3 migrations, one company');
} finally { database.close(); }
