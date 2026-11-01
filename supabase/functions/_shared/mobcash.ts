/**
 * Client MobCash (caisse 1xBet / BetWinner) — secrets uniquement côté Edge Function.
 * Découverte DNS dynamique + auth + dépôt / retrait.
 */

export type MobCashConfig = {
  login: string;
  password: string;
  cashId?: number;
  appGuid?: string;
  userUniq?: string;
  mobModel?: string;
  version?: string;
  /** Override host (sinon DNS TXT mob-kassa.bet-1x.com) */
  baseUrl?: string;
  /** Dry-run: n'appelle pas l'API réelle */
  dryRun?: boolean;
  /** Secret TOTP base32 (automatisation serveur) */
  totpSecret?: string;
  /** Code TOTP à usage unique (saisie admin) */
  totpCode?: string;
};

/** Enum CashDesk MfaRequestType — TOTP = 1 */
const MFA_TYPE_TOTP = 1;

/** RFC 6238 TOTP (SHA-1, 30s, 6 digits) from base32 secret. */
export async function generateTotp(
  base32Secret: string,
  stepSeconds = 30,
  digits = 6,
): Promise<string> {
  const key = base32ToBytes(base32Secret.replace(/\s+/g, "").toUpperCase());
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter); // big-endian low 32 (enough for years)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  const otp = bin % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

