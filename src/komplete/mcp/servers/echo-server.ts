/**
 * Echo MCP Server
 *
 * A simple MCP server that provides an echo tool for testing.
 * This server reads JSON-RPC messages from stdin and writes responses to stdout.
 */

import { createInterface } from 'readline';

/**
 * MCP JSON-RPC message types
 */
interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Echo tool definition
 */
const ECHO_TOOL = {
  name: 'echo',
  description: 'Echoes back the provided message',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
      repeat: {
        type: 'number',
        description: 'Number of times to repeat the message (default: 1)',
        default: 1,
      },
    },
    required: ['message'],
  },
};

/**
 * Echo MCP Server class
 */
export class EchoMCPServer {
  private messageId: number = 0;
  private initialized: boolean = false;

  /**
   * Start the echo server
   */
  start(): void {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Handle incoming messages
    rl.on('line', (line: string) => {
      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        this.handleMessage(message);
      } catch (error) {
        this.sendError(0, -32700, 'Parse error', { line });
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      this.shutdown();
    });
    process.on('SIGTERM', () => {
      this.shutdown();
    });

    // Log startup
    const stderr = process.stderr;
    if (stderr) {
      stderr.write('Echo MCP Server started\n');
      stderr.write('Listening for JSON-RPC messages on stdin\n');
    }
  }

  /**
   * Handle incoming JSON-RPC message
   *
   * @param message - The message to handle
   */
  private handleMessage(message: JSONRPCMessage): void {
    // Notifications (no id) don't need responses
    if (message.id === undefined) {
      return;
    }

    try {
      switch (message.method) {
        case 'initialize':
          this.handleInitialize(message);
          break;

        case 'initialized':
          // Server is now initialized
          this.initialized = true;
          break;

        case 'tools/list':
          this.handleToolsList(message);
          break;

        case 'tools/call':
          this.handleToolCall(message);
          break;

        default:
          this.sendError(
            message.id,
            -32601,
            `Method not found: ${message.method}`
          );
      }
    } catch (error) {
      this.sendError(
        message.id,
        -32603,
        `Internal error: ${(error as Error).message}`
      );
    }
  }

  /**
   * Handle initialize request
   *
   * @param message - The initialize request
   */
  private handleInitialize(message: JSONRPCMessage): void {
    const stderr = process.stderr;
    if (stderr) {
      stderr.write(`Initialize request from ${JSON.stringify(message.params)}\n`);
    }

    const response: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
        },
        serverInfo: {
          name: 'echo-server',
          version: '1.0.0',
        },
      },
    };

    this.sendMessage(response);
  }

  /**
   * Handle tools/list request
   *
   * @param message - The tools/list request
   */
  private handleToolsList(message: JSONRPCMessage): void {
    const response: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [ECHO_TOOL],
      },
    };

    this.sendMessage(response);
  }

  /**
   * Handle tools/call request
   *
   * @param message - The tools/call request
   */
  private handleToolCall(message: JSONRPCMessage): void {
    const params = message.params as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    if (params.name !== 'echo') {
      this.sendError(
        message.id ?? 0,
        -32602,
        `Unknown tool: ${params.name}`
      );
      return;
    }

    const args = params.arguments || {};
    const messageText = args.message as string || '';
    const repeat = (args.repeat as number) || 1;

    // Echo the message
    const echoed = messageText.repeat(repeat);

    const response: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [
          {
            type: 'text',
            text: echoed,
          },
        ],
        isError: false,
      },
    };

    this.sendMessage(response);
  }

  /**
   * Send a JSON-RPC message
   *
   * @param message - The message to send
   */
  private sendMessage(message: JSONRPCMessage): void {
    const json = JSON.stringify(message) + '\n';
    process.stdout.write(json);
  }

  /**
   * Send an error response
   *
   * @param id - Request ID
   * @param code - Error code
   * @param message - Error message
   * @param data - Optional error data
   */
  private sendError(
    id: string | number,
    code: number,
    message: string,
    data?: unknown
  ): void {
    const response: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };

    this.sendMessage(response);
  }

  /**
   * Shutdown the server
   */
  private shutdown(): void {
    const stderr = process.stderr;
    if (stderr) {
      stderr.write('Echo MCP Server shutting down...\n');
    }

    process.exit(0);
  }
}

/**
 * Start the echo server
 */
export function startEchoServer(): void {
  const server = new EchoMCPServer();
  server.start();
}

// Note: To start the server, call startEchoServer() from your entry point
// The Bun-specific import.meta.main check has been removed for Node.js compatibility
