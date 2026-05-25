import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the sync modules before importing
vi.mock('./services/sync/syncScheduler.js');
vi.mock('./services/sync/teamMapper.js');
vi.mock('./services/storageService.js');

import { startScheduler, stopScheduler } from './services/sync/syncScheduler.js';
import { validateMapping } from './services/sync/teamMapper.js';
import { readFile } from './services/storageService.js';
import { initializeSync } from './index.js';

describe('initializeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FOOTBALL_DATA_API_KEY;
  });

  afterEach(() => {
    delete process.env.FOOTBALL_DATA_API_KEY;
  });

  it('logs warning and skips scheduler start when API key is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await initializeSync();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FOOTBALL_DATA_API_KEY is not set or empty')
    );
    expect(startScheduler).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('logs warning and skips scheduler start when API key is empty string', async () => {
    process.env.FOOTBALL_DATA_API_KEY = '';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await initializeSync();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FOOTBALL_DATA_API_KEY is not set or empty')
    );
    expect(startScheduler).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('logs warning and skips scheduler start when API key is whitespace only', async () => {
    process.env.FOOTBALL_DATA_API_KEY = '   ';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await initializeSync();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FOOTBALL_DATA_API_KEY is not set or empty')
    );
    expect(startScheduler).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('logs error and disables sync when team mapping validation fails', async () => {
    process.env.FOOTBALL_DATA_API_KEY = 'test-api-key';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    readFile.mockResolvedValue({
      pots: [
        { potNumber: 1, teams: [{ id: 'esp' }, { id: 'arg' }, { id: 'xyz' }] },
      ],
    });
    validateMapping.mockReturnValue({ valid: false, unmapped: ['xyz'] });

    await initializeSync();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Team mapping validation failed')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('xyz')
    );
    expect(startScheduler).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('logs error and disables sync when teams.json cannot be read', async () => {
    process.env.FOOTBALL_DATA_API_KEY = 'test-api-key';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    readFile.mockRejectedValue(new Error('File not found'));

    await initializeSync();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to validate team mapping')
    );
    expect(startScheduler).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('starts scheduler when API key is present and mapping is valid', async () => {
    process.env.FOOTBALL_DATA_API_KEY = 'valid-api-key';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    readFile.mockResolvedValue({
      pots: [
        { potNumber: 1, teams: [{ id: 'esp' }, { id: 'arg' }] },
      ],
    });
    validateMapping.mockReturnValue({ valid: true, unmapped: [] });

    await initializeSync();

    expect(startScheduler).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scheduler started successfully')
    );

    logSpy.mockRestore();
  });

  it('extracts team IDs from all pots in teams.json', async () => {
    process.env.FOOTBALL_DATA_API_KEY = 'valid-api-key';
    vi.spyOn(console, 'log').mockImplementation(() => {});

    readFile.mockResolvedValue({
      pots: [
        { potNumber: 1, teams: [{ id: 'esp' }, { id: 'arg' }] },
        { potNumber: 2, teams: [{ id: 'cro' }, { id: 'mar' }] },
      ],
    });
    validateMapping.mockReturnValue({ valid: true, unmapped: [] });

    await initializeSync();

    expect(validateMapping).toHaveBeenCalledWith(['esp', 'arg', 'cro', 'mar']);

    vi.restoreAllMocks();
  });
});
