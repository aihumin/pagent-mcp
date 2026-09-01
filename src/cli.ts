#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import {
    CLIENTS,
    ENDPOINT,
    findClient,
    targetPath,
    type Client,
    type CommandClient,
    type JsonClient,
    type ManualClient,
} from "./clients.js";
import { mergeConfig, readIfPresent, writeConfig } from "./config.js";

const VERSION = "0.1.0";

interface Options {
    readonly command: string;
    readonly client: string | null;
    readonly scope: "global" | "local";
    readonly dryRun: boolean;
    readonly yes: boolean;
}

function parseArgs(argv: readonly string[]): Options {
    let command = "init";
    let client: string | null = null;
    let scope: "global" | "local" = "global";
    let dryRun = false;
    let yes = false;

    const rest = [...argv];
    if (rest.length > 0 && !rest[0]!.startsWith("-")) {
        command = rest.shift()!;
    }

    while (rest.length > 0) {
        const arg = rest.shift()!;
        if (arg === "--client" || arg === "-c") {
            client = rest.shift() ?? null;
        } else if (arg.startsWith("--client=")) {
            client = arg.slice("--client=".length);
        } else if (arg === "--local") {
            scope = "local";
        } else if (arg === "--global") {
            scope = "global";
        } else if (arg === "--dry-run" || arg === "-n") {
            dryRun = true;
        } else if (arg === "--yes" || arg === "-y") {
            yes = true;
        } else if (arg === "--help" || arg === "-h") {
            command = "help";
        } else if (arg === "--version" || arg === "-v") {
            command = "version";
        } else {
            fail(`Unknown option ${arg}. Run 'pagent-mcp --help'.`);
        }
    }

    return { command, client, scope, dryRun, yes };
}

function fail(message: string): never {
    process.stderr.write(`${message}\n`);
    process.exit(1);
}

function onPath(bin: string): boolean {
    const probe = spawnSync(process.platform === "win32" ? "where" : "which", [
        bin,
    ]);
    return probe.status === 0;
}

/** A client counts as present when its binary or its config directory exists. */
function isInstalled(client: Client, scope: "global" | "local"): boolean {
    if (client.kind === "command") {
        return onPath(client.bin);
    }
    if (client.kind === "manual") {
        return false;
    }
    const path = targetPath(client, scope);
    if (path === null) {
        return false;
    }
    return existsSync(path) || existsSync(dirname(path));
}

