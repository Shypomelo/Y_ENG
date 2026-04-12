const fs = require("fs");
const path = require("path");

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || "AIzaSyAM9Pzx8rZnZwS5CcBHaz9uziqJ1kmFdC8";
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "solargarden-web-prod";
const FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID || "1:922703462491:web:2557c83ecb316a50333f7e";

const EMAIL = process.env.FIREBASE_EMAIL || process.env.COMPANY_EMAIL || null;
const PASSWORD =
  process.env.FIREBASE_PASSWORD || process.env.COMPANY_PASSWORD || null;
const ID_TOKEN = process.env.FIREBASE_ID_TOKEN || null;
const REFRESH_TOKEN = process.env.FIREBASE_REFRESH_TOKEN || null;
const PROJECT_ID_HINT = process.env.FIRESTORE_PROJECT_ID_HINT || null;
const LOG_DOC_ID_HINT = process.env.FIRESTORE_LOG_DOC_ID_HINT || null;
const OPERATIONS_SCAN_LIMIT = Number(process.env.FIRESTORE_OPERATIONS_SCAN_LIMIT || 60);
const OPERATIONS_PAGE_SIZE = Number(process.env.FIRESTORE_OPERATIONS_PAGE_SIZE || 20);
const LOGS_PAGE_SIZE = Number(process.env.FIRESTORE_LOGS_PAGE_SIZE || 5);

const OUTPUT_PATH =
  process.env.OUTPUT_PATH ||
  path.join(process.cwd(), "tmp", "firebase-auth-firestore-readonly-poc-result.json");

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string" || token.split(".").length < 2) {
    return null;
  }

  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
    return JSON.parse(Buffer.from(base64 + pad, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function scrubToken(token) {
  if (!token || typeof token !== "string") return null;
  if (token.length <= 16) return "***";
  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}

function summarizeDocumentNames(documents = []) {
  return documents.map((doc) => ({
    name: doc.name || null,
    fields: doc.fields ? Object.keys(doc.fields).slice(0, 12) : [],
  }));
}

function inferProjectDocId(doc) {
  const name = doc?.name || "";
  const match = name.match(/\/documents\/operations\/([^/]+)$/);
  return match ? match[1] : null;
}

function summarizeLogDocuments(documents = []) {
  return documents.map((doc) => ({
    name: doc.name || null,
    fields: doc.fields ? Object.keys(doc.fields) : [],
  }));
}

function extractKnownLogFieldPresence(fields = {}) {
  const names = Object.keys(fields);
  const has = (name) => names.includes(name);
  const repairmanFields = names.filter((name) => /^repairman[1-6]$/.test(name));

  return {
    timestamp: has("timestamp"),
    user: has("user"),
    category: has("category"),
    content: has("content"),
    monitor: has("monitor"),
    error: has("error"),
    monitorNote: has("monitorNote"),
    repairNote: has("repairNote"),
    repairStatus: has("repairStatus"),
    repairStartDate: has("repairStartDate"),
    repairEndDate: has("repairEndDate"),
    repairman1to6: repairmanFields,
  };
}

async function signInWithPassword(result) {
  if (!EMAIL || !PASSWORD) {
    result.validation.auth = {
      ok: false,
      stage: "auth_login",
      reason: "missing_credentials",
      message:
        "Missing FIREBASE_EMAIL/COMPANY_EMAIL or FIREBASE_PASSWORD/COMPANY_PASSWORD.",
    };
    return null;
  }

  const response = await postJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`,
    {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    }
  );

  result.auth.signIn = {
    ok: response.ok,
    status: response.status,
    email: EMAIL,
    error: response.ok ? null : response.json || response.text,
  };

  if (!response.ok || !response.json?.idToken) {
    result.validation.auth = {
      ok: false,
      stage: "auth_login",
      reason: "sign_in_failed",
      message: response.json?.error?.message || `HTTP ${response.status}`,
    };
    return null;
  }

  return response.json;
}

async function refreshIdToken(result) {
  if (!REFRESH_TOKEN) return null;

  const response = await postForm(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }
  );

  result.auth.refresh = {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : response.json || response.text,
  };

  if (!response.ok || !response.json?.id_token) {
    return null;
  }

  return {
    idToken: response.json.id_token,
    refreshToken: response.json.refresh_token,
    localId: response.json.user_id,
    expiresIn: response.json.expires_in,
  };
}

async function lookupAccount(idToken, result) {
  const response = await postJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`,
    { idToken }
  );

  result.auth.lookup = {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : response.json || response.text,
    users: response.ok ? response.json?.users || [] : [],
  };

  return response;
}

async function listOperations(idToken, result, pageToken = null) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/operations`
  );
  url.searchParams.set("pageSize", String(OPERATIONS_PAGE_SIZE));
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await getJson(url.toString(), {
    authorization: `Bearer ${idToken}`,
    "x-firebase-gmpid": FIREBASE_APP_ID,
  });

  return response;
}

async function listLogs(idToken, projectDocId, result) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/operations/${encodeURIComponent(
      projectDocId
    )}/logs?pageSize=${encodeURIComponent(String(LOGS_PAGE_SIZE))}`;

  const response = await getJson(url, {
    authorization: `Bearer ${idToken}`,
    "x-firebase-gmpid": FIREBASE_APP_ID,
  });

  result.firestore.logs = {
    ok: response.ok,
    status: response.status,
    projectDocId,
    error: response.ok ? null : response.json || response.text,
    documents: response.ok ? summarizeLogDocuments(response.json?.documents || []) : [],
  };

  return response;
}

