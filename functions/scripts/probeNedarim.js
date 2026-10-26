// Read-only probe of the Nedarim Plus GetHistoryJson endpoint.
// Prints the response SHAPE and the fields that drive our logic, masking
// personal details so the output can be shared safely.
//
//   node scripts/probeNedarim.js [maxRows]

require('dotenv').config({ path: __dirname + '/../.env' });

const MOSAD_ID = process.env.NEDARIM_MOSAD_ID || '7014109';
const PASSWORD = process.env.NEDARIM_API_PASSWORD;
const MAX = Number(process.argv[2] || 5);

if (!PASSWORD) {
  console.error('NEDARIM_API_PASSWORD is not set in functions/.env');
  process.exit(1);
}

const url =
  'https://matara.pro/nedarimplus/Reports/Manage3.aspx' +
  `?Action=GetHistoryJson&MosadId=${encodeURIComponent(MOSAD_ID)}` +
  `&ApiPassword=${encodeURIComponent(PASSWORD)}&MaxId=${MAX}`;

const redacted = url.replace(/(ApiPassword=)[^&]*/, '$1***');

function mask(value) {
  const s = String(value ?? '');
  if (!s) return '(ריק)';
  if (s.length <= 2) return '*'.repeat(s.length);
  return s.slice(0, 1) + '*'.repeat(Math.max(1, s.length - 2)) + s.slice(-1);
}

async function main() {
  console.log('GET', redacted, '\n');

  const res = await fetch(url);
  console.log('HTTP', res.status, res.statusText);
  console.log('content-type:', res.headers.get('content-type'), '\n');

  const body = await res.text();

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.log('--- response is NOT valid JSON. First 800 chars: ---');
    console.log(body.slice(0, 800));
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.log('--- response is JSON but NOT an array. Top-level keys: ---');
    console.log(Object.keys(data));
    console.log(JSON.stringify(data).slice(0, 800));
    process.exit(1);
  }

  console.log(`Array with ${data.length} transaction(s).\n`);
  if (data.length === 0) {
    console.log('No transactions returned - the account may have no history yet.');
    process.exit(0);
  }

  console.log('--- FIELDS PRESENT ON THE FIRST ROW ---');
  console.log(Object.keys(data[0]).join(', '), '\n');

  console.log('--- THE FIELDS OUR LOGIC DEPENDS ON (personal data masked) ---');
  data.forEach((t, i) => {
    console.log(`\n[row ${i + 1}]`);
    console.log('  TransactionId :', t.TransactionId, `(typeof ${typeof t.TransactionId})`);
    console.log('  Amount        :', t.Amount, `(typeof ${typeof t.Amount})`);
    console.log('  Currency      :', t.Currency, '(1=שקל, 2=דולר)');
    console.log('  TransactionTime:', t.TransactionTime, '  <-- date format');
    console.log('  Groupe        :', JSON.stringify(t.Groupe), '  <-- fund mapping');
    console.log('  TransactionType:', JSON.stringify(t.TransactionType));
    console.log('  KevaId        :', t.KevaId ?? '(none)');
    console.log('  KabalaId      :', t.KabalaId ?? '(none)');
    console.log('  Comments      :', JSON.stringify(t.Comments));
    console.log('  ClientName    :', mask(t.ClientName));
    console.log('  Zeout         :', mask(t.Zeout));
    console.log('  Phone         :', mask(t.Phone));
  });

  const groupes = [...new Set(data.map((t) => String(t.Groupe ?? '')))];
  console.log('\n--- DISTINCT Groupe VALUES IN THIS SAMPLE ---');
  console.log(groupes.map((g) => (g === '' ? '(ריק)' : g)).join(' | '));

  process.exit(0);
}

main().catch((err) => {
  console.error('\nRequest failed:', err.message);
  process.exit(1);
});
