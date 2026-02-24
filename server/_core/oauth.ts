import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const INVITE_CODE_SETTING_KEY = "auth.inviteCode";
const ALLOWED_DOMAIN = "@cyberagent.co.jp";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function parseOAuthState(state: string): { inviteCode?: string } {
  const decode = () => {
    if (typeof atob === "function") {
      return atob(state);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(state, "base64").toString("utf-8");
    }
    return state;
  };

  const decoded = decode();
  try {
    const parsed = JSON.parse(decoded) as {
      redirectUri?: unknown;
      inviteCode?: unknown;
    };
    return {
      inviteCode: typeof parsed.inviteCode === "string" ? parsed.inviteCode : undefined,
    };
  } catch {
    return {};
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const statePayload = parseOAuthState(state);
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const email = userInfo.email?.toLowerCase() ?? "";
      const isCyberAgentEmail = email.endsWith(ALLOWED_DOMAIN);
      if (!isCyberAgentEmail) {
        const setting = await db.getAppSetting(INVITE_CODE_SETTING_KEY);
        const requiredInviteCode = (setting?.value ?? "").trim();
        const providedInviteCode = (statePayload.inviteCode ?? "").trim();

        if (!requiredInviteCode || providedInviteCode !== requiredInviteCode) {
          res.redirect(
            302,
            `/login?error=${encodeURIComponent("招待コードが必要です")}`
          );
          return;
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

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
