import { serialize } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../../shared/const";
import { getSessionCookieOptions } from "../../../server/_core/cookies";
import { initEnv } from "../../../server/_core/env";
import { sdk } from "../../../server/_core/sdk";
import * as db from "../../../server/db";

const INVITE_CODE_SETTING_KEY = "auth.inviteCode";
const ALLOWED_DOMAIN = "@cyberagent.co.jp";

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

function parseOAuthState(state: string): { inviteCode?: string } {
  let decoded = state;
  if (typeof atob === "function") {
    decoded = atob(state);
  } else if (typeof Buffer !== "undefined") {
    decoded = Buffer.from(state, "base64").toString("utf-8");
  }

  try {
    const parsed = JSON.parse(decoded) as { inviteCode?: unknown };
    return {
      inviteCode: typeof parsed.inviteCode === "string" ? parsed.inviteCode : undefined,
    };
  } catch {
    return {};
  }
}

export const onRequest = async ({ request, env }: PagesContext) => {
  initEnv(toEnvRecord(env));
  const dbBinding = env.DB ?? env["cai-database"];
  db.initDb(dbBinding);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response(JSON.stringify({ error: "code and state are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const statePayload = parseOAuthState(state);
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return new Response(JSON.stringify({ error: "openId missing from user info" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const email = userInfo.email?.toLowerCase() ?? "";
    const isCyberAgentEmail = email.endsWith(ALLOWED_DOMAIN);
    if (!isCyberAgentEmail) {
      const setting = await db.getAppSetting(INVITE_CODE_SETTING_KEY);
      const requiredInviteCode = (setting?.value ?? "").trim();
      const providedInviteCode = (statePayload.inviteCode ?? "").trim();

      if (!requiredInviteCode || providedInviteCode !== requiredInviteCode) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/login?error=${encodeURIComponent("招待コードが必要です")}`,
          },
        });
      }
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: Date.now(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const reqLike = {
      headers: headersToObject(request.headers),
      protocol: url.protocol.replace(":", ""),
    };
    const cookieOptions = getSessionCookieOptions(reqLike);
    const cookie = serialize(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: Math.floor(ONE_YEAR_MS / 1000),
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookie,
      },
    });
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return new Response(JSON.stringify({ error: "OAuth callback failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
