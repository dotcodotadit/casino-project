/**
 * PM2 process manager config for VM / bare-metal deployment (no Docker).
 *
 * Prereqs on the host:
 *   npm ci && npm run prisma:generate && npm run engine:build && npm run build
 *   npx prisma db push --schema backend/prisma/schema.prisma   (or migrate deploy)
 *   export the env vars from deployment/.env (or use an env file loader)
 *
 * Start:   pm2 start deployment/pm2/ecosystem.config.cjs
 * Persist: pm2 save && pm2 startup
 *
 * Run from the repo root so workspace symlinks (@casino/game-engine) resolve.
 */
const common = {
  cwd: __dirname + '/../..',
  instances: 1,
  exec_mode: 'fork', // sockets + shared in-process state → single instance per service
  autorestart: true,
  max_memory_restart: '400M',
  merge_logs: true,
  time: true,
  env: { NODE_ENV: 'production' },
}

module.exports = {
  apps: [
    {
      ...common,
      name: 'auth-service',
      script: 'auth-service/dist/index.js',
      env: { ...common.env, AUTH_PORT: 4001 },
      error_file: 'logs/auth.err.log',
      out_file: 'logs/auth.out.log',
    },
    {
      ...common,
      name: 'wallet-service',
      script: 'wallet-service/dist/index.js',
      env: { ...common.env, WALLET_PORT: 4002 },
      error_file: 'logs/wallet.err.log',
      out_file: 'logs/wallet.out.log',
    },
    {
      ...common,
      name: 'backend',
      script: 'backend/dist/index.js',
      env: { ...common.env, BACKEND_PORT: 4000 },
      error_file: 'logs/backend.err.log',
      out_file: 'logs/backend.out.log',
    },
    {
      ...common,
      name: 'api-gateway',
      script: 'api-gateway/dist/index.js',
      env: {
        ...common.env,
        GATEWAY_PORT: 8080,
        AUTH_SERVICE_URL: 'http://127.0.0.1:4001',
        WALLET_SERVICE_URL: 'http://127.0.0.1:4002',
        BACKEND_SERVICE_URL: 'http://127.0.0.1:4000',
      },
      error_file: 'logs/gateway.err.log',
      out_file: 'logs/gateway.out.log',
    },
  ],
}
