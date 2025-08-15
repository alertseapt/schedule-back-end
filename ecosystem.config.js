module.exports = {
  apps: [{
    name: 'schedule-mercocamp-backend',
    script: 'app.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'development',
      PORT: 4000,
      DB_HOST: 'mercocamp.ip.odhserver.com',
      DB_PORT: 33101,
      DB_USER: 'projetos',
      DB_PASSWORD: 'masterkey',
      DB_CHECKIN: 'dbcheckin',
      DB_MERCOCAMP: 'dbmercocamp',
      DB_USERS: 'dbusers'
    },
    env_production: {
      NODE_ENV: 'production',
      // Outras variáveis serão fornecidas pela plataforma Railway
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    kill_timeout: 5000,
    listen_timeout: 8000,
    shutdown_with_message: true
  }]
};

