import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenResponse,
  GetUserInfoResponse,
} from "./types/manusTypes";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

type GoogleUserInfoResponse = {
  sub: string;
  name?: string;
  email?: string;
};

const postForm = async <T>(
  url: string,
  body: Record<string, string>
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `OAuth request failed (${response.status} ${response.statusText}): ${message}`
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class OAuthService {
  private decodeState(state: string): string {
    const parsePayload = (decoded: string): string => {
      try {
        const parsed = JSON.parse(decoded) as { redirectUri?: unknown };
        if (typeof parsed.redirectUri === "string" && parsed.redirectUri.length > 0) {
          return parsed.redirectUri;
        }
      } catch {
        // Ignore JSON parse errors and fallback to raw decoded value.
      }
      return decoded;
    };

    if (typeof atob === "function") {
      return parsePayload(atob(state));
    }
    if (typeof Buffer !== "undefined") {
      return parsePayload(Buffer.from(state, "base64").toString("utf-8"));
    }
    return state;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const clientId = ENV.appId;
    const clientSecret = ENV.googleClientSecret;

    if (!clientId) {
      throw new Error("VITE_APP_ID is not configured.");
    }
    if (!clientSecret) {
      throw new Error(
        "GOOGLE_CLIENT_SECRET is not configured. Set GOOGLE_CLIENT_SECRET in your environment."
      );
    }

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.decodeState(state),
    };

    const data = await postForm<GoogleTokenResponse>(GOOGLE_TOKEN_URL, payload);
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      scope: data.scope ?? "",
      idToken: data.id_token ?? "",
    };
  }

  async getUserInfoByToken(
    accessToken: string
  ): Promise<GoogleUserInfoResponse> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `OAuth userinfo failed (${response.status} ${response.statusText}): ${message}`
      );
    }

    return (await response.json()) as GoogleUserInfoResponse;
  }
}

class SDKServer {
  private readonly oauthService: OAuthService;

  constructor(oauthService: OAuthService = new OAuthService()) {
    this.oauthService = oauthService;
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ) {
    const key = Object.keys(headers).find(
      (header) => header.toLowerCase() === name.toLowerCase()
    );
    const value = key ? headers[key] : undefined;
    return Array.isArray(value) ? value.join("; ") : value;
  }

  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken(accessToken);
    return {
      openId: data.sub,
      projectId: ENV.appId,
      name: data.name || data.email || "",
      email: data.email ?? null,
      platform: "google",
      loginMethod: "google",
    };
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: RequestLike): Promise<User> {
    const cookieHeader = this.getHeader(req.headers, "cookie");
    const cookies = this.parseCookies(cookieHeader);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = Date.now();
    let user = await db.getUserByOpenId(sessionUserId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
