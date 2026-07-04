// HRMS-PWA — PM2 (ports 3001 / 8001)
module.exports = {
  apps: [
    {
      name: "hrms-backend",
      cwd: "/home/server/HRMS-PWA/HRMS-PWA/backend",
      script: "dist/src/main.js",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", PORT: "8001" },
      max_memory_restart: "512M",
      autorestart: true,
    },
    {
      name: "hrms-frontend",
      cwd: "/home/server/HRMS-PWA/HRMS-PWA/frontend",
      script: "npm",
      args: "run start:prod",
      env: { NODE_ENV: "production", PORT: "3001" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      autorestart: true,
    },
  ],
};
