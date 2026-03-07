import { initEnv } from "../server/_core/env";
import { getCaseStudyById, initDb } from "../server/db";

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
  next: () => Promise<Response>;
};

const DEFAULT_DESCRIPTION =
  "CAI LIBRARYはAI活用事例を共有・検索できるナレッジプラットフォームです。";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const upsertMetaTag = (
  html: string,
  attributeName: "name" | "property",
  attributeValue: string,
  content: string
) => {
  const escapedAttributeValue = escapeRegExp(attributeValue);
  const tagRegex = new RegExp(
    `<meta\\s+[^>]*${attributeName}=["']${escapedAttributeValue}["'][^>]*>`,
    "i"
  );
  const tag = `<meta ${attributeName}="${attributeValue}" content="${escapeHtml(content)}" />`;
  if (tagRegex.test(html)) {
    return html.replace(tagRegex, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
};

export const onRequest = async (context: PagesContext) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (request.method !== "GET") return next();
  if (url.pathname.startsWith("/api/")) return next();

  const caseIdRaw = url.searchParams.get("caseId");
  const caseId = Number(caseIdRaw);
  if (!Number.isInteger(caseId) || caseId <= 0) return next();

  const envRecord: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") envRecord[key] = value;
  }
  initEnv(envRecord);
  initDb(env.DB ?? env["cai-database"]);

  const caseStudy = await getCaseStudyById(caseId);
  if (!caseStudy) return next();

  const response = await next();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const authorName = (caseStudy.authorName ?? "だれか").trim() || "だれか";
  const title = `${authorName}さんが、${caseStudy.title}を追加しました！チェックしよう！`;
  const description = (caseStudy.description ?? "").trim() || DEFAULT_DESCRIPTION;
  const imageUrl = caseStudy.thumbnailUrl
    ? new URL(caseStudy.thumbnailUrl, url.origin).toString()
    : new URL("/logo1.png", url.origin).toString();
  const pageUrl = `${url.origin}/?caseId=${caseStudy.id}`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertMetaTag(html, "property", "og:type", "article");
  html = upsertMetaTag(html, "property", "og:site_name", "CAI LIBRARY");
  html = upsertMetaTag(html, "property", "og:title", title);
  html = upsertMetaTag(html, "property", "og:description", description);
  html = upsertMetaTag(html, "property", "og:image", imageUrl);
  html = upsertMetaTag(html, "property", "og:image:alt", caseStudy.title);
  html = upsertMetaTag(html, "property", "og:url", pageUrl);
  html = upsertMetaTag(html, "name", "description", description);
  html = upsertMetaTag(html, "name", "twitter:card", "summary_large_image");
  html = upsertMetaTag(html, "name", "twitter:title", title);
  html = upsertMetaTag(html, "name", "twitter:description", description);
  html = upsertMetaTag(html, "name", "twitter:image", imageUrl);
  html = upsertMetaTag(html, "name", "twitter:image:alt", caseStudy.title);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
