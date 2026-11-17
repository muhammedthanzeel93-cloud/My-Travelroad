import { Logger } from "pino";
import type { AuthenticatedPrincipal } from "../auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      auth?: AuthenticatedPrincipal;
      user?: AuthenticatedPrincipal;
    }
  }
}

export {};
