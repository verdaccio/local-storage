// @flow

import stream from 'stream';

import { S3 } from 'aws-sdk';
import { UploadTarball, ReadTarball } from '@verdaccio/streams';
import type { IUploadTarball } from '@verdaccio/streams';
import type { Callback, Logger, Package } from '@verdaccio/types';
import type { ILocalPackageManager } from '@verdaccio/local-storage';
import { error503, error409, error404, convertS3GetError } from './s3errors';

const pkgFileName = 'package.json';

// This is initialized for a single package

export default class LocalFS implements ILocalPackageManager {
  bucket: string;
  packageName: string;
  logger: Logger;
  s3: any;
  _localData: any;

  constructor(bucket: string, packageName: string, logger: Logger) {
    this.bucket = bucket;
    this.packageName = packageName;
    this.logger = logger;
    this.s3 = new S3();
  }

  /**
  2. read package.json
  3. updateFn(pkg, cb), and wait for cb
  4. write package.json.tmp
  5. move package.json.tmp package.json
  6. callback(err?)
  * @param {*} name
  * @param {*} updateHandler
  * @param {*} onWrite
  * @param {*} transformPackage
  * @param {*} onEnd
  */
  updatePackage(name: string, updateHandler: Callback, onWrite: Callback, transformPackage: Function, onEnd: Callback) {
    (async () => {
      try {
        const json = await this._getData();
        updateHandler(json, err => {
          if (err) {
            onEnd(err);
          } else {
            onWrite(name, transformPackage(json), onEnd);
          }
        });
      } catch (err) {
        debugger;
        return onEnd(err);
      }
    })();
  }

  async _getData(): Promise<any> {
    if (!this._localData) {
      return await new Promise((resolve, reject) => {
        this.s3.getObject(
          {
            Bucket: this.bucket,
            Key: `${this.packageName}/${pkgFileName}`
          },
          (err, response) => {
            if (err) {
              reject(convertS3GetError(err));
              return;
            }
            const data = JSON.parse(response.Body.toString());
            resolve(data);
          }
        );
      });
    }
    return this._localData;
  }

  deletePackage(fileName: string, callback: Callback) {
    this.s3.deleteObject(
      {
        Bucket: this.bucket,
        Key: `${this.packageName}/${fileName}`
      },
      (err, data) => {
        if (err) {
          debugger;
          throw err;
        }
        callback();
      }
    );
  }

  removePackage(callback: Callback): void {
    this.s3.listObjectsV2(
      {
        Bucket: this.bucket,
        Prefix: this.packageName
      },
      (err, data) => {
        if (err) {
          debugger;
          throw err;
        }
        debugger;
        this.s3.deleteObjects(
          {
            Bucket: this.bucket,
            Delete: []
          },
          (err, data) => {
            if (err) {
              debugger;
              throw err;
            }
            callback();
          }
        );
      }
    );
  }

  createPackage(name: string, value: Package, cb: Function) {
    this.savePackage(name, value, cb);
  }

  savePackage(name: string, value: Package, cb: Function) {
    this.s3.putObject(
      {
        Body: JSON.stringify(value, null, '  '),
        Bucket: this.bucket,
        Key: `${this.packageName}/${pkgFileName}`
      },
      cb
    );
  }

  readPackage(name: string, cb: Function) {
    (async () => {
      try {
        const data = await this._getData();
        cb(null, data);
      } catch (err) {
        cb(err);
      }
    })();
  }

  writeTarball(name: string): IUploadTarball {
    const uploadStream = new UploadTarball();

    let streamEnded = 0;
    uploadStream.on('end', () => {
      streamEnded = 1;
    });

    const baseS3Params = {
      Bucket: this.bucket,
      Key: `${this.packageName}/${name}`
    };

    this.s3.getObject(baseS3Params, (err, response) => {
      if (err) {
        err = convertS3GetError(err);
        if (err !== error404) {
          throw err;
        } else {
          const s3upload = new Promise((resolve, reject) => {
            this.s3.upload(Object.assign({}, baseS3Params, { Body: uploadStream }), (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });

          uploadStream.done = () => {
            const onEnd = async () => {
              try {
                await s3upload;
                uploadStream.emit('success');
              } catch (err) {
                debugger;
                uploadStream.emit('error', err);
              }
            };
            if (streamEnded) {
              onEnd();
            } else {
              uploadStream.on('end', onEnd);
            }
          };

          uploadStream.abort = async () => {
            debugger;
            try {
              await s3upload;
            } finally {
              this.s3.deleteObject(baseS3Params);
            }
          };
        }
      } else {
        uploadStream.emit('error', error409);
      }
    });

    return uploadStream;
  }

  readTarball(name: string, readTarballStream: any) {
    readTarballStream = new ReadTarball();

    let aborted = false;

    readTarballStream.abort = () => {
      aborted = true;
    };

    this.s3.getObject(
      {
        Bucket: this.bucket,
        Key: `${this.packageName}/${name}`
      },
      (err, data) => {
        if (!aborted) {
          if (err) {
            readTarballStream.emit('error', convertS3GetError(err));
          } else {
            const bufferStream = new stream.PassThrough();
            // NOTE: no chunking is done here
            bufferStream.end(data.Body);

            readTarballStream.emit('content-length', data.ContentLength);
            readTarballStream.emit('open');
            bufferStream.pipe(readTarballStream);
          }
        }
      }
    );

    return readTarballStream;
  }
}
