# Name Scout MCP Server

A comprehensive MCP server for brand name research and searchability analysis. Designed to help evaluate potential product/brand names through multiple signals including search competition, developer platform conflicts, autocomplete behavior, and overall "ownability" assessment.

## Features

- **Search Engine Analysis**: Check SERP competition and result counts across Google, DuckDuckGo, and Brave
- **Autocomplete Research**: Analyze search suggestion patterns to identify spelling and recognition issues
- **Developer Platform Conflicts**: Check for existing projects on GitHub, npm, and PyPI
- **Comprehensive Scoring**: Aggregate multiple signals into actionable brand viability scores

## Tools

### `check_brand_serp`
Analyze search engine results for exact brand name matches.

**Parameters:**
- `name` (string): The brand/product name to search for
- `engine` (optional): Search engine - "google" | "ddg" | "brave" (default: "google")
- `limit` (optional): Maximum results to return (default: 10, max: 50)

**Returns:**
```json
{
  "resultCountText": "About 3,210 results (0.32 seconds)",
  "didYouMean": "zenola labs",
  "results": [
    {"title":"...", "url":"...", "snippet":"..."},
    ...
  ]
}
```

### `get_autocomplete`
Get autocomplete suggestions from search engines.

**Parameters:**
- `name` (string): The name to get autocomplete suggestions for

**Returns:**
```json
{
  "google": ["zenola", "zenola ai"],
  "ddg": ["zenola", "zenola meaning"]
}
```

### `check_dev_collisions`
Check for existing projects on developer platforms.

**Parameters:**
- `name` (string): The name to check for collisions
- `platforms` (optional): Array of platforms - ["github", "npm", "pypi"] (default: all)

**Returns:**
```json
{
  "github": {"count": 2, "top": [{"name":"...", "url":"..."}]},
  "npm": {"count": 0, "top": []},
  "pypi": {"count": 1, "top": [{"name":"...", "url":"..."}]}
}
```

### `score_name`
Comprehensive scoring across multiple brand viability factors.

**Parameters:**
- `name` (string): The name to score
- `weights` (optional): Custom scoring weights for different factors
- `rawSignals` (optional): Pre-computed signals to skip network calls

**Returns:**
```json
{
  "score": 82,
  "breakdown": {"serp_empty": 24, "dev_collisions": 18, ...},
  "notes": ["No serious competitors", "Clean on developer platforms"],
  "signals": {...}
}
```

## Installation

### Using npm
```bash
npm install @truffle-ai/name-scout-mcp
npx truffle-ai-name-scout-mcp
```

### Using uvx
```bash
uvx @truffle-ai/name-scout-mcp
```

### From source
```bash
git clone https://github.com/truffle-ai/mcp-servers.git
cd mcp-servers/src/name-scout
npm install
npm run build
npm start
```

## Configuration with MCP Clients

### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "name-scout": {
      "command": "uvx",
      "args": ["@truffle-ai/name-scout-mcp"]
    }
  }
}
```

### Saiki
Add to your agent configuration:

```yaml
mcpServers:
  name-scout:
    type: stdio
    command: uvx
    args:
      - "@truffle-ai/name-scout-mcp"
```

## Usage Examples

### Basic SERP Analysis
```
User: Check search competition for "ZenMind"
Assistant: [Uses check_brand_serp with name="ZenMind"]
```

### Comprehensive Name Evaluation
```
User: Evaluate "CodeFlow" as a product name
Assistant: [Uses check_brand_serp, get_autocomplete, check_dev_collisions, then score_name for complete analysis]
```

### Developer Platform Check
```
User: Are there any GitHub/npm conflicts for "reactflow"?
Assistant: [Uses check_dev_collisions with name="reactflow" and platforms=["github","npm"]]
```

## Scoring Methodology

The `score_name` tool uses weighted scoring across multiple factors:

- **SERP Emptiness (3x)**: Lower competition = higher score
- **Spellability (2x)**: Easy to spell and remember names score higher
- **Autocomplete (2x)**: Clean autocomplete behavior scores higher
- **Dev Collisions (2x)**: Fewer conflicts on developer platforms = higher score
- **Domains (3x)**: Domain availability (requires domain-checker MCP)
- **Trademark (2x)**: Trademark conflict assessment
- **International (1x)**: International meaning and pronunciation

## Rate Limiting

The server implements polite rate limiting:
- 600ms delay between SERP requests
- 700ms delay between developer platform checks
- 300ms delay between autocomplete requests

## Dependencies

- `@modelcontextprotocol/sdk` - MCP framework
- `cheerio` - HTML parsing
- `undici` - HTTP requests
- `zod` - Schema validation

## License

MIT - See [LICENSE](../../LICENSE) for details.