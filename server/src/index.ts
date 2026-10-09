import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initRealtime } from './lib/realtime.js';

async function main() {
  await connectDB();
  const server = createServer(createApp());
  initRealtime(server);
  server.listen(env.PORT, () => console.log(`TaskFlow API + realtime → http://localhost:${env.PORT}`));
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
