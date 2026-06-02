module.exports = {
  apps: [{
    name: 'omc-backend',
    script: 'server.js',
    cwd: __dirname,
    node_args: '--max-old-space-size=512',
    autorestart: true,
    max_restarts: 50,
    restart_delay: 2000,
    watch: false,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production'
    },
    // Log files
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
