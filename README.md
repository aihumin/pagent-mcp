# @pagent/mcp

Connect [pagent](https://www.pagent.ai) to your coding agent in one command.

```bash
npx @pagent/mcp init
```

This finds the MCP clients on your machine and points them at pagent's hosted
server. Nothing else to copy, no config format to choose.

## What pagent is

pagent is an AI A/B testing agent. It reads your pages, writes the hypothesis,
builds the variation as real code on your design system, runs the test on your
live site with Bayesian statistics, and learns what to try next. Your team
reviews each variation before it goes live.

With this connector your agent joins that loop: it reads results, captures the
next hypothesis, and starts the next test from the chat you already use.

## What your agent can do

With read access:

- List running and completed tests and read their Bayesian results
- Compare tests and inspect what each variation changes on the page
- Read pages, audiences, conversion goals, personas and guidelines

With write access:

- Capture a hypothesis and turn it into a test
- Start, pause, resume, queue, stop, evolve or roll back a test
- Create pages and conversion goals, manage audiences

You choose read or write, and which organisations the client may see, during
sign-in. You can revoke a connection at any time in your pagent settings.

## Usage

```bash
npx @pagent/mcp init                 # detect your clients and connect them
npx @pagent/mcp init --client cursor # connect one client
npx @pagent/mcp init --local         # write a project config, not a user one
npx @pagent/mcp init --dry-run       # show what would change, write nothing
npx @pagent/mcp print                # print the config without writing
npx @pagent/mcp list                 # list supported clients
```

## Supported clients

| Client                   | How it is configured                            |
| ------------------------ | ----------------------------------------------- |
| Claude Code              | `claude mcp add`                                |
| Codex                    | `codex mcp add`                                 |
| Cursor                   | `~/.cursor/mcp.json` or `.cursor/mcp.json`      |
| VS Code                  | `.vscode/mcp.json`                              |
| Windsurf                 | `~/.codeium/windsurf/mcp_config.json`           |
| Zed                      | `~/.config/zed/settings.json`                   |
| Claude (web and desktop) | Settings, Connectors, add a custom connector    |
| ChatGPT                  | Developer mode, Plugins, add a custom connector |

Claude and ChatGPT are configured in their own interface, so this CLI prints the
steps rather than editing anything. Run
`npx @pagent/mcp print --client chatgpt`.

Existing servers in your config are left alone. If a config file cannot be
parsed, for example because it has comments, the CLI prints the entry for you to
paste instead of rewriting the file.

## Connecting by hand

Any MCP client can use the hosted server directly:

- Endpoint: `https://app.pagent.ai/api/mcp`
- Transport: Streamable HTTP
- Authentication: OAuth 2.0, or a personal token from
  [AI client access](https://app.pagent.ai/me/settings/mcp)

## Before you connect

You need a pagent account with owner or administrator access to the
organisation, MCP enabled for it, and a website with the pagent script installed
so there are tests and visitor data to read.

## Links

- [pagent MCP server](https://www.pagent.ai/mcp)
- [Setup guide](https://www.pagent.ai/docs/guides/mcp)
- [The AI A/B testing agent](https://www.pagent.ai/ai-ab-testing-agent)

## License

MIT. pagent itself is a commercial product; this CLI only writes local
configuration files.
