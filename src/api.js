const DatArchive = require('node-dat-archive')

function seralisableStat(stat) {
    return {
        ...stat,
        _isDirectory: stat.isDirectory(),
        _isFile: stat.isFile(),
    }
}

class ActivityStream {
    constructor(stream) {
        this.stream = stream;
        this.listeners = new Map();
        this.evntQueue = new Map();
        this.waitingResolve = new Map();
        this.lastPoll = Date.now();
    }

    addEventListener(name) {
        if (this.listeners.has(name)) {
            return;
        }
        this.evntQueue.set(name, []);
        this.listeners.set(name, this.stream.addEventListener(name, (ev) => {
            if (this.waitingResolve.has(name)) {
                this.waitingResolve.get(name)([ev]);
            } else {
                const queue = this.evntQueue.get(name) || [];
                queue.push(ev);
                this.evntQueue.set(name, queue);
            }
        }));
    }

    take(name, timeout) {
        this.addEventListener(name);
        this.lastPoll = Date.now();
        const queue = this.evntQueue.get(name);
        if (queue && queue.length > 0) {
            this.evntQueue.delete(name);
            return Promise.resolve(queue);
        }
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.waitingResolve.delete(name);
                resolve([]);
            }, timeout || 10000);
            this.waitingResolve.set(name, (evs) => {
                this.waitingResolve.delete(name);
                clearTimeout(timer);
                resolve(evs);
            });
        });
    }

    close() {
        // flush waiting polls
        this.waitingResolve.forEach((resolve, name) => {
            resolve(this.evntQueue.get(name) || []);
        });
        this.stream.close();
    }
}

let streamIdx = 1;
const activeStreams = new Map();

// clean unclosed streams
setInterval(() => {
    const now = Date.now();
    activeStreams.forEach((stream, id) => {
        if (now - stream.lastPoll > 60000) {
            stream.close();
            activeStreams.delete(id);
        }
    });
}, 60000)

module.exports = ({ getArchive, createArchive, forkArchive }) => ({
    apiVersion: () => Promise.resolve(1),
    // DatArchive static methods
    resolveName: (message) => DatArchive.resolveName(message.name),
    create: ({ opts }) => createArchive(opts),
    fork: ({ url, opts }) => forkArchive(url, opts),
    // DatArchive class methods
    getInfo: async (message) => (await getArchive(message.url)).getInfo(message.opts),
    configure: async ({ url, opts }) => (await getArchive(url)).configure(opts),
    copy: async ({ url, path, dstPath, opts }) => (await getArchive(url)).copy(path, dstPath, opts),
    stat: async (message) => (await getArchive(message.url))
        .stat(message.path, message.opts)
        .then(s => seralisableStat(s)),
    readdir: async ({ url, path, opts }) => (await getArchive(url))
        .readdir(path, opts)
        .then((dir) => {
            if (opts && opts.stat) {
                return dir.map(({ name, stat }) => ({ name, stat: seralisableStat(stat) }));
            }
            return dir;
        }),
    history: async (message) =>  (await getArchive(message.url)).history(message.opts),
    readFile: async ({ url, path, opts }) => (await getArchive(url)).readFile(path, opts),
    writeFile: async ({ url, path, data, opts }) => (await getArchive(url)).writeFile(path, data, opts),
    mkdir: async ({ url, path }) => (await getArchive(url)).mkdir(path),
    unlink: async ({ url, path }) => (await getArchive(url)).unlink(path),
    rmdir: async ({ url, path, opts }) => (await getArchive(url)).rmdir(path, opts),
    rename: async({ url, oldPath, newPath, opts }) => (await getArchive(url)).rename(oldPath, newPath, opts),
    diff: async ({ url, opts }) =>(await getArchive(url)).diff(opts),
    commit: async ({ url }) => (await getArchive(url)).commit(),
    revert: async ({ url }) => (await getArchive(url)).revert(),
    download: async ({ url, path, opts }) =>(await getArchive(url)).download(path, opts),
    createFileActivityStream: async ({ url, pattern }) => {
        const archive = await getArchive(url);
        await archive._loadPromise;
        const stream = new ActivityStream(archive.createFileActivityStream(pattern));
        const id = ++streamIdx;
        activeStreams.set(id, stream);
        return { streamId: id };
    },
    createNetworkActivityStream: async ({ url }) => {
        const archive = await getArchive(url);
        await archive._loadPromise;
        const stream = new ActivityStream(archive.createNetworkActivityStream());
        const id = ++streamIdx;
        activeStreams.set(id, stream);
        return { streamId: id };
    },
    pollActivityStream: ({ streamId, event }) => {
        return activeStreams.get(streamId).take(event, 30000);
    },
    closeActivityStream: ({ streamId }) => {
        activeStreams.get(streamId).close();
        activeStreams.delete(streamId);
        return Promise.resolve({ streamId });
    },
});
