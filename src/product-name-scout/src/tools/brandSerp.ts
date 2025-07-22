import { CallToolRequest, CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { CheckBrandSerpInputSchema } from "../schemas.js";
import { fetchHtml, sleep } from "../utils/http.js";
import { parseGoogleSerp, parseDuckDuckGoSerp } from "../utils/parsers.js";

export async function checkBrandSerp(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const input = CheckBrandSerpInputSchema.parse(request.params.arguments);
    const { name, engine, limit } = input;
    
    let url: string;
    let parseFunction: (html: string, limit: number) => any;
    
    switch (engine) {
      case "google":
        url = `https://www.google.com/search?q=${encodeURIComponent(`"${name}"`)}`;
        parseFunction = parseGoogleSerp;
        break;
      case "ddg":
        url = `https://duckduckgo.com/?q=${encodeURIComponent(`"${name}"`)}`;
        parseFunction = parseDuckDuckGoSerp;
        break;
      case "brave":
        url = `https://search.brave.com/search?q=${encodeURIComponent(`"${name}"`)}`;
        parseFunction = parseDuckDuckGoSerp; // Similar structure to DDG
        break;
      default:
        throw new Error(`Unsupported search engine: ${engine}`);
    }
    
    // Fetch and parse results
    const html = await fetchHtml(url);
    const result = parseFunction(html, limit);
    
    // Add rate limiting for politeness
    await sleep(600);
    
    const content: TextContent = {
      type: "text",
      text: JSON.stringify(result, null, 2)
    };
    
    return {
      content: [content]
    };
    
  } catch (error) {
    const content: TextContent = {
      type: "text", 
      text: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        resultCountText: "Error occurred",
        didYouMean: null,
        results: []
      }, null, 2)
    };
    
    return {
      content: [content],
      isError: true
    };
  }
}