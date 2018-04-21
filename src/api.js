const DatGateway = require('dat-gateway');
const DatArchive = require('node-dat-archive')
const library = require('./library');
const getArchive = library.getArchive;

const gateway = new DatGateway({
    dir: '.dat-gateway',
    max: 20,
    maxAge:  10 * 60 * 1000,
});

module.exports = {
    supportedActions: () => Promise.resolve(Object.keys(handlers)),
    apiVersion: () => Promise.resolve(1),
    startGateway: ({ port=3000 }) => {
        return gateway.listen(port);
    },
    // DatArchive static methods
    resolveName: (message) => DatArchive.resolveName(message.name),
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
};
