module.exports = {
  apps: [
    {
      name: "tosk",
      port: "3000",
      exec_mode: "cluster",
      instances: 3,
      script: "./.output/server/index.mjs",
      port: 4142,
    },
  ],
};
