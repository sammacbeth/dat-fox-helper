const fs = require('fs-extra');
const path = require('path');
const promisify = require('util').promisify;
const DatArchive = require('node-dat-archive')

async function extractDat(dir) {
    const datDir = path.join(dir, '.dat');
    const keyFile = path.join(datDir, 'metadata.key')
    if (await fs.exists(datDir) && await fs.exists(keyFile)) {
        const key = await fs.readFile(keyFile);
        return {
            address: key.toString('hex'),
            dir: dir,
        }
    }
    return false;
}

module.exports = async function(libraryDir, node) {
    const newLibraryDir = path.join(libraryDir, 'dat1');
    // check if new library folder already exists
    if (await fs.exists(newLibraryDir)) {
        return;
    }
    // collect potential archives
    let folders = (await fs.readdir(libraryDir)).map((f) => path.join(libraryDir, f));
    const folderCandidates = await Promise.all(folders.map(d => extractDat(d)))
    // do migrations
    await fs.mkdir(newLibraryDir);
    await Promise.all(folderCandidates.filter((v) => v !== false).map(async ({ address, dir }) => {
        const archive = await DatArchive.load({ localPath: dir, datOptions: { latest: true }});
        const newDat = await node.getDat(address, { persist: true, autoSwarm: false, sparse: false });
        const stream = archive._archive.replicate({ live: true });
        stream.pipe(newDat.drive.replicate({ live: true })).pipe(stream);
        setTimeout(async () => {
            if (archive._archive.writable) {
                console.error('import secret key', archive._archive.metadata.secretKey.toString('hex'));
                await new Promise((resolve) => {
                    newDat.drive.metadata._storage.secretKey.write(0, archive._archive.metadata.secretKey, resolve)
                });
            }
            archive._close();
            newDat.close();
        }, 10000);
    }));
}