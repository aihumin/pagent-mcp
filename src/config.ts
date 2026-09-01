import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SERVER_KEY, type JsonClient } from "./clients.js";

export type MergeOutcome =
    | { readonly status: "written"; readonly json: string }
    | { readonly status: "unchanged"; readonly json: string }
    | { readonly status: "unparsable"; readonly reason: string };

interface JsonObject {
    [key: string]: unknown;
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge the pagent entry into an existing config document.
 *
 * Never rewrites servers the customer already configured, and refuses to touch
 * a file it cannot parse rather than risk destroying it. Zed's settings.json in
 * particular is a large hand-edited file that may contain comments, which JSON
 * does not allow.
 */
export function mergeConfig(
    existing: string | null,
    client: JsonClient,
): MergeOutcome {
    let document: JsonObject = {};

    if (existing !== null && existing.trim() !== "") {
        let parsed: unknown;
        try {
            parsed = JSON.parse(existing);
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            return { status: "unparsable", reason };
        }
        if (!isObject(parsed)) {
            return {
                status: "unparsable",
                reason: "the file does not contain a JSON object",
            };
        }
        document = parsed;
    }

    const sectionValue = document[client.section];
    const section: JsonObject = isObject(sectionValue) ? sectionValue : {};

    const current = section[SERVER_KEY];
    if (isObject(current) && sameEntry(current, client.entry)) {
        return { status: "unchanged", json: render(document) };
    }

    const merged: JsonObject = {
        ...document,
        [client.section]: { ...section, [SERVER_KEY]: { ...client.entry } },
    };
    return { status: "written", json: render(merged) };
}

function sameEntry(
    current: JsonObject,
    entry: Record<string, string>,
): boolean {
    const keys = Object.keys(entry);
    if (Object.keys(current).length !== keys.length) {
        return false;
    }
    return keys.every((key) => current[key] === entry[key]);
}

function render(document: JsonObject): string {
    return `${JSON.stringify(document, null, 2)}\n`;
}

export function readIfPresent(path: string): string | null {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
}

export function writeConfig(path: string, contents: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, "utf8");
}
