/**
 * Client MobCash (caisse 1xBet / BetWinner) — secrets uniquement côté Edge Function.
 * Découverte DNS dynamique + auth + switch caisse + dépôt / retrait.
 * MFA/TOTP non supporté : désactiver la 2FA sur le compte caisse.
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
  cashId?: number;
  /** Partner/ref id from JWT `idRef` after switchcashdesk — required by User/Get */
  refId?: number;
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
    crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const userUniq =
    cfg.userUniq ||
    crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const mobModel = cfg.mobModel || "GakokeServer/1.0";
  return { appGuid, userUniq, mobModel };
}

function headers(
  session: Pick<MobCashSession, "appGuid" | "userUniq" | "mobModel" | "token">,
  withAuth = true,
) {
  const h: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": "mobCash/62.1",
    appguid: session.appGuid,
    mobuniq: session.appGuid,
    useruniq: session.userUniq,
    mobmodel: session.mobModel,
    "x-language": "fr",
    "x-whence": "18",
  };
  if (withAuth && session.token) {
    const raw = session.token.replace(/^Bearer\s+/i, "");
    // L'app mobile envoie souvent les deux formes
    h.authorization = `Bearer ${raw}`;
    h["x-auth"] = `Bearer ${raw}`;
    h["X-Auth"] = `Bearer ${raw}`;
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

function isJwtLike(v: unknown): v is string {
  return typeof v === "string" && /^eyJ[A-Za-z0-9_-]+\./.test(v);
}

/** Decode JWT payload (no verify — MobCash tokens are opaque to us). */
function jwtClaims(token: string): Record<string, unknown> {
  try {
    const raw = token.replace(/^Bearer\s+/i, "").split(".")[1];
    if (!raw) return {};
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Apply CashId / idRef from switchcashdesk JWT onto the session. */
function applySessionClaims(session: MobCashSession) {
  const claims = jwtClaims(session.token);
  const cash = Number(claims.CashId ?? claims.cashId);
  if (Number.isFinite(cash) && cash > 0) session.cashId = cash;
  const ref = Number(claims.idRef ?? claims.IdRef ?? claims.pid);
  if (Number.isFinite(ref) && ref > 0) session.refId = ref;
}

/** Cherche un JWT dans la réponse auth (structures MobCash variables). */
function extractAuthToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const preferred = [
    o.Token,
    o.AccessToken,
    o.Jwt,
    o.jwt,
    o.access_token,
    o.AuthToken,
    (o.Data as Record<string, unknown> | undefined)?.Token,
    (o.Data as Record<string, unknown> | undefined)?.AccessToken,
    (o.Data as Record<string, unknown> | undefined)?.Jwt,
    (o.data as Record<string, unknown> | undefined)?.token,
    (o.data as Record<string, unknown> | undefined)?.accessToken,
    ((o.Data as Record<string, unknown> | undefined)?.Auth as Record<
      string,
      unknown
    > | undefined)?.Token,
    ((o.Data as Record<string, unknown> | undefined)?.User as Record<
      string,
      unknown
    > | undefined)?.Token,
  ];
  for (const c of preferred) {
    if (isJwtLike(c)) return c;
    if (typeof c === "string" && c.length > 20) return c;
  }
  // Deep scan for JWT
  const stack: unknown[] = [body];
  while (stack.length) {
    const cur = stack.pop();
    if (isJwtLike(cur)) return cur;
    if (cur && typeof cur === "object") {
      for (const v of Object.values(cur as Record<string, unknown>)) {
        stack.push(v);
      }
    }
  }
  return null;
}

function authResponseKeys(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const keys = Object.keys(body as object);
  const data = (body as Record<string, unknown>).Data;
  if (data && typeof data === "object") {
    keys.push(...Object.keys(data as object).map((k) => `Data.${k}`));
  }
  return keys;
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
      (body && typeof body === "object" && "errorCode" in body &&
        body.errorCode) ||
      null;
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

  if (body?.MfaIsNeeded || body?.Data?.MfaIsNeeded) {
    const err = new Error(
      "MobCash demande encore une 2FA. Désactive le TOTP sur le compte caisse (paramètres MobCash).",
    ) as Error & { status?: number; code?: string };
    err.status = 401;
    err.code = "mobcash_mfa_enabled";
    throw err;
  }

  const token = extractAuthToken(body);
  if (!token) {
    throw new Error(
      `MobCash auth: token manquant (clés: ${authResponseKeys(body).join(", ")}) — ${JSON.stringify(body).slice(0, 500)}`,
    );
  }

  const session: MobCashSession = {
    baseUrl,
    token,
    refreshToken:
      extractAuthToken({
        t: body?.Data?.RefreshToken || body?.RefreshToken,
      }) ||
      (typeof body?.Data?.RefreshToken === "string"
        ? body.Data.RefreshToken
        : undefined) ||
      (typeof body?.RefreshToken === "string" ? body.RefreshToken : undefined),
    ...ids,
  };

  // cashdbcore exige souvent une caisse active
  await ensureCashdesk(session, cfg.cashId);

  return session;
}

function deskId(d: Record<string, unknown>): number | null {
  const n = Number(d?.CashId ?? d?.cashId ?? d?.Id ?? d?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Partner/ref id sometimes present on cashdesk rows (fallback if JWT idRef empty). */
function deskRefId(d: Record<string, unknown>): number | null {
  const n = Number(
    d?.IdRef ?? d?.idRef ?? d?.RefId ?? d?.refId ?? d?.PartnerId ?? d?.pid,
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

function deskLabel(d: Record<string, unknown>): string {
  const id = deskId(d);
  const name = String(d?.CashName ?? d?.cashName ?? d?.Name ?? "");
  const ref = deskRefId(d);
  const base = name ? `${id}:${name}` : String(id);
  return ref ? `${base}(ref=${ref})` : base;
}

function claimSummary(session: MobCashSession): string {
  const c = jwtClaims(session.token);
  return `jwt.CashId=${c.CashId ?? ""} jwt.idRef=${c.idRef ?? ""} jwt.pid=${c.pid ?? ""} jwt.status=${c.statusCashdesk ?? ""}`;
}

async function ensureCashdesk(session: MobCashSession, preferredCashId?: number) {
  // Toujours lister les caisses autorisées pour ce login (évite un CASH_ID fantôme)
  const desks = await getCashdesks(session);
  if (!desks.length) {
    throw new Error(
      "Aucune caisse MobCash liée à ce compte. Vérifie le login agent / droits caisse.",
    );
  }

  const ids = desks
    .map((d) => deskId(d as Record<string, unknown>))
    .filter((n): n is number => n != null);

  let cashId = preferredCashId;
  if (cashId && !ids.includes(cashId)) {
    throw new Error(
      `MOBCASH_CASH_ID=${cashId} n'appartient pas à ce compte. Caisses dispo: ${desks.map((d) => deskLabel(d as Record<string, unknown>)).join(", ")}`,
    );
  }
  if (!cashId) cashId = ids[0];
  if (!cashId) {
    throw new Error(
      `Impossible de lire CashId: ${JSON.stringify(desks).slice(0, 300)}`,
    );
  }

  const selected =
    desks.find((d) => deskId(d as Record<string, unknown>) === cashId) ??
    desks[0];
  const deskRef = deskRefId(selected as Record<string, unknown>);
  if (deskRef) session.refId = deskRef;

  try {
    await switchCashdesk(session, cashId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    applySessionClaims(session);
    // 409 only OK if JWT is already bound to this cashdesk (has CashId + idRef)
    const bound =
      session.cashId === cashId && typeof session.refId === "number" &&
      session.refId > 0;
    if (
      bound && ids.length === 1 &&
      /errorCode\":10|authorization-failed|Авторизация/i.test(msg)
    ) {
      return;
    }
    if (/errorCode\":10|authorization-failed|Авторизация/i.test(msg)) {
      throw new Error(
        `MobCash refuse le switch caisse (errorCode 10) pour CashId=${cashId}. ` +
          `Ouvre l'app MobCash, sélectionne « ${deskLabel(selected as Record<string, unknown>)} », ` +
          `ferme les autres appareils/sessions, vérifie que la caisse n'est pas bloquée, puis Relancer. ` +
          `(Sans JWT lié à la caisse, User/Get renvoie 400.) ` +
          `${claimSummary(session)}`,
      );
    }
    throw new Error(
      `${msg} — caisses dispo: ${desks.map((d) => deskLabel(d as Record<string, unknown>)).join(", ")}; ${claimSummary(session)}`,
    );
  }
  session.cashId = cashId;
  applySessionClaims(session);
  if (deskRef && !session.refId) session.refId = deskRef;

  if (!session.refId) {
    throw new Error(
      `Session caisse sans idRef après switch (User/Get impossible). ${claimSummary(session)} — desks: ${desks.map((d) => deskLabel(d as Record<string, unknown>)).join(", ")} | raw=${JSON.stringify(selected).slice(0, 400)}`,
    );
  }
}

export async function getCashdesks(session: MobCashSession) {
  const res = await fetch(`${session.baseUrl}/cashdbcore/GetCashdesks`, {
    method: "GET",
    headers: headers(session),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(
      `GetCashdesks HTTP ${res.status}: token_ok=${isJwtLike(session.token)} ${JSON.stringify(body)}`,
    );
  }
  const data = body?.Data ?? body?.data ?? body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.Items)) return data.Items;
  if (Array.isArray(data?.Cashdesks)) return data.Cashdesks;
  return [];
}

export async function switchCashdesk(session: MobCashSession, cashId: number) {
  const payloads = [
    { CashId: cashId },
    { CashId: String(cashId) },
    { cashId },
    { Id: cashId },
  ];
  let lastBody: unknown;
  let lastStatus = 0;
  for (const payload of payloads) {
    const res = await fetch(
      `${session.baseUrl}/agentservice/authorization/switchcashdesk`,
      {
        method: "POST",
        headers: headers(session),
        body: JSON.stringify(payload),
      },
    );
    const body = await readJson(res);
    lastBody = body;
    lastStatus = res.status;
    if (res.ok) {
      const next = extractAuthToken(body);
      if (next) session.token = next;
      applySessionClaims(session);
      // Switch OK doit lier CashId dans le JWT — sinon User/Get renvoie 400
      const claims = jwtClaims(session.token);
      if (!claims.CashId && !claims.cashId) {
        throw new Error(
          `switchcashdesk OK mais JWT sans CashId (${claimSummary(session)}); body=${JSON.stringify(body).slice(0, 300)}`,
        );
      }
      return body;
    }
    // 409 authorization-failed : ne pas retenter d'autres formes inutilement
    if (res.status === 409 && body?.errorCode === 10) break;
  }
  throw new Error(
    `switchcashdesk HTTP ${lastStatus}: ${JSON.stringify(lastBody)}`,
  );
}

export async function findPlayer(
  session: MobCashSession,
  playerId: string,
  refId?: number,
) {
  const pid = String(playerId).trim();
  if (!pid) throw new Error("User/Get: playerId vide");
  const pidNum = Number(pid);

  // refId = partner id (JWT idRef après switch), PAS le CashId caisse.
  // Ex. cashId=1371891 → idRef=216 dans le JWT.
  applySessionClaims(session);
  const refs = [
    refId,
    session.refId,
    // fallbacks historiques si idRef absent du token
    1,
    0,
    session.cashId,
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const uniqueRefs = [...new Set(refs)];

  const payloads: Record<string, unknown>[] = [];
  for (const r of uniqueRefs) {
    // Forme documentée MobCash v62.1
    payloads.push({ refId: r, userId: pid });
    if (Number.isFinite(pidNum) && pidNum > 0) {
      payloads.push({ refId: r, userId: pidNum });
    }
    payloads.push({ RefId: r, UserId: pid });
  }

  const attempts: string[] = [];
  let lastErr = "";
  for (const payload of payloads) {
    const res = await fetch(`${session.baseUrl}/cashdbcore/User/Get`, {
      method: "POST",
      headers: headers(session),
      body: JSON.stringify(payload),
    });
    const body = await readJson(res);
    attempts.push(`${res.status}:${JSON.stringify(payload)}`);
    if (res.ok) return body;
    lastErr = `User/Get HTTP ${res.status}: ${JSON.stringify(body)}`;
    if (res.status === 401) break;
    // 404 joueur inconnu → inutile de continuer toutes les variantes
    if (res.status === 404) break;
  }
  throw new Error(
    `${lastErr} (cashId=${session.cashId ?? "?"} refId=${session.refId ?? "?"} ${claimSummary(session)}; tried ${attempts.slice(0, 8).join(" | ")})`,
  );
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
  const url =
    `${session.baseUrl}/cashdbcore/Deposit/FindPayoutByCode?code=${encodeURIComponent(code)}`;
  const res = await fetch(url, { headers: headers(session) });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(
      `FindPayoutByCode HTTP ${res.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

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
    throw new Error(
      `PayOut confirm HTTP ${res.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function extractUserToken(playerBody: Record<string, unknown>): string | null {
  const d = (playerBody?.Data || playerBody?.data || playerBody) as Record<
    string,
    unknown
  >;
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
    throw new Error(
      `Joueur ${playerId} introuvable / token manquant: ${JSON.stringify(player).slice(0, 400)}`,
    );
  }
  const result = await depositAdd(session, amount, userToken);
  return { player, result, baseUrl: session.baseUrl, cashId: session.cashId };
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
  if (
    expectedAmount != null &&
    Number.isFinite(sum) &&
    Math.abs(sum - expectedAmount) > 0.01
  ) {
    throw new Error(
      `Montant code (${sum}) ≠ montant demandé (${expectedAmount})`,
    );
  }
  const token = data?.Token || data?.token;
  if (!token) {
    throw new Error(`Token payout manquant: ${JSON.stringify(found)}`);
  }
  const confirmPath =
    Deno.env.get("MOBCASH_PAYOUT_CONFIRM_PATH") ||
    "/cashdbcore/Deposit/PayOut";
  const confirmed = await confirmPayout(
    session,
    { Token: token, Code: code, Amount: sum },
    confirmPath,
  );
  return { found, confirmed, sum, baseUrl: session.baseUrl, cashId: session.cashId };
}
