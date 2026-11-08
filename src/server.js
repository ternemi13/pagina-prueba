const app = require('./app');
const config = require('./config');
const { closePool } = require('./db/pool');
const { sessionStore } = require('./middleware/session');

const server = app.listen(config.port, () => {
  console.log(`Barbería Don Filo disponible en http://localhost:${config.port}`);
  console.log(`Entorno: ${config.env}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nRecibida señal ${signal}. Cerrando el servidor...`);

  const forceExit = setTimeout(() => {
    console.error('No se pudo cerrar todo a tiempo. Saliendo de todas formas.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async () => {
    try {
      if (typeof sessionStore.close === 'function') {
        await new Promise((resolve) => sessionStore.close(resolve));
      }
      await closePool();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error('Error cerrando recursos:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error);
  shutdown('uncaughtException');
});
