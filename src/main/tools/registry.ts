/**
 * Tool Registry
 *
 * Central registry for managing tool definitions and executors.
 * Provides tool registration, lookup, and validation capabilities.
 *
 * Part of Phase 03: Universal Tool Calling
 */

import type {
  Tool,
  ToolCall,
  ToolExecutor,
  ToolValidationResult,
  ParameterValidationError,
  RegisteredTool,
  JsonSchemaProperty,
} from './types';

// ============================================================================
// Section 1.2: Tool Registry Class
// ============================================================================

/**
 * Tool Registry for managing tool definitions and executors.
 * Provides a centralized store for all available tools.
 */
export class ToolRegistry {
  /** Map of tool name to registered tool */
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * Register a tool with its executor.
   * @param tool - Tool definition
   * @param executor - Function to execute the tool
   * @param source - Source of the registration (e.g., 'built-in', 'mcp:server-name')
   * @throws Error if a tool with the same name is already registered
   */
  register(tool: Tool, executor: ToolExecutor, source = 'built-in'): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, {
      tool,
      executor,
      registeredAt: new Date(),
      source,
    });
  }

  /**
   * Get a tool by name.
   * @param name - Name of the tool to retrieve
   * @returns The tool definition or undefined if not found
   */
  get(name: string): Tool | undefined {
    const registered = this.tools.get(name);
    return registered?.tool;
  }

  /**
   * Get a registered tool (includes executor).
   * @param name - Name of the tool to retrieve
   * @returns The registered tool or undefined if not found
   */
  getRegistered(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools.
   * @returns Array of all tool definitions
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values()).map((r) => r.tool);
  }

  /**
   * Get all registered tools with their executors.
   * @returns Array of all registered tools
   */
  getAllRegistered(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Remove a tool from the registry.
   * @param name - Name of the tool to remove
   * @returns true if the tool was removed, false if it wasn't found
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Check if a tool is registered.
   * @param name - Name of the tool to check
   * @returns true if the tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Clear all registered tools.
   * Useful for testing or resetting state.
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get the number of registered tools.
   * @returns Count of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get tools by category.
   * @param category - Category to filter by
   * @returns Array of tools in the specified category
   */
  getByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter((r) => r.tool.category === category)
      .map((r) => r.tool);
  }

  /**
   * Get tools by group.
   * @param group - Group to filter by
   * @returns Array of tools in the specified group
   */
  getByGroup(group: string): Tool[] {
    return Array.from(this.tools.values())
      .filter((r) => r.tool.groups?.includes(group))
      .map((r) => r.tool);
  }

  /**
   * Get tools by source.
   * @param source - Source to filter by (e.g., 'built-in', 'mcp:server-name')
   * @returns Array of registered tools from the specified source
   */
  getBySource(source: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter((r) => r.source === source);
  }
}

// ============================================================================
// Section 1.3: Tool Validation
// ============================================================================

/**
 * Validate a tool call against a tool definition.
 * Checks that all required parameters are present and types match.
 *
 * @param call - The tool call to validate
 * @param tool - The tool definition to validate against
 * @returns Validation result with any errors
 */