async function getLogDoc(idToken, projectDocId, logDocId, result) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/operations/${encodeURIComponent(
      projectDocId
    )}/logs/${encodeURIComponent(logDocId)}`;

  const response = await getJson(url, {
    authorization: `Bearer ${idToken}`,
    "x-firebase-gmpid": FIREBASE_APP_ID,
  });

  result.firestore.logDoc = {
    ok: response.ok,
    status: response.status,
    projectDocId,
    logDocId,
    error: response.ok ? null : response.json || response.text,
    document: response.ok
      ? {
          name: response.json?.name || null,
          fields: response.json?.fields ? Object.keys(response.json.fields).slice(0, 20) : [],
        }
      : null,
  };

  return response;
}

async function main() {
  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    config: {
      firebaseApiKey: FIREBASE_API_KEY,
      firebaseProjectId: FIREBASE_PROJECT_ID,
      firebaseAppId: FIREBASE_APP_ID,
      emailHint: EMAIL,
      hasPassword: Boolean(PASSWORD),
      hasProvidedIdToken: Boolean(ID_TOKEN),
      hasProvidedRefreshToken: Boolean(REFRESH_TOKEN),
      projectIdHint: PROJECT_ID_HINT,
      logDocIdHint: LOG_DOC_ID_HINT,
    },
    auth: {},
    token: {},
    firestore: {},
    validation: {
      auth: null,
      token: null,
      operationsRead: null,
      logsRead: null,
    },
    finishedAt: null,
  };

  try {
    let authPayload = null;

    if (EMAIL && PASSWORD) {
      authPayload = await signInWithPassword(result);
    } else if (REFRESH_TOKEN) {
      authPayload = await refreshIdToken(result);
      if (!authPayload) {
        result.validation.auth = {
          ok: false,
          stage: "auth_login",
          reason: "refresh_failed",
          message: result.auth.refresh?.error?.error?.message || "Refresh token failed.",
        };
      } else {
        result.validation.auth = {
          ok: true,
          stage: "auth_login",
          reason: "refresh_token",
          message: "Obtained token via refresh token.",
        };
      }
    } else if (ID_TOKEN) {
      result.validation.auth = {
        ok: false,
        stage: "auth_login",
        reason: "missing_password_login",
        message: "Only an ID token was provided; email/password login was not executed.",
      };
      authPayload = { idToken: ID_TOKEN };
    } else {
      result.validation.auth = {
        ok: false,
        stage: "auth_login",
        reason: "missing_credentials",
        message:
          "No FIREBASE_EMAIL/FIREBASE_PASSWORD, FIREBASE_REFRESH_TOKEN, or FIREBASE_ID_TOKEN provided.",
      };
    }

    const token = authPayload?.idToken || null;
    const payload = decodeJwtPayload(token);

    result.token = {
      obtained: Boolean(token),
      idTokenPreview: scrubToken(token),
      refreshTokenPreview: scrubToken(authPayload?.refreshToken || REFRESH_TOKEN || null),
      localId: authPayload?.localId || null,
      jwtPayload: payload,
      expiresAt: payload?.exp ? new Date(payload.exp * 1000).toISOString() : null,
      now: new Date().toISOString(),
    };

    if (!token) {
      result.validation.token = {
        ok: false,
        stage: "token",
        reason: "token_unavailable",
        message: "No usable Firebase ID token was obtained.",
      };
      return result;
    }

    const lookup = await lookupAccount(token, result);
    if (!lookup.ok) {
      result.validation.token = {
        ok: false,
        stage: "token",
        reason: "lookup_failed",
        message: lookup.json?.error?.message || `HTTP ${lookup.status}`,
      };
    } else {
      result.validation.token = {
        ok: true,
        stage: "token",
        reason: "lookup_ok",
        message: "Firebase Auth token works for accounts:lookup.",
      };
    }

    const operations = await listOperations(token, result);
    if (!operations.ok) {
      result.firestore.operations = {
        ok: false,
        status: operations.status,
        error: operations.json || operations.text,
        documents: [],
        scannedProjectDocIds: [],
      };
      result.validation.operationsRead = {
        ok: false,
        stage: "firestore_operations",
        reason: operations.status === 403 ? "permission_denied" : "read_failed",
        message: operations.json?.error?.message || `HTTP ${operations.status}`,
      };
      return result;
    }

    const scannedProjectDocIds = [];
    const firstOperationDocs = operations.json?.documents || [];
    const operationDocs = [...firstOperationDocs];
    let nextPageToken = operations.json?.nextPageToken || null;

    while (operationDocs.length < OPERATIONS_SCAN_LIMIT && nextPageToken) {
      const nextPage = await listOperations(token, result, nextPageToken);
      if (!nextPage.ok) break;
      operationDocs.push(...(nextPage.json?.documents || []));
      nextPageToken = nextPage.json?.nextPageToken || null;
    }

    result.firestore.operations = {
      ok: true,
      status: operations.status,
      error: null,
      documents: summarizeDocumentNames(operationDocs.slice(0, 5)),
      scannedCount: operationDocs.length,
      nextPageTokenPresent: Boolean(nextPageToken),
      scannedProjectDocIds,
    };

    let projectDocId = PROJECT_ID_HINT || null;
    let logs = null;

    if (projectDocId) {
      logs = await listLogs(token, projectDocId, result);
    } else {
      for (const doc of operationDocs) {
        const candidateProjectDocId = inferProjectDocId(doc);
        if (!candidateProjectDocId) continue;
        scannedProjectDocIds.push(candidateProjectDocId);

        const candidateLogs = await listLogs(token, candidateProjectDocId, result);
        if (!candidateLogs.ok) {
          logs = candidateLogs;
          projectDocId = candidateProjectDocId;
          break;
        }

        if ((candidateLogs.json?.documents || []).length > 0) {
          projectDocId = candidateProjectDocId;
          logs = candidateLogs;
          break;
        }

        if (!logs) {
          logs = candidateLogs;
          projectDocId = candidateProjectDocId;
        }
      }
    }

    result.firestore.operations.scannedProjectDocIds = scannedProjectDocIds;

    result.validation.operationsRead = {
      ok: true,
      stage: "firestore_operations",
      reason: "read_ok",
      message: `Read ${operationDocs.length} operation document(s) and scanned ${scannedProjectDocIds.length} projectDocId(s).`,
      projectDocId,
    };

    if (!projectDocId) {
      result.validation.logsRead = {
        ok: false,
        stage: "firestore_logs",
        reason: "missing_project_doc_id",
        message: "Could not infer a project document id from operations read.",
      };
      return result;
    }

    if (!logs) {
      logs = await listLogs(token, projectDocId, result);
    }
    if (!logs.ok) {
      result.validation.logsRead = {
        ok: false,
        stage: "firestore_logs",
        reason: logs.status === 403 ? "permission_denied" : "read_failed",
        message: logs.json?.error?.message || `HTTP ${logs.status}`,
        projectDocId,
      };
      return result;
    }

    const logDocs = logs.json?.documents || [];
    const logDocId =
      LOG_DOC_ID_HINT ||
      ((logDocs[0]?.name || "").match(/\/logs\/([^/]+)$/) || [])[1] ||
      null;

    result.validation.logsRead = {
      ok: true,
      stage: "firestore_logs",
      reason: "read_ok",
      message: `Read ${logDocs.length} log document(s).`,
      projectDocId,
      logDocId,
    };

    if (logDocId) {
      await getLogDoc(token, projectDocId, logDocId, result);
    }

    result.firestore.logs = {
      ...result.firestore.logs,
      sampledFieldPresence: logDocs.map((doc) =>
        extractKnownLogFieldPresence(doc.fields || {})
      ),
    };

    return result;
  } finally {
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ outputPath: OUTPUT_PATH, validation: result.validation }, null, 2));
  }
}

main().catch((error) => {
  const fallback = {
    startedAt: new Date().toISOString(),
    fatalError: {
      message: error.message,
      stack: error.stack,
    },
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2));
  console.error(error);
  process.exit(1);
});
