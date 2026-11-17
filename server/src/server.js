import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { loadConfig } from './config/env.js';
import { attachSocketServer } from './sockets/socketServer.js';

async function startServer() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const app = createApp(config);
  const server = createServer(app);
  const io = attachSocketServer(server, config);
  app.set('io', io);
  server.listen(config.port, () => {
    console.info(`WolfLink API listening on http://localhost:${config.port}`);
  });

  connectDatabase(config.mongoUri).catch((error) => {
    console.error(`MongoDB is unavailable (${error.name}).`);
    console.error('The API is running, but /api/ready will remain unavailable until the database connects.');
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}

startServer();
