'use strict';

const http = require('node:http');
const { handler } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(handler);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`listening on http://${HOST}:${PORT} (node ${process.version})`);
  });

  // Runners and containers stop a process with SIGTERM — exit cleanly so a
  // deploy step never has to wait for a kill.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`${signal} received, shutting down`);
      server.close(() => process.exit(0));
    });
  }
}

module.exports = { server };
