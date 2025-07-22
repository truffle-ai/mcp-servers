import { CallToolRequest, CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ScoreNameInputSchema } from "../schemas.js";
import { checkBrandSerp } from "./brandSerp.js";
import { getAutocomplete } from "./autocomplete.js";
import { checkDevCollisions } from "./devCollisions.js";

interface ScoringWeights {
  serp_empty: number;
  spellability: number;
  autocomplete: number;
  dev_collisions: number;
  domains: number;
  trademark: number;
  intl_meaning: number;
}

interface ScoreBreakdown {
  serp_empty: number;
  spellability: number;
  autocomplete: number;
  dev_collisions: number;
  domains: number;
  trademark: number;
  intl_meaning: number;
}

export async function scoreName(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const input = ScoreNameInputSchema.parse(request.params.arguments);
    const { name, weights = {}, rawSignals } = input;
    
    const finalWeights: ScoringWeights = {
      serp_empty: 3,
      spellability: 2,
      autocomplete: 2,
      dev_collisions: 2,
      domains: 3,
      trademark: 2,
      intl_meaning: 1,
      ...weights
    };
    
    let signals = rawSignals;
    
    // Gather signals if not provided
    if (!signals) {
      signals = {} as any;
      
      // Get SERP data
      try {
        const serpResult = await checkBrandSerp({
          method: "tools/call",
          params: {
            name: "check_brand_serp",
            arguments: { name, engine: "google", limit: 10 }
          }
        } as CallToolRequest);
        
        if (serpResult.content[0]?.text && typeof serpResult.content[0].text === 'string') {
          signals.serp = JSON.parse(serpResult.content[0].text);
        }
      } catch (error) {
        console.warn("Failed to get SERP data:", error);
      }
      
      // Get autocomplete data
      try {
        const autocompleteResult = await getAutocomplete({
          method: "tools/call",
          params: {
            name: "get_autocomplete",
            arguments: { name }
          }
        } as CallToolRequest);
        
        if (autocompleteResult.content[0]?.text && typeof autocompleteResult.content[0].text === 'string') {
          signals.autocomplete = JSON.parse(autocompleteResult.content[0].text);
        }
      } catch (error) {
        console.warn("Failed to get autocomplete data:", error);
      }
      
      // Get dev collisions data
      try {
        const devCollisionsResult = await checkDevCollisions({
          method: "tools/call",
          params: {
            name: "check_dev_collisions",
            arguments: { name, platforms: ["github", "npm", "pypi"] }
          }
        } as CallToolRequest);
        
        if (devCollisionsResult.content[0]?.text && typeof devCollisionsResult.content[0].text === 'string') {
          signals.devCollisions = JSON.parse(devCollisionsResult.content[0].text);
        }
      } catch (error) {
        console.warn("Failed to get dev collisions data:", error);
      }
    }
    
    // Calculate scores
    const breakdown: ScoreBreakdown = {
      serp_empty: calculateSerpScore(signals.serp) * finalWeights.serp_empty,
      spellability: calculateSpellabilityScore(name) * finalWeights.spellability,
      autocomplete: calculateAutocompleteScore(signals.autocomplete, name) * finalWeights.autocomplete,
      dev_collisions: calculateDevCollisionsScore(signals.devCollisions) * finalWeights.dev_collisions,
      domains: 0, // Would need domain checker data - placeholder
      trademark: 0, // Would need trademark data - placeholder
      intl_meaning: calculateIntlMeaningScore(name) * finalWeights.intl_meaning
    };
    
    const totalPossible = Object.values(finalWeights).reduce((sum, weight) => sum + weight * 10, 0);
    const actualScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const finalScore = Math.round((actualScore / totalPossible) * 100);
    
    // Generate notes
    const notes = generateNotes(signals, breakdown, finalWeights);
    
    const result = {
      score: finalScore,
      breakdown,
      notes,
      signals
    };
    
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
        score: 0,
        breakdown: {},
        notes: [],
        signals: {}
      }, null, 2)
    };
    
    return {
      content: [content],
      isError: true
    };
  }
}

