import { env } from "../../config/env";
import { checkDatabaseConnection } from "../../db/pool";

export async function getHealthStatus() {
  const databaseConnected = await checkDatabaseConnection();

  return {
    service: "schoolos-backend",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: databaseConnected,
    },
  };
}
