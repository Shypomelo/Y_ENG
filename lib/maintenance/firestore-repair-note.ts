import * as fs from "fs";
import * as path from "path";

const POC_ENV_PATH = path.join(process.cwd(), ".env.poc.local");
const FIREBASE_API_KEY =
    process.env.FIREBASE_API_KEY || "AIzaSyAM9Pzx8rZnZwS5CcBHaz9uziqJ1kmFdC8";
const FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID || "solargarden-web-prod";
const FIREBASE_APP_ID =
    process.env.FIREBASE_APP_ID || "1:922703462491:web:2557c83ecb316a50333f7e";

type DecodedFirestoreValue =
    | string
    | boolean
    | null
    | DecodedFirestoreValue[]
    | { [key: string]: DecodedFirestoreValue };

type FirestoreDocument = {
    name: string;
    updateTime: string | null;
    fields: Record<string, DecodedFirestoreValue>;
};

type FirestoreFieldDiff = {
    key: string;
    beforeValue: DecodedFirestoreValue | undefined;
    afterValue: DecodedFirestoreValue | undefined;
};

export type FirestoreRepairNoteWriteInput = {
    projectId: string;
    reportId: string;
    repairNote: string;
};

export type FirestoreRepairNoteWriteResult = {
    docPath: string;
    before: {
        repairNote: string;
        readAt: string;
        updateTime: string | null;
    };
    after: {
        repairNote: string;
        readAt: string;
        updateTime: string | null;
    };
    firestoreReadBackOk: boolean;
    unchangedOtherFields: boolean;
    verifiedAt: string;
    changedOtherFields: FirestoreFieldDiff[];
};

function readPocEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return {} as Record<string, string>;
    }

    const parsed: Record<string, string> = {};
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        parsed[key] = value;
    }

    return parsed;
}

function getFirebaseCredentials() {
    const pocEnv = readPocEnvFile(POC_ENV_PATH);
    const email =
        pocEnv.FIREBASE_EMAIL ||
        process.env.FIREBASE_EMAIL ||
        process.env.COMPANY_EMAIL ||
        null;
    const password =
        pocEnv.FIREBASE_PASSWORD ||
        process.env.FIREBASE_PASSWORD ||
        process.env.COMPANY_PASSWORD ||
        null;

    if (!email || !password) {
        throw new Error("Missing FIREBASE_EMAIL/FIREBASE_PASSWORD.");
    }

    return { email, password };
}

async function postJson(url: string, body: unknown, extraHeaders: Record<string, string> = {}) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...extraHeaders,
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();
    let json: unknown = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        json,
        text,
    };
}

async function getJson(url: string, headers: Record<string, string> = {}) {
    const response = await fetch(url, { headers });
    const text = await response.text();
    let json: unknown = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        json,
        text,
    };
}

async function patchJson(url: string, body: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();
    let json: unknown = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        json,
        text,
    };
}

function decodeFirestoreValue(value: unknown): DecodedFirestoreValue {
    if (!value || typeof value !== "object") {
        return null;
    }

    if ("stringValue" in value && typeof value.stringValue === "string") {
        return value.stringValue;
    }
    if ("integerValue" in value && typeof value.integerValue === "string") {
        return value.integerValue;
    }
    if ("doubleValue" in value && typeof value.doubleValue === "number") {
        return String(value.doubleValue);
    }
    if ("booleanValue" in value && typeof value.booleanValue === "boolean") {
        return value.booleanValue;
    }
    if ("timestampValue" in value && typeof value.timestampValue === "string") {
        return value.timestampValue;
    }
    if ("nullValue" in value) {
        return null;
    }
    if ("mapValue" in value && value.mapValue && typeof value.mapValue === "object") {
        const fields =
            "fields" in value.mapValue &&
            value.mapValue.fields &&
            typeof value.mapValue.fields === "object" &&
            !Array.isArray(value.mapValue.fields)
                ? value.mapValue.fields
                : {};
        return Object.fromEntries(
            Object.entries(fields).map(([key, nestedValue]) => [key, decodeFirestoreValue(nestedValue)]),
        );
    }
    if ("arrayValue" in value && value.arrayValue && typeof value.arrayValue === "object") {
        const values =
            "values" in value.arrayValue && Array.isArray(value.arrayValue.values)
                ? value.arrayValue.values
                : [];
        return values.map((item) => decodeFirestoreValue(item));
    }

    return null;
}

function decodeFirestoreFields(fields: unknown): Record<string, DecodedFirestoreValue> {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
    );
}

function normalizeComparableValue(value: DecodedFirestoreValue | undefined): DecodedFirestoreValue | undefined {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeComparableValue(item) ?? null);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, normalizeComparableValue(value[key]) ?? null]),
        );
    }

    return value ?? null;
}

function diffFields(
    beforeFields: Record<string, DecodedFirestoreValue>,
    afterFields: Record<string, DecodedFirestoreValue>,
    excludedKeys: string[] = [],
) {
    const excluded = new Set(excludedKeys);
    const keys = new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)]);
    const changes: FirestoreFieldDiff[] = [];

    for (const key of [...keys].sort()) {
        if (excluded.has(key)) {
            continue;
        }

        const beforeValue = normalizeComparableValue(beforeFields[key]);
        const afterValue = normalizeComparableValue(afterFields[key]);
        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
            changes.push({
                key,
                beforeValue,
                afterValue,
            });
        }
    }

    return changes;
}

