/**
 * My Travelroad — Server Bootstrap & Graceful Shutdown Lifecycle
 * Initializes HTTP listener, establishes database lifecycle, and traps termination signals.
 */

import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { prisma, connectDatabase, disconnectDatabase } from "../lib/db";

async function bootstrap(): Promise<void> {
  // 1. Establish database connection
  try {
    await connectDatabase();
    logger.info("Connected to PostgreSQL database successfully");
  } catch (err) {
    logger.fatal({ err }, "Failed to connect to database during bootstrap");
    process.exit(1);
  }

  // 2. Instantiate Express application
  const app = createApp({
    prismaClient: prisma,
    corsOrigins: env.CORS_ALLOWED_ORIGINS,
  });

  // 3. Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        origins: env.CORS_ALLOWED_ORIGINS,
      },
      `Server listening on http://localhost:${env.PORT}`
    );
  });

  // 4. Graceful shutdown handler
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, "Received termination signal. Commencing graceful shutdown...");

    // Force exit if drain exceeds 10 seconds
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout exceeded (10s). Forcing termination.");
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async (serverErr) => {
      if (serverErr) {
        logger.error({ err: serverErr }, "Error closing HTTP server");
      } else {
        logger.info("HTTP server closed to new connections");
      }

      try {
        await disconnectDatabase();
        logger.info("Database connection closed cleanly");
      } catch (dbErr) {
        logger.error({ err: dbErr }, "Error disconnecting from database during shutdown");
      }

      clearTimeout(forceExitTimer);
      logger.info("Graceful shutdown concluded successfully");
      process.exit(serverErr ? 1 : 0);
    });
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    logger.fatal({ error }, "Uncaught exception detected");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection detected");
    process.exit(1);
  });
}

// Execute bootstrap only when invoked directly
if (require.main === module) {
  bootstrap().catch((err) => {
    logger.fatal({ err }, "Fatal error during server bootstrap");
    process.exit(1);
  });
}

export { bootstrap };
