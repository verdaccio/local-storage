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
  const versions: string[] = [];
  const arr: string[] = await readDirectory(scopePath);
  arr.forEach( (filePath: string) => {
    const fileName = path.basename( filePath);
    // fileName should start with package name and should ends with '.tgz'
    if (fileName.indexOf(packageName)===0 && fileName.indexOf('.tgz')!==-1) {
      const v: string = (fileName.split(packageName+'-')[1] || '').replace('.tgz', '');
      versions.push(v);
    }
  });
  return versions;
}


export async function findPackages(storagePath: string) {
  //stats
  const startTS = Date.now();
  let packages_count = 0;
  let versions_count = 0;

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
                listPackages[`${directory}/${scopedDirName}`] = //{
//                  path: scopePath,
                  versions
//                };
                packages_count++;
                versions_count += versions.length;
              }
            }
          } else {
            // otherwise we read as single level
            const scopePath = path.resolve(storagePath, directory);  
            const stats = await getFileStats(scopePath);
            if (stats.isDirectory()) {                

              const versions = await getVersions(scopePath, directory);
              listPackages[directory] = //{
//                path: scopePath,
                versions
//              };
              packages_count++;
              versions_count += versions.length;
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
        packages_count,
        versions_count,
      }
    });
  });
}