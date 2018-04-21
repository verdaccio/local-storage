// @flow
import fs from 'fs';
import Path from 'path';
import touch from 'touch';
import { clone } from 'lodash';
import type { ILocalData } from '@verdaccio/local-storage';
import LocalDatabase, { DEFAULT_WATCH_POLL_INTERVAL } from '../local-database';
import Config from './__mocks__/Config';
import logger from './__mocks__/Logger';

const stuff = {
  logger,
  config: new Config()
};

let locaDatabase: ILocalData;
let databasePath: string;

describe('Local Database', () => {
  beforeEach(() => {
    fs.writeFileSync = jest.fn();
    // fs.readFileSync = jest.fn();
    locaDatabase = new LocalDatabase(stuff.config, stuff.logger);
    databasePath = Path.join(Path.resolve(Path.dirname(stuff.config.self_path || ''), stuff.config.storage, '.sinopia-db.json'));
    // clean database
    locaDatabase._sync();
  });

  afterAll(done => {
    fs.unlink(databasePath, done);
  });

  test('should create an instance', () => {
    const locaDatabase = new LocalDatabase(stuff.config, stuff.logger);

    expect(locaDatabase).toBeDefined();
  });

  describe('should create set secret', () => {
    test('should create get secret', async () => {
      const locaDatabase = new LocalDatabase(clone(stuff.config), stuff.logger);
      const secretKey = await locaDatabase.getSecret();
      expect(secretKey).toBeDefined();
      expect(typeof secretKey === 'string').toBeTruthy();
    });

    test('should create set secret', async () => {
      const locaDatabase = new LocalDatabase(clone(stuff.config), stuff.logger);

      await locaDatabase.setSecret(stuff.config.checkSecretKey());
      expect(stuff.config.secret).toBeDefined();
      expect(typeof stuff.config.secret === 'string').toBeTruthy();
      const fetchedSecretKey = await locaDatabase.getSecret();
      expect(stuff.config.secret).toBe(fetchedSecretKey);
    });
  });

  describe('Database CRUD', () => {
    test('should add an item to database', done => {
      const pgkName = 'jquery';
      locaDatabase.get((err, data) => {
        expect(err).toBeNull();
        expect(data).toHaveLength(0);

        locaDatabase.add(pgkName, err => {
          expect(err).toBeNull();
          locaDatabase.get((err, data) => {
            expect(err).toBeNull();
            expect(data).toHaveLength(1);
            done();
          });
        });
      });
    });

    test('should remove an item to database', done => {
      const pgkName = 'jquery';
      locaDatabase.get((err, data) => {
        expect(err).toBeNull();
        expect(data).toHaveLength(0);
        locaDatabase.add(pgkName, err => {
          expect(err).toBeNull();
          locaDatabase.remove(pgkName, err => {
            expect(err).toBeNull();
            locaDatabase.get((err, data) => {
              expect(err).toBeNull();
              expect(data).toHaveLength(0);
              done();
            });
          });
        });
      });
    });

    it(
      'should emit an event when database file is touched',
      done => {
        locaDatabase.on('data', data => {
          expect(data).toBeDefined();
          expect(data.list).toBeDefined();
          expect(data.secret).toBeDefined();
          done();
        });
        touch(databasePath);
      },
      DEFAULT_WATCH_POLL_INTERVAL + 100
    );
  });
});
