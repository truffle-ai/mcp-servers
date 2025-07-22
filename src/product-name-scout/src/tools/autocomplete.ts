import { CallToolRequest, CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { GetAutocompleteInputSchema } from "../schemas.js";
import { fetchJson, sleep } from "../utils/http.js";

export async function getAutocomplete(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const input = GetAutocompleteInputSchema.parse(request.params.arguments);
    const { name } = input;
    
    const results: { google: string[]; ddg: string[] } = {
      google: [],
      ddg: []
    };
    
    // Google Suggest API
    try {
      const googleUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(name)}`;
      const googleResponse = await fetchJson(googleUrl);
      
      if (Array.isArray(googleResponse) && googleResponse.length > 1 && Array.isArray(googleResponse[1])) {
        results.google = googleResponse[1].slice(0, 10); // Limit to top 10
      }
    } catch (error) {
      console.warn("Google autocomplete failed:", error);
    }
    
    // Rate limiting between requests
    await sleep(300);
    
    // DuckDuckGo Autocomplete API
    try {
      const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(name)}`;
      const ddgResponse = await fetchJson(ddgUrl);
      
      if (Array.isArray(ddgResponse)) {
        results.ddg = ddgResponse
          .map((item: any) => item.phrase || item)
          .filter((phrase: any) => typeof phrase === 'string')
          .slice(0, 10); // Limit to top 10
      }
    } catch (error) {
      console.warn("DuckDuckGo autocomplete failed:", error);
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
        error: error instanceof Error ? error.message : "Unknown error",
        google: [],
        ddg: []
      }, null, 2)
    };
    
    return {
      content: [content],
      isError: true
    };
  }
}