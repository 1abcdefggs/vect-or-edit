import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { createSavePathAllowlist } from '../savePathAllowlist';

// An absolute root that works on Windows and POSIX
const root = path.parse(process.cwd()).root;
const folder = path.join(root, 'work', 'docs');

describe('savePathAllowlist', () => {
  it('does not approve a path nobody chose in a dialog', () => {
    const list = createSavePathAllowlist();
    expect(list.isApproved(path.join(folder, 'a.md'))).toBe(false);
  });

  it('approves the exact file the user chose', () => {
    const list = createSavePathAllowlist();
    list.approveFile(path.join(folder, 'a.md'));
    expect(list.isApproved(path.join(folder, 'a.md'))).toBe(true);
    expect(list.isApproved(path.join(folder, 'b.md'))).toBe(false);
  });

  it('approves a file directly inside an approved folder', () => {
    const list = createSavePathAllowlist();
    list.approveFolder(folder);
    expect(list.isApproved(path.join(folder, 'new.md'))).toBe(true);
  });

  it('does not approve a file in a subfolder of an approved folder', () => {
    const list = createSavePathAllowlist();
    list.approveFolder(folder);
    expect(list.isApproved(path.join(folder, 'sub', 'x.md'))).toBe(false);
  });

  it('does not let ".." reach outside an approved folder', () => {
    const list = createSavePathAllowlist();
    list.approveFolder(folder);
    expect(list.isApproved(path.join(folder, '..', 'other.md'))).toBe(false);
  });

  it('starts empty for a new list (nothing carries over between runs)', () => {
    const first = createSavePathAllowlist();
    first.approveFolder(folder);
    const second = createSavePathAllowlist();
    expect(second.isApproved(path.join(folder, 'a.md'))).toBe(false);
  });
});
