/**
 * My Travelroad — CORS Middleware Configuration
 * Bounded strictly by validated CORS_ALLOWED_ORIGINS.
 */

import cors, { CorsOptions } from "cors";

export function createCorsMiddleware(allowedOrigins: string[] = ["http://localhost:3000"]) {
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g., server-to-server, mobile native, curl in dev) with no origin
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Sanitized: Never interpolate attacker-controlled origin in error message
      return callback(new Error("CORS_ORIGIN_DENIED"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  };

  return cors(corsOptions);
}
