module.exports = {
  apps: [
    {
      name: "huiscan-be",
      cwd: "/var/www/huiscan-be",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        API_PREFIX: "/api/v1",
      },
    },
  ],
};
