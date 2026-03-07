import { initEnv } from "../../server/_core/env";
import { getCaseStudyById, initDb } from "../../server/db";

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

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const fetchFallbackLogo = async (requestUrl: URL) => {
  const logoUrl = new URL("/logo1.png", requestUrl.origin).toString();
  const response = await fetch(logoUrl);
  if (!response.ok) {
    return new Response("Image not found", { status: 404 });
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(response.body, {
    status: 200,
    headers,
  });
};

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  initEnv(toEnvRecord(env));
  initDb(env.DB ?? env["cai-database"]);

  const url = new URL(request.url);
  const caseId = Number(url.searchParams.get("caseId"));
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return fetchFallbackLogo(url);
  }

  const caseStudy = await getCaseStudyById(caseId);
  if (!caseStudy?.thumbnailUrl) {
    return fetchFallbackLogo(url);
  }

  const thumbnailUrl = caseStudy.thumbnailUrl.trim();
  if (!thumbnailUrl) {
    return fetchFallbackLogo(url);
  }

  if (thumbnailUrl.startsWith("data:")) {
    const matched = thumbnailUrl.match(/^data:([^;,]+);base64,(.+)$/);
    if (!matched) {
      return fetchFallbackLogo(url);
    }
    const mimeType = matched[1] || "image/jpeg";
    const base64 = matched[2];
    try {
      const bytes = base64ToBytes(base64);
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (error) {
      console.error("[og-image] failed to decode data URL", error);
      return fetchFallbackLogo(url);
    }
  }

  try {
    const resolvedUrl = new URL(thumbnailUrl, url.origin).toString();
    const imageResponse = await fetch(resolvedUrl);
    if (!imageResponse.ok) {
      return fetchFallbackLogo(url);
    }
    const headers = new Headers(imageResponse.headers);
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[og-image] failed to fetch image", error);
    return fetchFallbackLogo(url);
  }
};

