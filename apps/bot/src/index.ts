import { start } from "./server.js";

start().catch((err) => {
  console.error("Server ishga tushmadi:", err);
  process.exit(1);
});
