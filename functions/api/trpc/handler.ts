import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { serialize, type CookieSerializeOptions } from "cookie";
import { appRouter } from "../../../server/routers";
import { createContext } from "../../../server/_core/context";
import { initEnv } from "../../../server/_core/env";
import { initDb } from "../../../server/db";

type Env = {
  DB?: D1Database;
  "cai-database"?: D1Database;
  VITE_APP_ID?: string;
  JWT_SECRET?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OWNER_OPEN_ID?: string;
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const toEnvRecord = (env: Env) => {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
};

const headersToObject = (headers: Headers) => {
  const record: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
};

const normalizeCookieOptions = (
  options: Record<string, unknown>
): CookieSerializeOptions => {
  const result: CookieSerializeOptions = {};
  if (typeof options.domain === "string") result.domain = options.domain;
  if (typeof options.httpOnly === "boolean") result.httpOnly = options.httpOnly;
  if (typeof options.path === "string") result.path = options.path;
  if (typeof options.sameSite === "string") {
    result.sameSite = options.sameSite as CookieSerializeOptions["sameSite"];
  }
  if (typeof options.secure === "boolean") result.secure = options.secure;
  return result;
};

export const handleTrpcRequest = async ({ request, env }: PagesContext) => {
  initEnv(toEnvRecord(env));
  const dbBinding = env.DB ?? env["cai-database"];
  initDb(dbBinding);

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: ({ req, resHeaders }) => {
      const url = new URL(req.url);
      const reqLike = {
        headers: headersToObject(req.headers),
        protocol: url.protocol.replace(":", ""),
      };
      const resLike = {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          const cookie = serialize(name, "", {
            ...normalizeCookieOptions(options),
            maxAge: 0,
          });
          resHeaders.append("Set-Cookie", cookie);
        },
      };

      return createContext({
        req: reqLike,
        res: resLike,
      });
    },
    onError({ error, path }) {
      console.error("[tRPC] Error", { path, error });
    },
  });
};
