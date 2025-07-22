# Truffle Domain Checker MCP Server

A Model Context Protocol (MCP) server that provides domain availability checking capabilities. Perfect for product name research and brand validation.

## Features

- **Single Domain Check**: Check availability of a specific domain
- **Batch Domain Check**: Check multiple domains simultaneously  
- **Domain Variations**: Check a base name across multiple TLDs
- **Dual Verification**: Uses both WHOIS lookups and DNS resolution
- **Async Operations**: Non-blocking concurrent domain checks

## Installation

### Using uvx (recommended)

```bash
uvx --from git+https://github.com/truffle-ai/mcp-servers --subdirectory src/domain-checker truffle-domain-checker-mcp
```

### Using uv

```bash
uv add git+https://github.com/truffle-ai/mcp-servers --subdirectory src/domain-checker
```

### From source

```bash
git clone https://github.com/truffle-ai/mcp-servers.git
cd mcp-servers/src/domain-checker
uv sync
uv run truffle-domain-checker-mcp
```

## Usage

The server provides three main tools:

### check_domain(domain: str)
Check if a single domain is available for registration.

### check_multiple_domains(domains: List[str])
Check availability for multiple domains at once. Great for comparing product name options.

### check_domain_variations(base_name: str, extensions: List[str] = None)
Check a base name across multiple TLD extensions (.com, .net, .org, .io, .app, .dev, .tech by default).

## Domain Status Indicators

- ✅ **LIKELY AVAILABLE**: Domain appears to be unregistered
- ❌ **NOT AVAILABLE**: Domain is registered and in use
- ❓ **UNCLEAR**: Mixed signals, manual verification recommended

## Configuration with MCP Clients

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "domain-checker": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/truffle-ai/mcp-servers",
        "--subdirectory",
        "src/domain-checker", 
        "truffle-domain-checker-mcp"
      ],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Saiki

Add to your Saiki configuration:

```yaml
mcp_servers:
  - name: domain-checker
    command: uvx
    args:
      - --from
      - git+https://github.com/truffle-ai/mcp-servers
      - --subdirectory
      - src/domain-checker
      - truffle-domain-checker-mcp
    env:
      MCP_TRANSPORT: stdio
```

## Examples

### Single Domain Check
```
User: Is myawesomeapp.com available?
Assistant: [Uses check_domain("myawesomeapp.com")]
```

### Multiple Domain Check  
```
User: Check availability for myapp.com, myapp.io, and myapp.dev
Assistant: [Uses check_multiple_domains(["myapp.com", "myapp.io", "myapp.dev"])]
```

### Domain Variations
```
User: Check all major extensions for "brandname"
Assistant: [Uses check_domain_variations("brandname")]
```

## Dependencies

- `fastmcp>=0.1.0` - FastMCP framework
- `python-whois>=0.8.0` - WHOIS lookups
- `dnspython>=2.4.0` - DNS resolution
- `uvicorn>=0.23.0` - HTTP server support

## License

MIT - See [LICENSE](../../LICENSE) for details.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.