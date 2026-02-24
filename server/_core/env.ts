type EnvSource = Record<string, string | undefined>;

let envOverrides: EnvSource | null = null;

export function initEnv(values: EnvSource) {
  envOverrides = values;
}

function readEnv(key: string): string {
  if (envOverrides && key in envOverrides) {
    return envOverrides[key] ?? "";
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] ?? "";
  }
  return "";
}

export const ENV = {
  get appId() {
    return readEnv("VITE_APP_ID");
  },
  get cookieSecret() {
    return readEnv("JWT_SECRET");
  },
  get databaseUrl() {
    return readEnv("DATABASE_URL");
  },
  get oAuthServerUrl() {
    return readEnv("OAUTH_SERVER_URL");
  },
  get googleClientSecret() {
    return readEnv("GOOGLE_CLIENT_SECRET");
  },
  get ownerOpenId() {
    return readEnv("OWNER_OPEN_ID");
  },
  get isProduction() {
    return readEnv("NODE_ENV") === "production";
  },
  get forgeApiUrl() {
    return readEnv("BUILT_IN_FORGE_API_URL");
  },
  get forgeApiKey() {
    return readEnv("BUILT_IN_FORGE_API_KEY");
  },
};
