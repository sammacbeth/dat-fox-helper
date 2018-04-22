const DatArchive = require('node-dat-archive')
const { getArchive, createArchive, forkArchive, listLibrary } = require('./library');

module.exports = {
    apiVersion: () => Promise.resolve(1),
    // DatArchive static methods
    resolveName: (message) => DatArchive.resolveName(message.name),
    create: ({ opts }) => createArchive(opts),
    fork: ({ url, opts }) => forkArchive(url, opts),
    // DatArchive class methods
    getInfo: (message) => getArchive(message.url).getInfo(message.opts),
    stat: (message) => getArchive(message.url).stat(message.path, message.opts),
    readdir: (message) => getArchive(message.url).readdir(message.path, message.opts),
    history: (message) => getArchive(message.url).history(message.opts),
    readFile: ({ url, path, opts }) => getArchive(url).readFile(path, opts),
    writeFile: ({ url, path, data, opts }) => getArchive(url).writeFile(path, data, opts),
    mkdir: ({ url, path }) => getArchive(url).mkdir(path),
    unlink: ({ url, path }) => getArchive(url).unlink(path),
    rmdir: ({ url, path, opts }) => getArchive(url).rmdir(path, opts),
    diff: ({ url, opts }) => getArchive(url).diff(opts),
    commit: ({ url }) => getArchive(url).commit(),
    revert: ({ url }) => getArchive(url).revert(),
    download: ({ url, path, opts }) => getArchive(url).download(path, opts),
    // library management
    listLibrary,
};
