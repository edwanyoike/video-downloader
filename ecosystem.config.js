module.exports = {
  apps: [
    {
      name: 'vd-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
    {
      name: 'vd-backend',
      cwd: './backend',
      script: 'node',
      args: '--env-file=.env dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
