import express, { type Express } from "express";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionSecret } from "./lib/auth-session";

const PgSession = connectPgSimple(session);

const app: Express = express();

// Behind Replit's reverse proxy, TLS terminates at the proxy and reaches Express
// as HTTP. Trust the first proxy hop so `req.secure` and `req.ip` reflect the
// forwarded request correctly: secure session cookies work and auth throttling
// is keyed to the client IP rather than the proxy.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
    secret: sessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

export default app;
