import { homedir } from "node:os";
import { join } from "node:path";

/** The hosted pagent MCP server. Streamable HTTP, OAuth 2.0. */
export const ENDPOINT = "https://app.pagent.ai/api/mcp";

/** The key pagent is written under in every client config. */
export const SERVER_KEY = "pagent";

/**
 * A client whose MCP servers live in a JSON file we can edit.
 * `section` is the top-level key holding the server map, because clients
 * disagree: Cursor and Windsurf use `mcpServers`, VS Code uses `servers`,
 * Zed uses `context_servers`.
 */
export interface JsonClient {
    readonly kind: "json";
    readonly id: string;
    readonly label: string;
    readonly section: string;
    readonly entry: Record<string, string>;
    /** Absolute path for a user-wide install, or null when the client has none. */
    readonly globalPath: string | null;
    /** Path relative to the working directory for a per-project install. */
    readonly localPath: string | null;
    /** Extra note printed after a successful write. */
    readonly after: string;
}

/** A client configured by running its own CLI. */
export interface CommandClient {
    readonly kind: "command";
    readonly id: string;
    readonly label: string;
    /** Binary that must be on PATH for this client to count as installed. */
    readonly bin: string;
    readonly commands: readonly string[];
    readonly after: string;
}

/** A client that can only be configured in its own interface. */
export interface ManualClient {
    readonly kind: "manual";
    readonly id: string;
    readonly label: string;
    readonly steps: readonly string[];
}

export type Client = JsonClient | CommandClient | ManualClient;

const home = homedir();

export const CLIENTS: readonly Client[] = [
    {
        kind: "command",
        id: "claude-code",
        label: "Claude Code",
        bin: "claude",
        commands: [`claude mcp add --transport http ${SERVER_KEY} ${ENDPOINT}`],
        after: "Start Claude Code, run /mcp, and follow the browser sign-in.",
    },
    {
        kind: "command",
        id: "codex",
        label: "Codex",
        bin: "codex",
        commands: [
            `codex mcp add ${SERVER_KEY} --url ${ENDPOINT}`,
            `codex mcp login ${SERVER_KEY}`,
        ],
        after: "Complete the pagent approval flow in your browser.",
    },
    {
        kind: "json",
        id: "cursor",
        label: "Cursor",
        section: "mcpServers",
        entry: { url: ENDPOINT },
        globalPath: join(home, ".cursor", "mcp.json"),
        localPath: join(".cursor", "mcp.json"),
        after: "Open Cursor's MCP settings and authenticate pagent.",
    },
    {
        kind: "json",
        id: "vscode",
        label: "VS Code",
        section: "servers",
        entry: { type: "http", url: ENDPOINT },
        globalPath: null,
        localPath: join(".vscode", "mcp.json"),
        after: "Run 'MCP: List Servers', start pagent, and complete OAuth.",
    },
    {
        kind: "json",
        id: "windsurf",
        label: "Windsurf",
        section: "mcpServers",
        entry: { serverUrl: ENDPOINT },
        globalPath: join(home, ".codeium", "windsurf", "mcp_config.json"),
        localPath: null,
        after: "Refresh the MCP server list and complete OAuth.",
    },
    {
        kind: "json",
        id: "zed",
        label: "Zed",
        section: "context_servers",
        entry: { url: ENDPOINT },
        globalPath: join(home, ".config", "zed", "settings.json"),
        localPath: null,
        after: "Zed offers the OAuth flow when it connects.",
    },
    {
        kind: "manual",
        id: "claude",
        label: "Claude (web and desktop)",
        steps: [
            "Open Settings, then Connectors.",
            "Choose 'Add custom connector', name it pagent, and enter:",
            `  ${ENDPOINT}`,
            "Sign in to pagent, choose organisations and permissions, approve.",
        ],
    },
    {
        kind: "manual",
        id: "chatgpt",
        label: "ChatGPT",
        steps: [
            "Open Settings, Security and login, and switch on Developer mode.",
            "Open Plugins, select +, name the plugin pagent, keep OAuth, enter:",
            `  ${ENDPOINT}`,
            "Confirm the risk notice, select Create, then 'Sign in with pagent'.",
            "Use it via Plugins, pagent, 'Try in chat', or type /pagent.",
        ],
    },
];

export function findClient(id: string): Client | undefined {
    return CLIENTS.find((client) => client.id === id.toLowerCase());
}

/** Config file this client would be written to, honouring the scope flag. */
export function targetPath(
    client: JsonClient,
    scope: "global" | "local",
): string | null {
    return scope === "global" ? client.globalPath : client.localPath;
}
