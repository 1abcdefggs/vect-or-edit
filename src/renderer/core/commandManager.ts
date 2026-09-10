/**
 * Command Manager (Deep Module for Application Commands)
 * 
 * Provides a clean seam between UI triggers (menu bar, hotkeys, context menu)
 * and concrete action implementations.
 */

export interface CommandDefinition {
  id: string;
  title: string;
  category?: string;
  shortcut?: string;
  handler: () => void | Promise<void>;
  isEnabled?: () => boolean;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  error?: Error | unknown;
}

class CommandManager {
  private commands = new Map<string, CommandDefinition>();

  /**
   * Register a new command to the central registry.
   */
  registerCommand(cmd: CommandDefinition): () => void {
    if (this.commands.has(cmd.id)) {
      console.warn(`[CommandManager] Overwriting existing command: ${cmd.id}`);
    }
    this.commands.set(cmd.id, cmd);

    // Return unregister function
    return () => {
      this.commands.delete(cmd.id);
    };
  }

  /**
   * Register multiple commands in batch.
   */
  registerCommands(cmds: CommandDefinition[]): () => void {
    const unregisters = cmds.map(cmd => this.registerCommand(cmd));
    return () => {
      unregisters.forEach(unreg => unreg());
    };
  }

  /**
   * Execute a command by its identifier.
   */
  async executeCommand(id: string): Promise<CommandResult> {
    const cmd = this.commands.get(id);
    if (!cmd) {
      console.warn(`[CommandManager] Command not found: ${id}`);
      return { success: false, commandId: id, error: new Error(`Command not found: ${id}`) };
    }

    if (cmd.isEnabled && !cmd.isEnabled()) {
      return { success: false, commandId: id, error: new Error(`Command is currently disabled: ${id}`) };
    }

    try {
      await cmd.handler();
      return { success: true, commandId: id };
    } catch (err) {
      console.error(`[CommandManager] Error executing command ${id}:`, err);
      return { success: false, commandId: id, error: err };
    }
  }

  /**
   * Check if a command exists in the registry.
   */
  hasCommand(id: string): boolean {
    return this.commands.has(id);
  }

  /**
   * Check if a command is currently enabled.
   */
  isCommandEnabled(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    return cmd.isEnabled ? cmd.isEnabled() : true;
  }

  /**
   * Retrieve command metadata.
   */
  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  /**
   * List all registered commands.
   */
  listCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Clear all registered commands (useful for testing).
   */
  clear(): void {
    this.commands.clear();
  }
}

export const commandManager = new CommandManager();
