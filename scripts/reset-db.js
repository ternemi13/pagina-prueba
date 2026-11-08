const config = require('../src/config');
const { resetDatabase, printAndExit } = require('./lib/db');
const { seedDatabase } = require('./seed');

async function main() {
  try {
    await resetDatabase(config.db.database);
    const result = await seedDatabase();
    console.log(`✔ Base de datos "${config.db.database}" reiniciada.`);
    console.log(
      `  Datos de demostración: ${result.appointments} citas y ${result.blocks} bloqueos.`
    );
    console.log('  Crea el usuario administrador con: npm run admin:create');
  } catch (error) {
    printAndExit(error);
  }
}

main();
