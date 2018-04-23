const fs = require('fs');
const process = require('process');
const path = require('path');
const DatArchive = require('node-dat-archive')
const parseDatURL = require('parse-dat-url')
const storage = require('node-persist');
const pda = require('pauls-dat-api');

const libraryDir = path.join(process.cwd(), 'library');
// open and active archives
const archives = new Map();

// create library dir if it does not exist
if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir);
}

const storageReady = storage.init({ dir: `${libraryDir}/.metadata`});

storageReady.then(async () => {
    const library = await listLibrary();
    if (library) {
        // library exists, open archives in it
        library.forEach(async ({ dir }) => {
            const archive = await DatArchive.load({
                localPath: dir,
                datOptions: {
                    latest: true,
                }
            });
            const { host } = parseDatURL(archive.url);
            archives.set(host, archive);
        });
    }
});

async function listLibrary() {
    await storageReady;
    return storage.values();
}

function getArchive(url) {
    const { host } = parseDatURL(url);
    if (!archives.has(host)) {
        archives.set(host, new DatArchive(url));
    }
    return archives.get(host);
}

function formatArchiveName(name) {
    return name.replace(' ', '-').replace('/', '_').replace('\\', '_');
}

async function createArchive(opts) {
    const { title, description, type } = opts;
    let dir = path.join(libraryDir, formatArchiveName(title));
    // prevent duplicate directory
    if (fs.existsSync(dir)) {
        let i = 1;
        const dirN = (n) => `${dir}_${n}`;
        while (fs.existsSync(dirN(i))) {
            i += 1;
        }
        dir = dirN(i);
    }

    const archive = await DatArchive.create({
        localPath: dir,
        title,
        description,
        type,
        datOptions: {
            latest: true,
        },
    });
    const { host } = parseDatURL(archive.url);
    storage.setItem(archive.url, { dir, url: archive.url, owner: true, description });
    archives.set(host, archive);
    return archive.url;
}

const DAT_PRESERVED_FIELDS_ON_FORK = [
    'web_root',
    'fallback_page',
    'links'
];

async function forkArchive(srcArchiveUrl, opts) {
    // based on beaker implementation at: https://github.com/beakerbrowser/beaker/blob/master/app/background-process/networks/dat/library.js

    // get source archive and download the contents
    const { host } = parseDatURL(srcArchiveUrl);
    const srcArchive = getArchive(host);
    await srcArchive.download('/', { timeout: 60000 });

    // get manifest of the source archive
    const srcManifest = await pda.readManifest(srcArchive._archive).catch(_ => {});
    // create manifest for new archive
    const dstManifest = {
        title: (opts.title) ? opts.title : srcManifest.title,
        description: (opts.description) ? opts.description : srcManifest.description,
        type: (opts.type) ? opts.type : opts.type,
    }
    DAT_PRESERVED_FIELDS_ON_FORK.forEach(field => {
        if (srcManifest[field]) {
            dstManifest[field] = srcManifest[field]
        }
    });
    const dstArchiveUrl = await createArchive(dstManifest);
    const dstArchive = getArchive(dstArchiveUrl);
    await pda.updateManifest(dstArchive._archive, dstManifest);
    await pda.exportArchiveToArchive({
        srcArchive: srcArchive._archive,
        dstArchive: dstArchive._archive,
        skipUndownloadedFiles: true,
        ignore: ['/.dat', '/.git', '/dat.json'],
    });
    return dstArchive.url;
}

module.exports = {
    getArchive,
    createArchive,
    forkArchive,
    listLibrary,
}