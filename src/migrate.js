const fs = require('fs-extra');
const path = require('path');
const promisify = require('util').promisify;

async function extractDat(dir) {
    const datDir = path.join(dir, '.dat');
    const keyFile = path.join(datDir, 'metadata.key')
    if (await fs.exists(datDir) && await fs.exists(keyFile)) {
        const key = await fs.readFile(keyFile);
        return {
            address: key.toString('hex'),
            dir: datDir,
        }
    }
    return false;
}

module.exports = async function(libraryDir) {
    const cacheDir = path.join(libraryDir, 'cache');
    const newLibraryDir = path.join(libraryDir, 'dat1');
    // check if new library folder already exists
    if (await fs.exists(newLibraryDir)) {
        return;
    }
    // collect potential archives
    let folders = (await fs.readdir(libraryDir)).map((f) => path.join(libraryDir, f));
    if (await fs.exists(cacheDir)) {
        folders = folders.concat((await fs.readdir(cacheDir)).map((f) => path.join(cacheDir, f)));
    }
    const folderCandidates = await Promise.all(folders.map(d => extractDat(d)))
    // do migrations
    await fs.mkdir(newLibraryDir);
    await Promise.all(folderCandidates.filter((v) => v !== false).map(({ address, dir }) => {
        return fs.move(dir, path.join(newLibraryDir, address));
    }));
}