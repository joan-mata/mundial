import pg from 'pg';

const { Client } = pg;

function iso2Flag(iso2) {
  return iso2.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

const FLAGS = {
  ALG: 'DZ', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BIH: 'BA',
  BRA: 'BR', CAN: 'CA', CIV: 'CI', COD: 'CD', COL: 'CO', CPV: 'CV',
  CRO: 'HR', CUR: 'CW', CUW: 'CW', CZE: 'CZ', ECU: 'EC', EGY: 'EG',
  ENG: 'GB', ESP: 'ES', FRA: 'FR', GER: 'DE', GHA: 'GH', HAI: 'HT',
  IRN: 'IR', IRQ: 'IQ', JOR: 'JO', JPN: 'JP', KOR: 'KR', KSA: 'SA',
  MAR: 'MA', MEX: 'MX', NED: 'NL', NOR: 'NO', NZL: 'NZ', PAN: 'PA',
  PAR: 'PY', POR: 'PT', QAT: 'QA', RSA: 'ZA', SCO: 'GB', SEN: 'SN',
  SUI: 'CH', SWE: 'SE', TUN: 'TN', TUR: 'TR', URY: 'UY', USA: 'US',
  UZB: 'UZ',
};

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

for (const [tla, iso2] of Object.entries(FLAGS)) {
  const flag = iso2Flag(iso2);
  await client.query('UPDATE "Team" SET flag = $1 WHERE id = $2', [flag, tla]);
  console.log(`${tla} → ${flag}`);
}

await client.end();
console.log('Done');
