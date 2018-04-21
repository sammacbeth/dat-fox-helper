const fs = require('fs');
const DatArchive = require('node-dat-archive')

const libraryDir = './library';
if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir);
}
const library = new Map();

function getArchive(url) {
    if (!library.has(url)) {
        const path = url.replace('dat://', '');
        library.set(url, new DatArchive(url,  {
            localPath: `${libraryDir}/${path}`,
            datOptions: {
                latest: true,
            }
        }));
    }
    return library.get(url);
}

module.exports = {
    getArchive,
}