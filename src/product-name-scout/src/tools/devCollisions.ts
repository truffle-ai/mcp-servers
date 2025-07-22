import { CallToolRequest, CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { CheckDevCollisionsInputSchema } from "../schemas.js";
import { fetchHtml, sleep } from "../utils/http.js";
import { parseGitHubSearch, parseNpmSearch, parsePyPISearch } from "../utils/parsers.js";

export async function checkDevCollisions(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const input = CheckDevCollisionsInputSchema.parse(request.params.arguments);
    const { name, platforms } = input;
    
    const results: Record<string, { count: number; top: Array<{name: string, url: string, description?: string}> }> = {};
    
    for (const platform of platforms) {
      try {
        let url: string;
        let parseFunction: (html: string) => { count: number; top: any[] };
        
        switch (platform) {
          case "github":
            url = `https://github.com/search?q=${encodeURIComponent(name)}&type=repositories`;
            parseFunction = parseGitHubSearch;
            break;
          case "npm":
            url = `https://www.npmjs.com/search?q=${encodeURIComponent(name)}`;
            parseFunction = parseNpmSearch;
            break;
          case "pypi":
            url = `https://pypi.org/search/?q=${encodeURIComponent(name)}`;
            parseFunction = parsePyPISearch;
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        const html = await fetchHtml(url);
        const result = parseFunction(html);
        results[platform] = result;
        
        // Rate limiting between requests
        await sleep(700);
        
      } catch (error) {
        console.warn(`Failed to check ${platform}:`, error);
        results[platform] = {
          count: 0,
          top: [],
          error: error instanceof Error ? error.message : "Unknown error"
        } as any;
      }
    }
    
    const content: TextContent = {
      type: "text",
      text: JSON.stringify(results, null, 2)
    };
    
    return {
      content: [content]
    };
    
  } catch (error) {
    const content: TextContent = {
      type: "text",
      text: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }, null, 2)
    };
    
    return {
      content: [content],
      isError: true
    };
  }
}