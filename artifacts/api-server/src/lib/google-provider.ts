import * as oidc from "openid-client";

export type GoogleIdentity = { issuer: string; subject: string; email: string };
export type GoogleProof = { state: string; nonce: string; verifier: string };
export interface GoogleProvider {
  configured(): boolean;
  authorize(proof: GoogleProof): Promise<string>;
  verify(callback: URL, proof: GoogleProof): Promise<GoogleIdentity>;
}

// Never derive the OAuth callback from attacker-controlled Host headers.
function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const callback = process.env.GOOGLE_CALLBACK_URL;
  if (!clientId || !secret || !callback) throw new Error("Google não configurado");
  const url = new URL(callback);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/api/auth/google/callback" || url.search || url.hash) {
    throw new Error("Retorno Google inválido");
  }
  return { clientId, secret, callback };
}

async function configuration() {
  const { clientId, secret } = settings();
  const config = await oidc.discovery(
    new URL("https://accounts.google.com"), clientId, secret,
  );
  // Also verify the ID-token signature against Google's published JWKS.
  oidc.enableNonRepudiationChecks(config);
  return config;
}

export const googleProvider: GoogleProvider = {
  configured() {
    try { settings(); return true; } catch { return false; }
  },
  async authorize(proof) {
    const config = await configuration();
    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: settings().callback,
      scope: "openid email",
      state: proof.state,
      nonce: proof.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(proof.verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).href;
  },
  async verify(callback, proof) {
    const config = await configuration();
    const trustedCallback = new URL(settings().callback);
    trustedCallback.search = callback.search;
    const tokens = await oidc.authorizationCodeGrant(config, trustedCallback, {
      expectedState: proof.state,
      expectedNonce: proof.nonce,
      pkceCodeVerifier: proof.verifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || claims.iss !== "https://accounts.google.com" ||
        typeof claims.sub !== "string" || !claims.sub ||
        claims.email_verified !== true || typeof claims.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
      throw new Error("Identidade Google inválida");
    }
    // Access/refresh tokens are deliberately neither returned nor persisted.
    return { issuer: claims.iss, subject: claims.sub, email: claims.email.toLowerCase() };
  },
};
