import { buildApp } from "./app";
import { env } from "./config/env";
import { closePool } from "./db/pool";

async function start(): Promise<void> {
  const app = buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down SchoolOS backend");
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
