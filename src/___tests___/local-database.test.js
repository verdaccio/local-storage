// @flow
import fs from 'fs';
import Path from 'path';
import touch from 'touch';
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

  test('should create set secret', async () => {
    const secret = '12345';
    // $FlowFixMe
    await locaDatabase.setSecret(secret);
    // $FlowFixMe
    expect(await locaDatabase.getSecret()).toBe(secret);
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
