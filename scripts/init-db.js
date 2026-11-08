const config = require('../src/config');
const {
  createDatabase,
  runSchema,
  printAndExit
} = require('./lib/db');

async function main() {
  try {
    await createDatabase(config.db.database);
    await runSchema(config.db.database);
    console.log(`✔ Base de datos "${config.db.database}" lista.`);
    console.log('  Carga datos de demostración con: npm run db:seed');
  } catch (error) {
    printAndExit(error);
  }
}

main();
