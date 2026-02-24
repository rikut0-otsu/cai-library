export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

type GetLoginUrlOptions = {
  selectAccount?: boolean;
  inviteCode?: string;
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (options?: GetLoginUrlOptions) => {
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const statePayload = JSON.stringify({
    redirectUri,
    inviteCode: options?.inviteCode?.trim() || undefined,
  });
  const state = btoa(statePayload);

  if (!appId) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Auth] Missing VITE_APP_ID. Check your environment variables."
      );
    }
    return window.location.href;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  if (options?.selectAccount) {
    url.searchParams.set("prompt", "select_account");
  }

  return url.toString();
};

export const getOwnerContactHref = () => {
  const contactUrl = import.meta.env.VITE_OWNER_CONTACT_URL?.trim();
  if (contactUrl) {
    return contactUrl;
  }

  const contactEmail = import.meta.env.VITE_OWNER_CONTACT_EMAIL?.trim();
  if (contactEmail) {
    return `mailto:${contactEmail}?subject=${encodeURIComponent("CAI Support")}`;
  }

  return null;
};