export function validateToolCall(call: ToolCall, tool: Tool): ToolValidationResult {
  const errors: ParameterValidationError[] = [];
  const warnings: string[] = [];
  const validatedArgs: Record<string, unknown> = {};

  const { properties, required = [] } = tool.parameters;

  // Check for required parameters
  for (const paramName of required) {
    if (!(paramName in call.arguments)) {
      errors.push({
        parameter: paramName,
        message: `Required parameter '${paramName}' is missing`,
        expected: 'value',
        actual: undefined,
      });
    }
  }

  // Validate each provided argument
  for (const [argName, argValue] of Object.entries(call.arguments)) {
    const schema = properties[argName];

    // Check for unknown parameters
    if (!schema) {
      if (tool.parameters.additionalProperties === false) {
        errors.push({
          parameter: argName,
          message: `Unknown parameter '${argName}'`,
          expected: 'one of: ' + Object.keys(properties).join(', '),
          actual: argName,
        });
      } else {
        // Allow additional properties but warn
        warnings.push(`Unknown parameter '${argName}' passed to tool '${tool.name}'`);
        validatedArgs[argName] = argValue;
      }
      continue;
    }

    // Validate parameter type
    const typeError = validateType(argName, argValue, schema);
    if (typeError) {
      errors.push(typeError);
    } else {
      validatedArgs[argName] = argValue;
    }
  }

  // Apply default values for missing optional parameters
  for (const [propName, propSchema] of Object.entries(properties)) {
    if (!(propName in validatedArgs) && propSchema.default !== undefined) {
      validatedArgs[propName] = propSchema.default;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    validatedArgs: errors.length === 0 ? validatedArgs : undefined,
  };
}

/**
 * Validate a value against a JSON Schema property.
 * @param paramName - Name of the parameter being validated
 * @param value - Value to validate
 * @param schema - JSON Schema property definition
 * @param path - Path to the value for nested validation
 * @returns Validation error or null if valid
 */
function validateType(
  paramName: string,
  value: unknown,
  schema: JsonSchemaProperty,
  path?: string
): ParameterValidationError | null {
  const fullPath = path ? `${path}.${paramName}` : paramName;

  // Handle null
  if (value === null) {
    if (schema.type === 'null') {
      return null; // Valid null
    }
    return {
      parameter: paramName,
      message: `Expected ${schema.type}, got null`,
      expected: schema.type,
      actual: 'null',
      path: fullPath,
    };
  }

  // Type checking
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          parameter: paramName,
          message: `Expected string, got ${actualType}`,
          expected: 'string',
          actual: actualType,
          path: fullPath,
        };
      }
      // Check string constraints
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return {
          parameter: paramName,
          message: `String must be at least ${schema.minLength} characters`,
          expected: `minLength: ${schema.minLength}`,
          actual: value.length,
          path: fullPath,
        };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return {
          parameter: paramName,
          message: `String must be at most ${schema.maxLength} characters`,
          expected: `maxLength: ${schema.maxLength}`,
          actual: value.length,
          path: fullPath,
        };
      }
      if (schema.pattern !== undefined) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          return {
            parameter: paramName,
            message: `String does not match pattern: ${schema.pattern}`,
            expected: `pattern: ${schema.pattern}`,
            actual: value,
            path: fullPath,
          };
        }
      }
      break;

    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        return {
          parameter: paramName,
          message: `Expected ${schema.type}, got ${actualType}`,
          expected: schema.type,
          actual: actualType,
          path: fullPath,
        };
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        return {
          parameter: paramName,
          message: `Expected integer, got float`,
          expected: 'integer',
          actual: 'float',
          path: fullPath,
        };
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return {
          parameter: paramName,
          message: `Value must be at least ${schema.minimum}`,
          expected: `minimum: ${schema.minimum}`,
          actual: value,
          path: fullPath,
        };
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return {
          parameter: paramName,
          message: `Value must be at most ${schema.maximum}`,
          expected: `maximum: ${schema.maximum}`,
          actual: value,
          path: fullPath,
        };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          parameter: paramName,
          message: `Expected boolean, got ${actualType}`,
          expected: 'boolean',
          actual: actualType,
          path: fullPath,
        };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return {
          parameter: paramName,
          message: `Expected array, got ${actualType}`,
          expected: 'array',
          actual: actualType,
          path: fullPath,
        };
      }
      // Validate array items if schema provided
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemError = validateType(`[${i}]`, value[i], schema.items, fullPath);
          if (itemError) {
            return itemError;
          }
        }
      }
      // Check array length constraints
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return {
          parameter: paramName,
          message: `Array must have at least ${schema.minLength} items`,
          expected: `minItems: ${schema.minLength}`,
          actual: value.length,
          path: fullPath,
        };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return {
          parameter: paramName,
          message: `Array must have at most ${schema.maxLength} items`,
          expected: `maxItems: ${schema.maxLength}`,
          actual: value.length,
          path: fullPath,
        };
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return {
          parameter: paramName,
          message: `Expected object, got ${actualType}`,
          expected: 'object',
          actual: actualType,
          path: fullPath,
        };
      }
      // Validate nested properties if schema provided
      if (schema.properties) {
        const objValue = value as Record<string, unknown>;
        // Check required nested properties
        if (schema.required) {
          for (const reqProp of schema.required) {
            if (!(reqProp in objValue)) {
              return {
                parameter: reqProp,
                message: `Required property '${reqProp}' is missing`,
                expected: 'value',
                actual: undefined,
                path: `${fullPath}.${reqProp}`,
              };
            }
          }
        }
        // Validate each property
        for (const [propName, propValue] of Object.entries(objValue)) {
          const propSchema = schema.properties[propName];
          if (propSchema) {
            const propError = validateType(propName, propValue, propSchema, fullPath);
            if (propError) {
              return propError;
            }
          } else if (schema.additionalProperties === false) {
            return {
              parameter: propName,
              message: `Unknown property '${propName}'`,
              expected: 'one of: ' + Object.keys(schema.properties).join(', '),
              actual: propName,
              path: `${fullPath}.${propName}`,
            };
          }
        }
      }
      break;
  }

  // Check enum constraints
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    return {
      parameter: paramName,
      message: `Value must be one of: ${schema.enum.join(', ')}`,
      expected: schema.enum.join(' | '),
      actual: value,
      path: fullPath,
    };
  }

  return null;
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default global tool registry instance.
 * Use this for the main application registry.
 */
export const globalToolRegistry = new ToolRegistry();