function buildDocPath(projectId: string, reportId: string) {
    return `operations/${projectId}/logs/${reportId}`;
}

function buildDocUrl(projectId: string, reportId: string) {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        FIREBASE_PROJECT_ID,
    )}/databases/(default)/documents/operations/${encodeURIComponent(projectId)}/logs/${encodeURIComponent(
        reportId,
    )}`;
}

function buildAuthHeaders(idToken: string) {
    return {
        authorization: `Bearer ${idToken}`,
        "x-firebase-gmpid": FIREBASE_APP_ID,
    };
}

async function signInWithPassword() {
    const credentials = getFirebaseCredentials();
    const response = await postJson(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
            FIREBASE_API_KEY,
        )}`,
        {
            email: credentials.email,
            password: credentials.password,
            returnSecureToken: true,
        },
    );

    const json = response.json as
        | {
            idToken?: string;
            error?: { message?: string };
        }
        | null;
    if (!response.ok || !json?.idToken) {
        throw new Error(json?.error?.message || `Firebase sign-in failed (${response.status})`);
    }

    return json.idToken;
}

async function getDocument(idToken: string, projectId: string, reportId: string) {
    const response = await getJson(buildDocUrl(projectId, reportId), buildAuthHeaders(idToken));
    const json = response.json as
        | {
            name?: string;
            updateTime?: string;
            fields?: unknown;
            error?: { message?: string };
        }
        | null;

    if (!response.ok || !json?.name) {
        throw new Error(json?.error?.message || `Failed to read Firestore log (${response.status})`);
    }

    return {
        name: json.name,
        updateTime: typeof json.updateTime === "string" ? json.updateTime : null,
        fields: decodeFirestoreFields(json.fields),
    } satisfies FirestoreDocument;
}

async function patchRepairNote(
    idToken: string,
    projectId: string,
    reportId: string,
    repairNote: string,
    currentUpdateTime: string | null,
) {
    const url = new URL(buildDocUrl(projectId, reportId));
    url.searchParams.append("updateMask.fieldPaths", "repairNote");
    if (currentUpdateTime) {
        url.searchParams.set("currentDocument.updateTime", currentUpdateTime);
    }

    const response = await patchJson(
        url.toString(),
        {
            fields: {
                repairNote: {
                    stringValue: repairNote,
                },
            },
        },
        buildAuthHeaders(idToken),
    );

    const json = response.json as
        | {
            name?: string;
            error?: { message?: string };
        }
        | null;
    if (!response.ok || !json?.name) {
        throw new Error(json?.error?.message || `Failed to update repairNote (${response.status})`);
    }
}

function validateInput(input: FirestoreRepairNoteWriteInput) {
    if (!input.projectId.trim()) {
        throw new Error("projectId is required.");
    }
    if (!input.reportId.trim()) {
        throw new Error("reportId is required.");
    }
    if (typeof input.repairNote !== "string") {
        throw new Error("repairNote must be a string.");
    }
}

export async function writeFirestoreRepairNote(
    input: FirestoreRepairNoteWriteInput,
): Promise<FirestoreRepairNoteWriteResult> {
    validateInput(input);

    const projectId = input.projectId.trim();
    const reportId = input.reportId.trim();
    const docPath = buildDocPath(projectId, reportId);
    const idToken = await signInWithPassword();

    const beforeDoc = await getDocument(idToken, projectId, reportId);
    const beforeReadAt = new Date().toISOString();
    await patchRepairNote(idToken, projectId, reportId, input.repairNote, beforeDoc.updateTime);
    const afterDoc = await getDocument(idToken, projectId, reportId);
    const afterReadAt = new Date().toISOString();

    const beforeRepairNote = typeof beforeDoc.fields.repairNote === "string" ? beforeDoc.fields.repairNote : "";
    const afterRepairNote = typeof afterDoc.fields.repairNote === "string" ? afterDoc.fields.repairNote : "";
    const changedOtherFields = diffFields(beforeDoc.fields, afterDoc.fields, ["repairNote"]);
    const firestoreReadBackOk = afterRepairNote === input.repairNote;
    const unchangedOtherFields = changedOtherFields.length === 0;
    const verifiedAt = new Date().toISOString();

    if (!firestoreReadBackOk) {
        throw new Error(`repairNote read-back mismatch for ${docPath}`);
    }
    if (!unchangedOtherFields) {
        throw new Error(
            `Unexpected Firestore field changes outside repairNote for ${docPath}: ${changedOtherFields
                .map((change) => change.key)
                .join(", ")}`,
        );
    }

    return {
        docPath,
        before: {
            repairNote: beforeRepairNote,
            readAt: beforeReadAt,
            updateTime: beforeDoc.updateTime,
        },
        after: {
            repairNote: afterRepairNote,
            readAt: afterReadAt,
            updateTime: afterDoc.updateTime,
        },
        firestoreReadBackOk,
        unchangedOtherFields,
        verifiedAt,
        changedOtherFields,
    };
}
