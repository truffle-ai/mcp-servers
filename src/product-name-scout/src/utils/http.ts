import { request } from "undici";

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

export async function fetchHtml(url: string, options: { headers?: Record<string, string> } = {}): Promise<string> {
  try {
    const { body } = await request(url, {
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers
      }
    });
    
    return await body.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error}`);
  }
}

export async function fetchJson(url: string, options: { headers?: Record<string, string> } = {}): Promise<any> {
  try {
    const { body } = await request(url, {
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers
      }
    });
    
    return await body.json();
  } catch (error) {
    throw new Error(`Failed to fetch JSON from ${url}: ${error}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}