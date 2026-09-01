import { describe, expect, it } from "vitest";
import { CLIENTS, ENDPOINT, findClient, targetPath } from "./clients.js";

describe("client registry", () => {
    it("covers every client the docs guide lists", () => {
        expect(CLIENTS.map((client) => client.id).sort()).toEqual([
            "chatgpt",
            "claude",
            "claude-code",
            "codex",
            "cursor",
            "vscode",
            "windsurf",
            "zed",
        ]);
    });

    it("points every client at the hosted server", () => {
        for (const client of CLIENTS) {
            const text =
                client.kind === "json"
                    ? Object.values(client.entry).join(" ")
                    : client.kind === "command"
                      ? client.commands.join(" ")
                      : client.steps.join(" ");
            expect(text).toContain(ENDPOINT);
        }
    });

    it("finds a client case-insensitively", () => {
        expect(findClient("Cursor")?.id).toBe("cursor");
        expect(findClient("nope")).toBeUndefined();
    });

    it("gives every json client at least one location", () => {
        for (const client of CLIENTS) {
            if (client.kind !== "json") {
                continue;
            }
            const paths = [
                targetPath(client, "global"),
                targetPath(client, "local"),
            ].filter((path) => path !== null);
            expect(paths.length).toBeGreaterThan(0);
        }
    });

    it("keeps VS Code project-scoped and Windsurf user-scoped", () => {
        const vscode = findClient("vscode");
        const windsurf = findClient("windsurf");
        if (vscode?.kind !== "json" || windsurf?.kind !== "json") {
            throw new Error("expected json clients");
        }
        expect(vscode.globalPath).toBeNull();
        expect(vscode.localPath).not.toBeNull();
        expect(windsurf.globalPath).not.toBeNull();
        expect(windsurf.localPath).toBeNull();
    });
});