function help(): void {
    const lines = [
        "pagent MCP setup",
        "",
        "  npx @pagent/mcp init              detect your clients and connect them",
        "  npx @pagent/mcp init -c cursor    connect one client",
        "  npx @pagent/mcp print             print the config without writing",
        "  npx @pagent/mcp list              list supported clients",
        "",
        "Options",
        "  -c, --client <id>   claude, chatgpt, claude-code, codex, cursor,",
        "                      vscode, windsurf, zed",
        "      --local         write a project config instead of a user config",
        "  -n, --dry-run       show what would change, write nothing",
        "  -y, --yes           run client commands without asking",
        "",
        `Server: ${ENDPOINT}`,
        "Docs:   https://www.pagent.ai/mcp",
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
}

function list(): void {
    process.stdout.write("Supported clients\n\n");
    for (const client of CLIENTS) {
        const how =
            client.kind === "command"
                ? "runs its CLI"
                : client.kind === "json"
                  ? "writes a config file"
                  : "manual steps";
        process.stdout.write(
            `  ${client.id.padEnd(12)} ${client.label} (${how})\n`,
        );
    }
}

function printManual(client: ManualClient): void {
    process.stdout.write(`\n${client.label}\n`);
    for (const step of client.steps) {
        process.stdout.write(`  ${step}\n`);
    }
}

function printCommands(client: CommandClient): void {
    process.stdout.write(`\n${client.label}\n`);
    for (const command of client.commands) {
        process.stdout.write(`  ${command}\n`);
    }
}

function printJson(client: JsonClient, scope: "global" | "local"): void {
    const path = targetPath(client, scope);
    const merged = mergeConfig(
        path === null ? null : readIfPresent(path),
        client,
    );
    process.stdout.write(
        `\n${client.label}${path === null ? "" : ` (${path})`}\n`,
    );
    if (merged.status === "unparsable") {
        process.stdout.write(
            `  Existing file could not be parsed: ${merged.reason}\n`,
        );
        process.stdout.write("  Add this by hand:\n");
        process.stdout.write(
            `${JSON.stringify({ [client.section]: { pagent: client.entry } }, null, 2)}\n`,
        );
        return;
    }
    process.stdout.write(merged.json);
}

function connectJson(
    client: JsonClient,
    scope: "global" | "local",
    dryRun: boolean,
): boolean {
    const path = targetPath(client, scope);
    if (path === null) {
        const other = scope === "global" ? "--local" : "--global";
        process.stdout.write(
            `${client.label}: no ${scope} config location, try ${other}\n`,
        );
        return false;
    }

    const merged = mergeConfig(readIfPresent(path), client);
    if (merged.status === "unparsable") {
        process.stdout.write(
            `${client.label}: left ${path} untouched, it could not be parsed (${merged.reason})\n`,
        );
        process.stdout.write("  Add this entry by hand:\n");
        process.stdout.write(
            `${JSON.stringify({ [client.section]: { pagent: client.entry } }, null, 2)}\n`,
        );
        return false;
    }
    if (merged.status === "unchanged") {
        process.stdout.write(`${client.label}: already connected (${path})\n`);
        return true;
    }
    if (dryRun) {
        process.stdout.write(`${client.label}: would write ${path}\n`);
        return true;
    }

    writeConfig(path, merged.json);
    process.stdout.write(`${client.label}: wrote ${path}\n`);
    process.stdout.write(`  ${client.after}\n`);
    return true;
}

function connectCommand(
    client: CommandClient,
    dryRun: boolean,
    yes: boolean,
): boolean {
    if (dryRun || !yes) {
        process.stdout.write(`${client.label}: run\n`);
        for (const command of client.commands) {
            process.stdout.write(`  ${command}\n`);
        }
        if (!dryRun) {
            process.stdout.write(
                "  Re-run with --yes to let this CLI run it.\n",
            );
        }
        return true;
    }

    for (const command of client.commands) {
        const [bin, ...args] = command.split(" ");
        try {
            execFileSync(bin!, args, { stdio: "inherit" });
        } catch {
            process.stdout.write(`${client.label}: '${command}' failed\n`);
            return false;
        }
    }
    process.stdout.write(`${client.label}: connected\n`);
    process.stdout.write(`  ${client.after}\n`);
    return true;
}

function connect(client: Client, options: Options): boolean {
    if (client.kind === "manual") {
        printManual(client);
        return true;
    }
    if (client.kind === "command") {
        return connectCommand(client, options.dryRun, options.yes);
    }
    return connectJson(client, options.scope, options.dryRun);
}

function init(options: Options): void {
    if (options.client !== null) {
        const client = findClient(options.client);
        if (client === undefined) {
            fail(
                `Unknown client '${options.client}'. Run 'pagent-mcp list' to see the supported ones.`,
            );
        }
        connect(client, options);
        return;
    }

    const detected = CLIENTS.filter((client) =>
        isInstalled(client, options.scope),
    );
    if (detected.length === 0) {
        process.stdout.write(
            "No MCP client detected on this machine. Pick one explicitly:\n\n",
        );
        list();
        return;
    }

    process.stdout.write(
        `Detected ${detected.length} client${detected.length === 1 ? "" : "s"}.\n\n`,
    );
    for (const client of detected) {
        connect(client, options);
    }

    const manual = CLIENTS.filter((client) => client.kind === "manual");
    if (manual.length > 0) {
        process.stdout.write(
            "\nClaude and ChatGPT are configured in their own interface:\n",
        );
        process.stdout.write("  npx @pagent/mcp print --client claude\n");
        process.stdout.write("  npx @pagent/mcp print --client chatgpt\n");
    }
}

function print(options: Options): void {
    const clients =
        options.client === null
            ? CLIENTS
            : [findClient(options.client)].filter(
                  (client): client is Client => client !== undefined,
              );
    if (clients.length === 0) {
        fail(`Unknown client '${options.client}'.`);
    }
    for (const client of clients) {
        if (client.kind === "manual") {
            printManual(client);
        } else if (client.kind === "command") {
            printCommands(client);
        } else {
            printJson(client, options.scope);
        }
    }
}

export function run(argv: readonly string[]): void {
    const options = parseArgs(argv);
    switch (options.command) {
        case "init":
            init(options);
            return;
        case "print":
            print(options);
            return;
        case "list":
            list();
            return;
        case "help":
            help();
            return;
        case "version":
            process.stdout.write(`${VERSION}\n`);
            return;
        default:
            fail(
                `Unknown command '${options.command}'. Run 'pagent-mcp --help'.`,
            );
    }
}

run(process.argv.slice(2));