function calculateSerpScore(serpData?: any): number {
  if (!serpData || serpData.error) return 5; // Middle score if no data
  
  const resultCount = extractResultCount(serpData.resultCountText);
  const hasDidYouMean = !!serpData.didYouMean;
  
  let score = 10;
  
  // Fewer results = better for brand availability
  if (resultCount > 1000000) score -= 5;
  else if (resultCount > 100000) score -= 3;
  else if (resultCount > 10000) score -= 1;
  else if (resultCount < 100) score = 10;
  
  // Did you mean suggests spelling issues
  if (hasDidYouMean) score -= 2;
  
  return Math.max(0, Math.min(10, score));
}

function calculateSpellabilityScore(name: string): number {
  let score = 10;
  
  // Length penalty
  if (name.length > 12) score -= 2;
  if (name.length > 15) score -= 2;
  
  // Complex spelling patterns
  const hasNumbers = /\d/.test(name);
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(name);
  const hasConsecutiveConsonants = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{3,}/.test(name);
  
  if (hasNumbers) score -= 1;
  if (hasSpecialChars) score -= 2;
  if (hasConsecutiveConsonants) score -= 1;
  
  return Math.max(0, Math.min(10, score));
}

function calculateAutocompleteScore(autocompleteData?: any, name?: string): number {
  if (!autocompleteData || autocompleteData.error) return 5;
  
  const googleSuggestions = autocompleteData.google || [];
  const ddgSuggestions = autocompleteData.ddg || [];
  
  let score = 10;
  
  // If the exact name appears in autocomplete, it means it's being searched
  const exactMatch = [...googleSuggestions, ...ddgSuggestions].some(
    (suggestion: string) => suggestion.toLowerCase() === name?.toLowerCase()
  );
  
  if (exactMatch) score -= 3; // Mixed signal - could be good or bad
  
  // Too many suggestions might indicate confusion
  const totalSuggestions = googleSuggestions.length + ddgSuggestions.length;
  if (totalSuggestions > 15) score -= 2;
  
  return Math.max(0, Math.min(10, score));
}

function calculateDevCollisionsScore(devCollisionsData?: any): number {
  if (!devCollisionsData || devCollisionsData.error) return 5;
  
  let score = 10;
  
  // Exact matches are problematic
  const githubCount = devCollisionsData.github?.count || 0;
  const npmCount = devCollisionsData.npm?.count || 0;
  const pypiCount = devCollisionsData.pypi?.count || 0;
  
  if (githubCount > 0) score -= 2;
  if (npmCount > 0) score -= 3; // npm names are more critical
  if (pypiCount > 0) score -= 2;
  
  // Popular exact matches are worse
  if (githubCount > 10) score -= 2;
  if (npmCount > 5) score -= 2;
  if (pypiCount > 5) score -= 2;
  
  return Math.max(0, Math.min(10, score));
}

function calculateIntlMeaningScore(name: string): number {
  // Simple heuristic - could be enhanced with actual translation APIs
  let score = 8; // Default good score
  
  // Common problematic patterns
  const looksGerman = /[äöüß]/i.test(name);
  const looksSpanish = /[ñáéíóú]/i.test(name);
  const hasAccents = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(name);
  
  if (looksGerman || looksSpanish || hasAccents) {
    score += 1; // Might be good for international appeal
  }
  
  return Math.max(0, Math.min(10, score));
}

function extractResultCount(resultCountText: string): number {
  if (!resultCountText) return 0;
  
  const match = resultCountText.match(/(\d{1,3}(?:,\d{3})*)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''));
  }
  
  return 0;
}

function generateNotes(signals: any, breakdown: ScoreBreakdown, weights: ScoringWeights): string[] {
  const notes: string[] = [];
  
  if (breakdown.serp_empty > weights.serp_empty * 7) {
    notes.push("Search results show low competition");
  } else if (breakdown.serp_empty < weights.serp_empty * 3) {
    notes.push("High search competition detected");
  }
  
  if (breakdown.spellability > weights.spellability * 8) {
    notes.push("Name is easily spellable");
  } else if (breakdown.spellability < weights.spellability * 5) {
    notes.push("May be difficult to spell");
  }
  
  if (breakdown.dev_collisions < weights.dev_collisions * 3) {
    notes.push("Significant developer platform conflicts");
  } else if (breakdown.dev_collisions > weights.dev_collisions * 7) {
    notes.push("Clean on developer platforms");
  }
  
  if (signals.autocomplete?.google?.length > 0 || signals.autocomplete?.ddg?.length > 0) {
    notes.push("Has autocomplete suggestions");
  } else {
    notes.push("No autocomplete conflicts");
  }
  
  return notes;
}