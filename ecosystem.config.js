// OpenHRM production — APPSERVER002 (ports 3000 / 8000)
module.exports = {
  apps: [
    {
      name: "openhrm-backend",
      cwd: "/var/www/openhrm/backend",
      script: "dist/src/main.js",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", PORT: "8000" },
      max_memory_restart: "512M",
      autorestart: true,
    },
    {
      name: "openhrm-frontend",
      cwd: "/var/www/openhrm/frontend",
      script: "npm",
      args: "run start:prod",
      env: { NODE_ENV: "production", PORT: "3000" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      autorestart: true,
    },
  ],
};
