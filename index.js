#!/usr/bin/env node

const process = require('process')
const fs = require('fs');
const DatGateway = require('dat-gateway');
const browser = require('./browser');
const DatArchive = require('node-dat-archive')

const gateway = new DatGateway({
    dir: '.dat-gateway',
    max: 20,
    maxAge:  10 * 60 * 1000,
});

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

const handlers = {
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
}

browser.onMessage.addListener((message) => {
    const { id, action } = message;
    if (handlers[action]) {
        handlers[action](message).then((result) => {
            browser.postMessage({
                id,
                action,
                result,
            });
        }, (error) => {
            browser.postMessage({
                id,
                action,
                error: error,
            });
        });
    } else {
        browser.postMessage({
            id,
            action,
            error: 'unhandled_message',
            message,
        });
    }
});
