#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodSchema } from "zod";
import { checkBrandSerp } from "./tools/brandSerp.js";
import { getAutocomplete } from "./tools/autocomplete.js";
import { checkDevCollisions } from "./tools/devCollisions.js";
import { scoreName } from "./tools/scoreName.js";
import {
  CheckBrandSerpInputSchema,
  GetAutocompleteInputSchema,
  CheckDevCollisionsInputSchema,
  ScoreNameInputSchema,
} from "./schemas.js";

// Helper function to handle enum types
function getEnumType(enumSchema: any) {
  const values = enumSchema._def.values;
  // Check first value to determine type
  return typeof values[0] === 'string'
    ? 'string'
    : typeof values[0] === 'number'
      ? 'number'
      : 'string'; // default to string
}

// Convert Zod schema to JSON Schema for MCP
function zodToJsonSchema(schema: ZodSchema<any>) {
  const schemaDescription: Record<string, any> = {
    type: 'object',
    properties: {},
    required: [],
  };

  if (schema instanceof z.ZodObject) {
    const shape = (schema as any)._def.shape();
    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as any;

      schemaDescription.properties[key] = {
        type:
          zodValue._def.typeName === 'ZodString'
            ? 'string'
            : zodValue._def.typeName === 'ZodNumber'
              ? 'number'
              : zodValue._def.typeName === 'ZodBoolean'
                ? 'boolean'
                : zodValue._def.typeName === 'ZodEnum'
                  ? getEnumType(zodValue)
                  : zodValue._def.typeName === 'ZodArray'
                    ? 'array'
                    : 'object',
      };

      // Add description if available
      if (zodValue.description) {
        schemaDescription.properties[key].description = zodValue.description;
      }

      // Add enum values
      if (zodValue._def.typeName === 'ZodEnum') {
        schemaDescription.properties[key].enum = zodValue._def.values;
      }

      // Handle array items
      if (zodValue._def.typeName === 'ZodArray') {
        const innerType = zodValue._def.type;
        if (innerType._def.typeName === 'ZodEnum') {
          schemaDescription.properties[key].items = {
            type: 'string',
            enum: innerType._def.values
          };
        }
      }

      // Check if field is required
      if (typeof zodValue.isOptional === 'function' && !zodValue.isOptional()) {
        schemaDescription.required.push(key);
      }
    }
  }

  return schemaDescription;
}

class ProductNameScoutServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "product-name-scout-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "check_brand_serp",
          description: "Check search engine results for a brand name to assess competition and searchability",
          inputSchema: zodToJsonSchema(CheckBrandSerpInputSchema)
        },
        {
          name: "get_autocomplete",
          description: "Get autocomplete suggestions from search engines to assess name recognition and spelling",
          inputSchema: zodToJsonSchema(GetAutocompleteInputSchema)
        },
        {
          name: "check_dev_collisions",
          description: "Check for existing projects on developer platforms (GitHub, npm, PyPI)",
          inputSchema: zodToJsonSchema(CheckDevCollisionsInputSchema)
        },
        {
          name: "score_name",
          description: "Aggregate scoring of a name across multiple factors for brand viability assessment",
          inputSchema: zodToJsonSchema(ScoreNameInputSchema)
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "check_brand_serp":
          return await checkBrandSerp(request);
        
        case "get_autocomplete":
          return await getAutocomplete(request);
        
        case "check_dev_collisions":
          return await checkDevCollisions(request);
        
        case "score_name":
          return await scoreName(request);
        
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Product Name Scout MCP Server running on stdio");
  }
}

const server = new ProductNameScoutServer();
server.run().catch(console.error);