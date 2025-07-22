import { z } from "zod";

export const CheckBrandSerpInputSchema = z.object({
  name: z.string().min(1).describe("The brand/product name to search for"),
  engine: z.enum(["google", "ddg", "brave"]).optional().default("google").describe("Search engine to use"),
  limit: z.number().int().positive().max(50).optional().default(10).describe("Maximum number of results to return")
});

export const GetAutocompleteInputSchema = z.object({
  name: z.string().min(1).describe("The name to get autocomplete suggestions for")
});

export const CheckDevCollisionsInputSchema = z.object({
  name: z.string().min(1).describe("The name to check for developer platform collisions"),
  platforms: z.array(z.enum(["github", "npm", "pypi"])).optional().default(["github", "npm", "pypi"]).describe("Platforms to check")
});

export const ScoreNameInputSchema = z.object({
  name: z.string().min(1).describe("The name to score"),
  weights: z.object({
    serp_empty: z.number().optional().default(3),
    spellability: z.number().optional().default(2), 
    autocomplete: z.number().optional().default(2),
    dev_collisions: z.number().optional().default(2),
    domains: z.number().optional().default(3),
    trademark: z.number().optional().default(2),
    intl_meaning: z.number().optional().default(1)
  }).optional().describe("Scoring weights for different factors"),
  rawSignals: z.any().optional().describe("Optional pre-computed signals to skip network calls")
});

export type CheckBrandSerpInput = z.infer<typeof CheckBrandSerpInputSchema>;
export type GetAutocompleteInput = z.infer<typeof GetAutocompleteInputSchema>;
export type CheckDevCollisionsInput = z.infer<typeof CheckDevCollisionsInputSchema>;
export type ScoreNameInput = z.infer<typeof ScoreNameInputSchema>;