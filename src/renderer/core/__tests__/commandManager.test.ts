import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commandManager } from '../commandManager';

describe('CommandManager (Deep Module)', () => {
  beforeEach(() => {
    commandManager.clear();
  });

  it('should register and execute a command successfully', async () => {
    const handler = vi.fn();
    commandManager.registerCommand({
      id: 'file.new',
      title: 'New File',
      handler
    });

    expect(commandManager.hasCommand('file.new')).toBe(true);

    const result = await commandManager.executeCommand('file.new');
    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should return error for non-existent command', async () => {
    const result = await commandManager.executeCommand('non.existent');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should respect isEnabled predicate', async () => {
    const handler = vi.fn();
    let enabled = false;

    commandManager.registerCommand({
      id: 'edit.undo',
      title: 'Undo',
      handler,
      isEnabled: () => enabled
    });

    expect(commandManager.isCommandEnabled('edit.undo')).toBe(false);
    let result = await commandManager.executeCommand('edit.undo');
    expect(result.success).toBe(false);
    expect(handler).not.toHaveBeenCalled();

    enabled = true;
    expect(commandManager.isCommandEnabled('edit.undo')).toBe(true);
    result = await commandManager.executeCommand('edit.undo');
    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unregister command when unregister function is called', async () => {
    const unregister = commandManager.registerCommand({
      id: 'view.toggleSidebar',
      title: 'Toggle Sidebar',
      handler: () => {}
    });

    expect(commandManager.hasCommand('view.toggleSidebar')).toBe(true);
    unregister();
    expect(commandManager.hasCommand('view.toggleSidebar')).toBe(false);
  });
});
