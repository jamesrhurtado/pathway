export {}

declare global {
  interface ModelContextTool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; untrustedContentHint?: boolean }
    execute: (input: unknown, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>
  }

  interface ModelContext {
    registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => void | Promise<void>
    unregisterTool?: (name: string) => void
  }

  interface Document {
    modelContext?: ModelContext
  }
}