function base32ToBytes(secret: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret) {
    const val = alphabet.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export type MobCashSession = {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  appGuid: string;
  userUniq: string;
  mobModel: string;
};

async function resolveBaseUrl(explicit?: string): Promise<string> {
  if (explicit) return explicit.replace(/\/$/, "");
  const res = await fetch(
    "https://dns.google/resolve?type=16&name=mob-kassa.bet-1x.com",
  );
  const json = await res.json();
  const data = json?.Answer?.[0]?.data?.replace(/^"|"$/g, "");
  if (!data) throw new Error("Impossible de résoudre le domaine MobCash");
  return `https://${data}`;
}

function deviceIds(cfg: MobCashConfig) {
  const appGuid =
    cfg.appGuid ||
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const userUniq =
    cfg.userUniq ||
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const mobModel = cfg.mobModel || "GakokeServer/1.0";
  return { appGuid, userUniq, mobModel };
}

function headers(session: Pick<MobCashSession, "appGuid" | "userUniq" | "mobModel" | "token">, withAuth = true) {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "mobCash/62.1",
    appguid: session.appGuid,
    mobuniq: session.appGuid,
    useruniq: session.userUniq,
    mobmodel: session.mobModel,
    "x-language": "fr",
    "x-whence": "18",
  };
  if (withAuth && session.token) {
    h.authorization = `Bearer ${session.token}`;
    h["x-auth"] = `Bearer ${session.token}`;
  }
  return h;
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

export async function mobcashLogin(cfg: MobCashConfig): Promise<MobCashSession> {
  if (cfg.dryRun) {
    const ids = deviceIds(cfg);
    return {
      baseUrl: cfg.baseUrl || "https://dry-run.invalid",
      token: "dry-run-token",
      appGuid: ids.appGuid,
      userUniq: ids.userUniq,
      mobModel: ids.mobModel,
    };
  }

  const baseUrl = await resolveBaseUrl(cfg.baseUrl);
  const ids = deviceIds(cfg);
  const bare = { ...ids, token: "" };

  const login = cfg.login.trim();
  const password = cfg.password.trim();
  if (!login || !password) {
    throw new Error("MobCash: MOBCASH_LOGIN / MOBCASH_PASSWORD vides");
  }

  const res = await fetch(`${baseUrl}/agentservice/authorization/auth`, {
    method: "POST",
    headers: headers(bare, false),
    body: JSON.stringify({
      Login: login,
      Password: password,
      Version: cfg.version || "62.1",
    }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    const title =
      (body && typeof body === "object" && "title" in body && body.title) ||
      null;
    const code =
      (body && typeof body === "object" && "errorCode" in body && body.errorCode) ||
      null;
    // errorCode 8 = incorrect login/password (CashAuthService)
    if (res.status === 409 || code === 8) {
      const err = new Error(
        title
          ? `MobCash: ${title} Vérifie MOBCASH_LOGIN / MOBCASH_PASSWORD (compte caisse MobCash, pas ton e-mail Gakoke).`
          : "MobCash: identifiants caisse incorrects (MOBCASH_LOGIN / MOBCASH_PASSWORD).",
      ) as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "mobcash_auth";
      throw err;
    }
    throw new Error(`MobCash auth HTTP ${res.status}: ${JSON.stringify(body)}`);
  }

  let authBody = body;

  // MFA TOTP challenge
  if (authBody?.MfaIsNeeded || authBody?.Data?.MfaIsNeeded) {
    const mfaToken =
      authBody.MfaToken ||
      authBody.Data?.MfaToken ||
      authBody.mfaToken;
    const mfaType =
      authBody.MfaRequestType ||
      authBody.Data?.MfaRequestType ||
      "TOTP";
    if (!mfaToken) {
      throw new Error(`MobCash MFA requis mais MfaToken manquant: ${JSON.stringify(authBody)}`);
    }
    if (String(mfaType).toUpperCase() !== "TOTP" && mfaType !== MFA_TYPE_TOTP) {
      throw new Error(`MobCash MFA type non supporté: ${mfaType}`);
    }

    let code = cfg.totpCode?.trim();
    if (!code && cfg.totpSecret?.trim()) {
      code = await generateTotp(cfg.totpSecret.trim());
    }
    if (!code) {
      const err = new Error(
        "MobCash exige un code TOTP (2FA). Configure MOBCASH_TOTP_SECRET (secret base32) ou saisis un code à 6 chiffres au relancement.",
      ) as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "mobcash_mfa_required";
      throw err;
    }

    authBody = await verifyMfa(baseUrl, bare, {
      login,
      password,
      version: cfg.version || "62.1",
      mfaToken,
      mfaAnswer: code,
    });
  }

  const token =
    authBody?.Data?.Token ||
    authBody?.Token ||
    authBody?.AccessToken ||
    authBody?.data?.token;
  if (!token) {
    throw new Error(`MobCash auth: token manquant — ${JSON.stringify(authBody)}`);
  }

  const session: MobCashSession = {
    baseUrl,
    token,
    refreshToken: authBody?.Data?.RefreshToken || authBody?.RefreshToken,
    ...ids,
  };

  if (cfg.cashId) {
    await switchCashdesk(session, cfg.cashId);
  }

  return session;
}

async function verifyMfa(
  baseUrl: string,
  bare: { appGuid: string; userUniq: string; mobModel: string; token: string },
  input: {
    login: string;
    password: string;
    version: string;
    mfaToken: string;
    mfaAnswer: string;
  },
) {
  const res = await fetch(`${baseUrl}/agentservice/authorization/mfa`, {
    method: "POST",
    headers: headers(bare, false),
    body: JSON.stringify({
      request: {
        Login: input.login,
        Password: input.password,
        Version: input.version,
      },
      MfaToken: input.mfaToken,
      MfaRequestType: MFA_TYPE_TOTP,
      MfaAnswer: input.mfaAnswer,
    }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    const title = body?.title;
    const code = body?.errorCode;
    if (res.status === 409 || code === 13) {
      const err = new Error(
        title
          ? `MobCash MFA: ${title}`
          : "MobCash MFA: code TOTP incorrect ou expiré.",
      ) as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "mobcash_mfa_invalid";
      throw err;
    }
    throw new Error(`MobCash MFA HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function switchCashdesk(session: MobCashSession, cashId: number) {
  const res = await fetch(
    `${session.baseUrl}/agentservice/authorization/switchcashdesk`,
    {
      method: "POST",
      headers: headers(session),
      body: JSON.stringify({ CashId: cashId }),
    },
  );
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`switchcashdesk HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function findPlayer(
  session: MobCashSession,
  playerId: string,
  refId = 1,
) {
  const res = await fetch(`${session.baseUrl}/cashdbcore/User/Get`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify({ refId, userId: String(playerId) }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`User/Get HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function depositAdd(
  session: MobCashSession,
  amount: number,
  userToken: string,
) {
  const res = await fetch(`${session.baseUrl}/cashdbcore/Deposit/Add`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify({
      appGuid: session.appGuid,
      amount: Number(amount),
      userToken,
    }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`Deposit/Add HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function findPayoutByCode(session: MobCashSession, code: string) {
  const url = `${session.baseUrl}/cashdbcore/Deposit/FindPayoutByCode?code=${encodeURIComponent(code)}`;
  const res = await fetch(url, { headers: headers(session) });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`FindPayoutByCode HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Confirmation payout — chemin configurable (doc publique incomplète).
 * Défaut: POST /cashdbcore/Deposit/PayOut
 */
export async function confirmPayout(
  session: MobCashSession,
  payload: Record<string, unknown>,
  path = "/cashdbcore/Deposit/PayOut",
) {
  const res = await fetch(`${session.baseUrl}${path}`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`PayOut confirm HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function extractUserToken(playerBody: Record<string, unknown>): string | null {
  const d = (playerBody?.Data || playerBody?.data || playerBody) as Record<string, unknown>;
  return (
    (d?.Token as string) ||
    (d?.UserToken as string) ||
    (d?.userToken as string) ||
    ((d?.User as Record<string, unknown>)?.Token as string) ||
    null
  );
}

export async function autoDepositPlayer(
  cfg: MobCashConfig,
  playerId: string,
  amount: number,
) {
  if (cfg.dryRun) {
    return {
      dryRun: true,
      playerId,
      amount,
      message: "Dry-run: dépôt non envoyé à MobCash",
    };
  }
  const session = await mobcashLogin(cfg);
  const player = await findPlayer(session, playerId);
  const userToken = extractUserToken(player);
  if (!userToken) {
    throw new Error(`Joueur ${playerId} introuvable / token manquant`);
  }
  const result = await depositAdd(session, amount, userToken);
  return { player, result, baseUrl: session.baseUrl };
}

export async function autoWithdrawByCode(
  cfg: MobCashConfig,
  code: string,
  expectedAmount?: number,
) {
  if (cfg.dryRun) {
    return {
      dryRun: true,
      code,
      expectedAmount,
      message: "Dry-run: code retrait non encaissé sur MobCash",
    };
  }
  const session = await mobcashLogin(cfg);
  const found = await findPayoutByCode(session, code);
  const data = (found?.Data || found?.data || found) as Record<string, unknown>;
  const sum = Number(data?.Sum ?? data?.sum ?? data?.Amount);
  if (expectedAmount != null && Number.isFinite(sum) && Math.abs(sum - expectedAmount) > 0.01) {
    throw new Error(
      `Montant code (${sum}) ≠ montant demandé (${expectedAmount})`,
    );
  }
  const token = data?.Token || data?.token;
  if (!token) {
    throw new Error(`Token payout manquant: ${JSON.stringify(found)}`);
  }
  const confirmPath =
    Deno.env.get("MOBCASH_PAYOUT_CONFIRM_PATH") || "/cashdbcore/Deposit/PayOut";
  const confirmed = await confirmPayout(
    session,
    { Token: token, Code: code, Amount: sum },
    confirmPath,
  );
  return { found, confirmed, sum, baseUrl: session.baseUrl };
}
