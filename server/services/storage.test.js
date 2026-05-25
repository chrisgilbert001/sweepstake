import { readFile, writeFile, updateFile, atomicWriteFile } from './storageService.js';
import { writeFile as fsWrite, readFile as fsRead, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEST_FILE = '_test_storage.json';
const TEST_FILE_PATH = path.join(DATA_DIR, TEST_FILE);

describe('storageService', () => {
  beforeEach(async () => {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    try { await rm(TEST_FILE_PATH); } catch (e) { /* ignore */ }
    try { await rm(TEST_FILE_PATH + '.lock', { recursive: true }); } catch (e) { /* ignore */ }
    try { await rm(TEST_FILE_PATH + '.tmp'); } catch (e) { /* ignore */ }
  });

  describe('readFile', () => {
    it('reads and parses a valid JSON file', async () => {
      const testData = { name: 'test', value: 42 };
      await fsWrite(TEST_FILE_PATH, JSON.stringify(testData), 'utf-8');
      const result = await readFile(TEST_FILE);
      expect(result).toEqual(testData);
    });

    it('throws 500 for non-existent file', async () => {
      await expect(readFile('nonexistent_xyz.json')).rejects.toMatchObject({
        statusCode: 500,
        message: 'File not found'
      });
    });

    it('throws 500 for corrupt JSON', async () => {
      await fsWrite(TEST_FILE_PATH, 'not valid json {{{', 'utf-8');
      await expect(readFile(TEST_FILE)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Corrupt JSON file'
      });
    });
  });

  describe('writeFile', () => {
    it('writes data as formatted JSON with locking', async () => {
      const testData = { hello: 'world', items: [1, 2, 3] };
      await fsWrite(TEST_FILE_PATH, '{}', 'utf-8');
      await writeFile(TEST_FILE, testData);
      const result = await readFile(TEST_FILE);
      expect(result).toEqual(testData);
    });
  });

  describe('updateFile', () => {
    it('reads, transforms, and writes back atomically', async () => {
      const initialData = { count: 5, items: ['a'] };
      await fsWrite(TEST_FILE_PATH, JSON.stringify(initialData), 'utf-8');

      const result = await updateFile(TEST_FILE, (data) => ({
        ...data,
        count: data.count + 1,
        items: [...data.items, 'b']
      }));

      expect(result).toEqual({ count: 6, items: ['a', 'b'] });
      const persisted = await readFile(TEST_FILE);
      expect(persisted).toEqual({ count: 6, items: ['a', 'b'] });
    });

    it('throws 500 for non-existent file', async () => {
      await expect(
        updateFile('nonexistent_update_xyz.json', (data) => data)
      ).rejects.toMatchObject({
        statusCode: 500,
        message: 'File not found'
      });
      try { await rm(path.join(DATA_DIR, 'nonexistent_update_xyz.json.lock'), { recursive: true }); } catch (e) { /* ignore */ }
    });

    it('throws 500 for corrupt JSON during update', async () => {
      await fsWrite(TEST_FILE_PATH, 'invalid json', 'utf-8');
      await expect(
        updateFile(TEST_FILE, (data) => data)
      ).rejects.toMatchObject({
        statusCode: 500,
        message: 'Corrupt JSON file'
      });
    });

    it('handles sequential updates safely', async () => {
      await fsWrite(TEST_FILE_PATH, JSON.stringify({ count: 0 }), 'utf-8');
      await updateFile(TEST_FILE, (data) => ({ count: data.count + 1 }));
      await updateFile(TEST_FILE, (data) => ({ count: data.count + 1 }));
      await updateFile(TEST_FILE, (data) => ({ count: data.count + 1 }));
      const result = await readFile(TEST_FILE);
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('atomicWriteFile', () => {
    it('writes data atomically via tmp file and rename', async () => {
      // Create initial file
      await fsWrite(TEST_FILE_PATH, JSON.stringify({ old: true }), 'utf-8');

      const newData = { new: true, items: [1, 2, 3] };
      await atomicWriteFile(TEST_FILE, newData);

      const result = await readFile(TEST_FILE);
      expect(result).toEqual(newData);
    });

    it('does not leave a .tmp file after successful write', async () => {
      await fsWrite(TEST_FILE_PATH, '{}', 'utf-8');
      await atomicWriteFile(TEST_FILE, { success: true });

      expect(existsSync(TEST_FILE_PATH + '.tmp')).toBe(false);
    });

    it('creates the file if it does not exist', async () => {
      const newFile = '_test_atomic_new.json';
      const newFilePath = path.join(DATA_DIR, newFile);

      try {
        await atomicWriteFile(newFile, { created: true });
        const content = JSON.parse(await fsRead(newFilePath, 'utf-8'));
        expect(content).toEqual({ created: true });
      } finally {
        try { await rm(newFilePath); } catch (e) { /* ignore */ }
        try { await rm(newFilePath + '.lock', { recursive: true }); } catch (e) { /* ignore */ }
        try { await rm(newFilePath + '.tmp'); } catch (e) { /* ignore */ }
      }
    });

    it('preserves original data if target file already has content', async () => {
      const originalData = { preserved: true, count: 42 };
      await fsWrite(TEST_FILE_PATH, JSON.stringify(originalData), 'utf-8');

      // Write new data atomically
      const newData = { replaced: true, count: 99 };
      await atomicWriteFile(TEST_FILE, newData);

      const result = await readFile(TEST_FILE);
      expect(result).toEqual(newData);
    });

    it('writes formatted JSON (pretty-printed)', async () => {
      await fsWrite(TEST_FILE_PATH, '{}', 'utf-8');
      await atomicWriteFile(TEST_FILE, { key: 'value' });

      const raw = await fsRead(TEST_FILE_PATH, 'utf-8');
      expect(raw).toBe(JSON.stringify({ key: 'value' }, null, 2));
    });
  });
});
