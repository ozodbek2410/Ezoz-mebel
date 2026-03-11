module.exports = {
  apps: [{
    name: 'ezoz-mebel',
    cwd: '/var/www/ezoz-mebel/apps/server',
    script: 'src/index.ts',
    interpreter: '/var/www/ezoz-mebel/node_modules/.bin/tsx',
    env: {
      NODE_ENV: 'production',
      PORT: 3005,
      HOST: '0.0.0.0',
    },
    max_memory_restart: '500M',
    instances: 1,
    exec_mode: 'fork',
  }],
};
