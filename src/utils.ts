import fs from 'fs';
import _ from 'lodash';
import path from 'path';

async function getFileStats(packagePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.stat(packagePath, (err, stats) => {
      if (_.isNil(err) === false) {
        return reject(err);
      }
      resolve(stats);
    });
  });
}

async function readDirectory(packagePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.readdir(packagePath, (err, scopedPackages) => {
      if (_.isNil(err) === false) {
        return reject(err);
      }

      resolve(scopedPackages);
    });
  });
}

function hasScope(file: string) {
  return file.match(/^@/);
}

async function getVersions(scopePath: string, packageName: string): Promise<string[]> {
  const fileList: string[] = await readDirectory(scopePath);
  return fileList
    .filter( (fileName: string) => {
      // fileName should start with package name and should ends with '.tgz'
      return (fileName.indexOf(packageName)===0 && fileName.indexOf('.tgz')!==-1);
    })
    .map( (fileName: string) => {
      return (fileName.split(packageName+'-')[1] || '').replace('.tgz', '');
    });
}


export async function findPackages(storagePath: string) {
  //stats
  const startTS = Date.now();
  let packagesCount = 0;
  let versionsCount = 0;

  const listPackages: any = {};
  return new Promise(async (resolve, reject) => {
    try {
      const scopePath = path.resolve(storagePath);
      const storageDirs = await readDirectory(scopePath);
      for (const directory of storageDirs) {
        const stats = await getFileStats(path.resolve(storagePath, directory));
        if (stats.isDirectory()) {
          // we check whether has 2nd level
          if (hasScope(directory)) {
            // we read directory multiple
            const scopeDirectory = path.resolve(storagePath, directory);
            const scopedPackages = await readDirectory(scopeDirectory);
            for (const scopedDirName of scopedPackages) {
              // we build the complete scope path
              const scopePath = path.resolve(storagePath, directory, scopedDirName);
              const stats = await getFileStats(scopePath);
              if (stats.isDirectory()) {                
                const versions = await getVersions(scopePath, scopedDirName);
                // list content of such directory
                listPackages[`${directory}/${scopedDirName}`] = versions;
                packagesCount++;
                versionsCount += versions.length;
              }
            }
          } else {
            // otherwise we read as single level
            const scopePath = path.resolve(storagePath, directory);  
            const stats = await getFileStats(scopePath);
            if (stats.isDirectory()) {                

              const versions = await getVersions(scopePath, directory);
              listPackages[directory] = versions;
              packagesCount++;
              versionsCount += versions.length;
            }
          }
        }
      }
    } catch (error) {
      reject(error);
    }

    resolve({
      packages: listPackages,
      stats: {
        ts: Date.now(),
        duration: Date.now() - startTS,
        packagesCount,
        versionsCount,
      }
    });
  });
}
