// @flow

import _ from 'lodash';
import Path from 'path';
import LocalFS from './local-fs';
import type { StorageList, LocalStorage, Logger, Config, Callback } from '@verdaccio/types';
import type { IPackageStorage, ILocalData } from '@verdaccio/local-storage';
import { S3 } from 'aws-sdk';

/**
 * Handle local database.
 */
class LocalDatabase implements ILocalData {
  logger: Logger;
  config: Config;
  bucket: string;
  _localData: ?LocalStorage;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.bucket = config.store['s3-storage'].bucket;
    this.s3 = new S3();
    if (!this.bucket) {
      throw new Error('s3 storage requires a bucket');
    }
  }

  async getSecret(): Promise<any> {
    return Promise.resolve((await this._getData()).secret);
  }

  async setSecret(secret: string): Promise<any> {
    (await this._getData()).secret = secret;
    await this._sync();
  }

  /**
   * Add a new element.
   * @param {*} name
   * @return {Error|*}
   */
  add(name: string, cb: Callback) {
    this._getData().then(async data => {
      if (data.list.indexOf(name) === -1) {
        data.list.push(name);
        try {
          this._sync();
          cb();
        } catch (err) {
          cb(err);
        }
      } else {
        cb();
      }
    });
  }

  /**
   * Remove an element from the database.
   * @param {*} name
   * @return {Error|*}
   */
  remove(name: string, cb: Callback) {
    this.get(async (err, data) => {
      if (err) {
        cb(new Error('error on get'));
      }

      const pkgName = data.indexOf(name);
      if (pkgName !== -1) {
        const data = await this._getData();
        data.list.splice(pkgName, 1);
      }

      try {
        this._sync();
        cb();
      } catch (err) {
        cb(err);
      }
    });
  }

  /**
   * Return all database elements.
   * @return {Array}
   */
  get(cb: Callback) {
    this._getData().then(data => cb(null, data.list));
  }

  /**
   * Syncronize {create} database whether does not exist.
   * @return {Error|*}
   */
  async _sync() {
    await new Promise((resolve, reject) => {
      this.s3.putObject(
        {
          Bucket: this.bucket,
          Key: 'verdaccio-s3-db.json',
          Body: JSON.stringify(this._localData)
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  getPackageStorage(packageName: string): IPackageStorage {
    // $FlowFixMe
    const packagePath: string = this._getLocalStoragePath(this.config.getMatchedPackagesSpec(packageName).storage);

    if (_.isString(packagePath) === false) {
      this.logger.debug({ name: packageName }, 'this package has no storage defined: @{name}');
      return;
    }

    return new LocalFS(this.bucket, packageName, this.logger);
  }

  /**
   * Verify the right local storage location.
   * @param {String} path
   * @return {String}
   * @private
   */
  _getLocalStoragePath(path: string): string {
    if (_.isNil(path) === false) {
      return path;
    }

    return this.config.storage;
  }

  /**
   * Build the local database path.
   * @param {Object} config
   * @return {string|String|*}
   * @private
   */
  _buildStoragePath(config: Config) {
    return Path.join(Path.resolve(Path.dirname(config.self_path || ''), config.storage, '.verdaccio-s3-db.json'));
  }

  async _getData(): Promise<LocalStorage> {
    if (!this._localData) {
      this._localData = await new Promise((resolve, reject) => {
        this.s3.getObject({ Bucket: this.bucket, Key: 'verdaccio-s3-db.json' }, (err, response) => {
          if (err) {
            if (err.code === 'NoSuchKey') {
              resolve({ list: [], secret: '' });
            } else {
              reject(err);
            }
            return;
          }
          const data = JSON.parse(response.Body.toString());
          resolve(data);
        });
      });
    }
    return this._localData;
  }
}

export default LocalDatabase;
