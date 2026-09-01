import { describe, expect, it } from "vitest";
import { CLIENTS, type JsonClient } from "./clients.js";
import { mergeConfig } from "./config.js";

function client(id: string): JsonClient {
    const found = CLIENTS.find((entry) => entry.id === id);
    if (found === undefined || found.kind !== "json") {
        throw new Error(`no json client ${id}`);
    }
    return found;
}

const cursor = client("cursor");
const vscode = client("vscode");
const zed = client("zed");

describe("mergeConfig", () => {
    it("creates the section when the file does not exist", () => {
        const result = mergeConfig(null, cursor);
        expect(result.status).toBe("written");
        expect(JSON.parse((result as { json: string }).json)).toEqual({
            mcpServers: {
                pagent: { url: "https://app.pagent.ai/api/mcp" },
            },
        });
    });

    it("treats an empty file as absent", () => {
        expect(mergeConfig("   \n", cursor).status).toBe("written");
    });

    it("keeps servers the customer already configured", () => {
        const existing = JSON.stringify({
            mcpServers: { linear: { url: "https://mcp.linear.app/mcp" } },
        });
        const result = mergeConfig(existing, cursor);
        const parsed = JSON.parse((result as { json: string }).json);
        expect(parsed.mcpServers.linear).toEqual({
            url: "https://mcp.linear.app/mcp",
        });
        expect(parsed.mcpServers.pagent).toEqual({
            url: "https://app.pagent.ai/api/mcp",
        });
    });

    it("keeps unrelated top-level settings", () => {
        const existing = JSON.stringify({
            theme: "dark",
            context_servers: { other: { url: "https://example.com" } },
        });
        const result = mergeConfig(existing, zed);
        const parsed = JSON.parse((result as { json: string }).json);
        expect(parsed.theme).toBe("dark");
        expect(parsed.context_servers.other).toBeDefined();
        expect(parsed.context_servers.pagent).toEqual({
            url: "https://app.pagent.ai/api/mcp",
        });
    });

    it("reports no change when pagent is already correct", () => {
        const existing = JSON.stringify({
            servers: {
                pagent: { type: "http", url: "https://app.pagent.ai/api/mcp" },
            },
        });
        expect(mergeConfig(existing, vscode).status).toBe("unchanged");
    });

    it("overwrites a pagent entry that points somewhere else", () => {
        const existing = JSON.stringify({
            mcpServers: { pagent: { url: "http://localhost:3000/api/mcp" } },
        });
        const result = mergeConfig(existing, cursor);
        expect(result.status).toBe("written");
        const parsed = JSON.parse((result as { json: string }).json);
        expect(parsed.mcpServers.pagent.url).toBe(
            "https://app.pagent.ai/api/mcp",
        );
    });

    it("refuses to touch a file it cannot parse", () => {
        const jsonc =
            '{\n  // Zed lets you comment settings\n  "theme": "one"\n}';
        const result = mergeConfig(jsonc, zed);
        expect(result.status).toBe("unparsable");
    });

    it("refuses a document that is not an object", () => {
        expect(mergeConfig("[1, 2]", cursor).status).toBe("unparsable");
    });

    it("replaces a section of the wrong shape rather than crashing", () => {
        const result = mergeConfig(JSON.stringify({ mcpServers: 42 }), cursor);
        expect(result.status).toBe("written");
        const parsed = JSON.parse((result as { json: string }).json);
        expect(parsed.mcpServers.pagent).toBeDefined();
    });

    it("writes the shape each client expects", () => {
        expect(
            JSON.parse((mergeConfig(null, vscode) as { json: string }).json)
                .servers.pagent,
        ).toEqual({ type: "http", url: "https://app.pagent.ai/api/mcp" });

        const windsurf = client("windsurf");
        expect(
            JSON.parse((mergeConfig(null, windsurf) as { json: string }).json)
                .mcpServers.pagent,
        ).toEqual({ serverUrl: "https://app.pagent.ai/api/mcp" });
    });

    it("ends the file with a newline", () => {
        const result = mergeConfig(null, cursor) as { json: string };
        expect(result.json.endsWith("\n")).toBe(true);
    });
});
