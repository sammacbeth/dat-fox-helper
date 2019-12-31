const apiFactory = require('@sammacbeth/dat-api-v1').default;
const { create, fork, default: createDatArchive } = require('@sammacbeth/dat-archive');
const fs = require('fs');
const process = require('process');
const path = require('path');
const storage = require('node-persist');
const rimraf = require('rimraf');
const raf = require('random-access-file');
const dns = require('./dns');
const migrate = require('./migrate');

const DAT_PRESERVED_FIELDS_ON_FORK = [
    'web_root',
    'fallback_page',
    'links'
];

function formatArchiveName(name) {
    return name.replace(' ', '-')
    .replace('/', '_')
    .replace('\\', '_')
    .replace(':', '_');
}

class Library {
    constructor(libraryDir) {
        this.libraryDir = libraryDir;
        this.datDir = `${this.libraryDir}/dat1`;
        // open and active archives
        this.archives = new Map();
        this.archiveUsage = new Map();
        this.node = apiFactory({
            persistantStorageFactory: (key) => Promise.resolve((f) => {
                return raf(`${this.datDir}/${key}/${f.replace('/', '.')}`);
            }),
            persistantStorageDeleter: (key) => new Promise((resolve) => {
                rimraf(`${this.datDir}/${key}`, resolve);
            }),
        }, { persist: true, autoSwarm: true })
    }

    async init() {
        // create library dir if it does not exist
        if (!fs.existsSync(this.libraryDir)) {
            fs.mkdirSync(this.libraryDir);
        }
        await migrate(this.libraryDir, this.node);
        this.ready = await storage.init({ dir: `${this.libraryDir}/.metadata` });
        const library = await this.listLibrary();
        if (library) {
            // library exists, open archives in it
            /*
            const loadLibrary = library.map(async ({ dir, url }) => {
                try {
                    const archive = await DatArchive.load({
                        localPath: dir,
                        datOptions: {
                            latest: true,
                        }
                    });
                    const { host } = parseDatURL(archive.url);
                    this.archives.set(host, archive);
                } catch (e) {
                    // failed to load archive, remove from library
                    await storage.removeItem(url);
                }
            });
            await Promise.all(loadLibrary);
            */
        }
        // TODO: add other dats in folder
    }

    async listLibrary() {
        await this.ready;
        return storage.values();
    }

    async remove(url) {
        // remove from library
        await this.ready;
        const archiveInfo = await storage.getItem(url);
        if (!archiveInfo) {
            throw new Error('Archive not in library');
        }
        // close archive
        await this.close(url);
        await storage.removeItem(url);
        return archiveInfo;
    }

    async close(url) {
        const { host } = parseDatURL(url);
        const archive = await this.getArchive(url);
        this.archives.delete(host);
        this.archiveUsage.delete(host);
        await archive._close();
    }

    getOpenArchives() {
        return [...this.archives.entries()].map(([host, archive]) => ({
            host,
            url: archive.url,
            lastUsed: this.archiveUsage.get(host),
        }));
    }

    async ensureCacheDir() {
        const exists = await new Promise(resolve => !fs.exists(this.datDir, resolve));
        if (!exists) {
            await new Promise(resolve => !fs.mkdir(this.datDir, resolve));
        }
    }

    async createTempArchive(address) {
        await this.ensureCacheDir();
        const dat = await this.node.getDat(address, { persist: true, autoSwarm: true });
        await dat.ready;
        const archive = createDatArchive(dat.drive);
        return archive;
        // const archiveDir = `${this.datDir}/${address}`;
        // const exists = await new Promise(resolve => !fs.exists(archiveDir, resolve));
        // if (exists) {
        //     return DatArchive.load({
        //         localPath: archiveDir,
        //         datOptions: {
        //             latest: true,
        //         },
        //     });
        // }
        // return new DatArchive(address, {
        //     localPath: archiveDir,
        //     datOptions: {
        //         latest: true,
        //     },
        // });
    }

    async getArchive(url) {
        const host = await dns.resolveName(url);
        if (!this.archives.has(host)) {
            this.archives.set(host, await this.createTempArchive(host));
        }
        this.archiveUsage.set(host, Date.now());
        return this.archives.get(host);
    }

    async createArchive(opts) {
        const { title, description, type } = opts;
        let dir = path.join(this.libraryDir, formatArchiveName(title));
        // prevent duplicate directory
        if (fs.existsSync(dir)) {
            let i = 1;
            const dirN = (n) => `${dir}_${n}`;
            while (fs.existsSync(dirN(i))) {
                i += 1;
            }
            dir = dirN(i);
        }
        const { host } = parseDatURL(archive.url);
        this.archives.set(host, archive);

        const archive = await create(this.node, { persist: true }, opts);

        const archive = await DatArchive.create({
            localPath: dir,
            title,
            description,
            type,
            datOptions: {
                latest: true,
            },
        });
        
        storage.setItem(archive.url, { dir, url: archive.url, owner: true, description });
        return archive.url;
    }

    async forkArchive(srcArchiveUrl, opts) {
        // based on beaker implementation at: https://github.com/beakerbrowser/beaker/blob/master/app/background-process/networks/dat/library.js

        // get source archive and download the contents
        const { host } = parseDatURL(srcArchiveUrl);
        const srcArchive = await this.getArchive(host);
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
        const dstArchiveUrl = await this.createArchive(dstManifest);
        const dstArchive = await this.getArchive(dstArchiveUrl);
        await pda.updateManifest(dstArchive._archive, dstManifest);
        await pda.exportArchiveToArchive({
            srcArchive: srcArchive._archive,
            dstArchive: dstArchive._archive,
            skipUndownloadedFiles: true,
            ignore: ['/.dat', '/.git', '/dat.json'],
        });
        return dstArchive.url;
    }
}

module.exports = Library;
