/**
 * My Travelroad — Structured Application Logger
 * Built on Pino with sensitive credential, token, and header redaction.
 */

import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "headers.authorization",
      "headers.cookie",
      "password",
      "*.password",
      "token",
      "*.token",
      "refreshToken",
      "*.refreshToken",
      "accessToken",
      "*.accessToken",
      "secret",
      "*.secret",
      "credentials",
      "*.credentials",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
