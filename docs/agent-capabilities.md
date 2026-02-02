# Agent Capabilities

| **Package** | `agent-spawn` | `src/providers` | `src/providers` | `src/providers` | `agent-mcp-config` | `agent-skill-config` |
|-------|-----------|-----------|----------|------|-----|-------|
| **Agent** | **Spawn** | **Configure** | **Isolated** | **Wrap** | **MCP** | **Skill** |
| Claude Code | Yes | Yes | Yes | Yes | Yes | Yes |
| Codex | Yes | Yes | Yes | Yes | Yes | Yes |
| OpenCode | Yes | Yes | Yes | Yes | Yes | Yes |
| Kimi | Yes | Yes | Yes | No | Yes | No |
| Claude Desktop | No | File-only | No | No | Yes | No |
| Cursor | [Planned](cursor-agent-research.md) | No | [Planned](cursor-agent-research.md) | [Planned](cursor-agent-research.md) | [Planned](cursor-agent-research.md) | [Planned](cursor-agent-research.md) |

## Capability Definitions

- **Spawn**: Spawn agent execution with real-time ACP streaming support
- **Configure**: Ability to configure agent to route through Poe API
- **Isolated**: Isolated environment execution support
- **Wrap**: Command wrapping via `poe-code wrap`
- **MCP**: Model Context Protocol server configuration
- **Skill**: Skill configuration support
