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

const datOpts = {
    persist: true,
    autoSwarm: true,
    sparse: true
};

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
        }, datOpts)
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
            const loadLibrary = library.map(async ({ dir, url }) => {
                try {
                    const address = await dns.resolveName(url);
                    const dat = await this.node.getDat(address, datOpts);
                    await dat.ready;
                    const archive = createDatArchive(dat.drive);
                    this.archives.set(host, archive);
                } catch (e) {
                    // failed to load archive, remove from library
                    await storage.removeItem(url);
                }
            });
            await Promise.all(loadLibrary);
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
        const host = await dns.resolveName(url);
        if (this.node.dats.has(host)) {
            this.node.dats.get(host).close();
        }
        this.archives.delete(host);
        this.archiveUsage.delete(host);
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
        const dat = await this.node.getDat(address, datOpts);
        await dat.ready;
        const archive = createDatArchive(dat.drive);
        return archive;
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
        const archive = await create(this.node, datOpts, opts);
        const { host } = await dns.resolveName(archive.url);
        this.archives.set(host, archive);
        
        storage.setItem(archive.url, { dir: `${this.libraryDir}/dat1/${host}/`, url: archive.url, owner: true, description: opts.description });
        return archive.url;
    }

    async forkArchive(srcArchiveUrl, opts) {
        const srcAddress = await dns.resolveName(srcArchiveUrl);
        const srcDat = await this.node.getDat(srcAddress, datOpts);
        const dstArchive = await fork(this.node, srcDat.drive, datOpts, opts);
        return dstArchive.url;
    }
}

module.exports = Library;
