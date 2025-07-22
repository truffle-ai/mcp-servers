import * as cheerio from "cheerio";

export function parseGoogleSerp(html: string, limit: number = 10) {
  const $ = cheerio.load(html);
  
  // Extract result count
  const resultCountText = $('#result-stats').text().trim() || 
                         $('div[role="status"]').text().trim() || 
                         "Result count not found";
  
  // Extract "Did you mean" suggestion
  const didYouMeanElement = $('a[href*="spell"]').first();
  const didYouMean = didYouMeanElement.text().trim() || null;
  
  // Extract search results
  const results: Array<{title: string, url: string, snippet: string}> = [];
  
  $('div[data-header-feature] h3, .g h3, .MjjYud h3').each((i: number, el: any) => {
    if (i >= limit) return false;
    
    const $el = $(el);
    const titleEl = $el.find('a').first();
    const title = titleEl.text().trim();
    const url = titleEl.attr('href') || '';
    
    // Find snippet in parent containers
    const snippet = $el.closest('.g, .MjjYud').find('.VwiC3b, .s, .st').first().text().trim();
    
    if (title && url) {
      results.push({ title, url, snippet });
    }
  });
  
  return {
    resultCountText,
    didYouMean,
    results
  };
}

export function parseDuckDuckGoSerp(html: string, limit: number = 10) {
  const $ = cheerio.load(html);
  
  // DDG doesn't show result counts prominently
  const resultCountText = "Result count not available for DuckDuckGo";
  
  // Extract "Did you mean" 
  const didYouMean = $('.did-you-mean a').text().trim() || null;
  
  // Extract search results
  const results: Array<{title: string, url: string, snippet: string}> = [];
  
  $('article[data-testid="result"], .result').slice(0, limit).each((i: number, el: any) => {
    const $el = $(el);
    const titleEl = $el.find('h2 a, .result__title a').first();
    const title = titleEl.text().trim();
    const url = titleEl.attr('href') || '';
    const snippet = $el.find('.result__snippet, [data-testid="result-snippet"]').text().trim();
    
    if (title && url) {
      results.push({ title, url, snippet });
    }
  });
  
  return {
    resultCountText,
    didYouMean,
    results
  };
}

export function parseGitHubSearch(html: string) {
  const $ = cheerio.load(html);
  
  // Extract count
  const countText = $('h1').text();
  const countMatch = countText.match(/(\d+(?:,\d+)*)/);
  const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;
  
  // Extract top repositories
  const top: Array<{name: string, url: string, description?: string}> = [];
  
  $('div[data-testid="results-list"] .search-title a, .repo-list-item h3 a').slice(0, 5).each((i: number, el: any) => {
    const $el = $(el);
    const name = $el.text().trim();
    const href = $el.attr('href');
    const url = href ? `https://github.com${href}` : '';
    const description = $el.closest('div').find('p, .search-title + p').text().trim();
    
    if (name && url) {
      top.push({ name, url, ...(description && { description }) });
    }
  });
  
  return { count, top };
}

export function parseNpmSearch(html: string) {
  const $ = cheerio.load(html);
  
  // Extract count from "X packages found"
  const countText = $('.--10d47bb4').first().text();
  const countMatch = countText.match(/(\d+(?:,\d+)*)/);
  const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;
  
  // Extract top packages
  const top: Array<{name: string, url: string, description?: string}> = [];
  
  $('section[data-testid="package"] h3 a, .package-details h3 a').slice(0, 5).each((i: number, el: any) => {
    const $el = $(el);
    const name = $el.text().trim();
    const href = $el.attr('href');
    const url = href ? (href.startsWith('http') ? href : `https://www.npmjs.com${href}`) : '';
    const description = $el.closest('section').find('p').first().text().trim();
    
    if (name && url) {
      top.push({ name, url, ...(description && { description }) });
    }
  });
  
  return { count, top };
}

export function parsePyPISearch(html: string) {
  const $ = cheerio.load(html);
  
  // Extract count
  const countText = $('.split-layout__left h1').text();
  const countMatch = countText.match(/(\d+(?:,\d+)*)/);
  const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;
  
  // Extract top packages  
  const top: Array<{name: string, url: string, description?: string}> = [];
  
  $('.package-snippet h3 a').slice(0, 5).each((i: number, el: any) => {
    const $el = $(el);
    const name = $el.text().trim();
    const href = $el.attr('href');
    const url = href ? (href.startsWith('http') ? href : `https://pypi.org${href}`) : '';
    const description = $el.closest('.package-snippet').find('p').first().text().trim();
    
    if (name && url) {
      top.push({ name, url, ...(description && { description }) });
    }
  });
  
  return { count, top };
}