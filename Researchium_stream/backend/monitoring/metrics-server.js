import http from 'http';
import { config } from '../config.js';

const port = config.metricsPort;
const started = Date.now();

const server = http.createServer((req, res) => {
  if (req.url === '/metrics') {
    const uptime = Math.floor((Date.now() - started) / 1000);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(
      `# HELP studio_backend_uptime_seconds Uptime\n` +
        `# TYPE studio_backend_uptime_seconds gauge\n` +
        `studio_backend_uptime_seconds ${uptime}\n`
    );
    return;
  }
  res.writeHead(404);
  res.end('not_found');
});

server.listen(port, config.host, () => {
  console.log(`[studio-backend] metrics http://${config.host}:${port}/metrics`);
});
