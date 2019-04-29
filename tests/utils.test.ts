import path from 'path';
import { findPackages } from '../src/utils';
import { loadPrivatePackages } from '../src/pkg-utils';
import logger from './__mocks__/Logger';
import { noSuchFile } from '../src/local-fs';

describe('Utitlies', () => {
  const loadDb = name => path.join(__dirname, '__fixtures__/databases', `${name}.json`);

  beforeEach(() => {
    jest.resetModules();
  });

  test('should load private packages', () => {
    const database = loadDb('ok');
    const db = loadPrivatePackages(database, logger);

    expect(db.list).toHaveLength(15);
  });

  test('should load and empty private packages if database file is valid and empty', () => {
    const database = loadDb('empty');
    const db = loadPrivatePackages(database, logger);

    expect(db.list).toHaveLength(0);
  });

  test('should fails on load private packages', () => {
    const database = loadDb('corrupted');

    expect(() => {
      loadPrivatePackages(database, logger);
    }).toThrow();
  });

  test('should handle null read values and return empty database', () => {
    jest.doMock('fs', () => {
      return {
        readFileSync: () => null
      };
    });

    const { loadPrivatePackages } = require('../src/pkg-utils');
    const database = loadDb('ok');
    const db = loadPrivatePackages(database, logger);

    expect(db.list).toHaveLength(0);
  });

  describe('find packages', () => {
    test('should fails on wrong storage path', async () => {
      try {
        await findPackages('./no_such_folder_fake');
      } catch (e) {
        expect(e.code).toEqual(noSuchFile);
      }
    });

    test('should fetch all packages from valid storage', async () => {
      const storage = path.join(__dirname, '__fixtures__/findPackages');
      const pkgs = await findPackages(storage);

      expect(Object.keys(pkgs.packages)).toHaveLength(5);
      expect(pkgs.stats.packagesCount).toBe(5);
      expect(pkgs.stats.versionsCount).toBe(2);

      expect(pkgs.packages['@scoped-test/pkg-1']).toHaveLength(1);
      expect(pkgs.packages['@scoped-test/pkg2']).toHaveLength(0);
      expect(pkgs.packages['@scoped_second/pkg1']).toHaveLength(0);
      expect(pkgs.packages['@scoped_second/pkg2']).toHaveLength(0);
      expect(pkgs.packages['pk3']).toHaveLength(1);

      expect(pkgs.packages['@scoped-test/pkg-1']).toEqual(['0.1.1-beta.1']);
      expect(pkgs.packages['pk3']).toEqual(['1.0.0']);
    });
  });
});
