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
};

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

  const res = await fetch(`${baseUrl}/agentservice/authorization/auth`, {
    method: "POST",
    headers: headers(bare, false),
    body: JSON.stringify({
      Login: cfg.login,
      Password: cfg.password,
      Version: cfg.version || "62.1",
    }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(`MobCash auth HTTP ${res.status}: ${JSON.stringify(body)}`);
  }

  const token =
    body?.Data?.Token ||
    body?.Token ||
    body?.AccessToken ||
    body?.data?.token;
  if (!token) {
    throw new Error(`MobCash auth: token manquant — ${JSON.stringify(body)}`);
  }

  const session: MobCashSession = {
    baseUrl,
    token,
    refreshToken: body?.Data?.RefreshToken || body?.RefreshToken,
    ...ids,
  };

  if (cfg.cashId) {
    await switchCashdesk(session, cfg.cashId);
  }

  return session;
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
