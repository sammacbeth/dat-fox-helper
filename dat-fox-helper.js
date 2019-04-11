#!/usr/bin/env node
const path = require('path');
const browser = require('./src/browser');
const datApi = require('./src/api');
const DatGateway = require('./src/gateway');
const Library = require('./src/library');
const version = require('./package.json').version;

const libraryDir = path.join(process.cwd(), 'library');
const library = new Library(libraryDir);
library.init();
const gateway = new DatGateway(library);

const handlers = {
    supportedActions: () => Promise.resolve(Object.keys(handlers)),
    getVersion: () => Promise.resolve(version),
    listLibrary: () => library.listLibrary(),
    getOpenArchives: () => Promise.resolve(library.getOpenArchives()),
    removeFromLibrary: ({ url }) => library.remove(url),
    closeArchive: ({ url }) => library.close(url),
};
// collect available APIs
Object.assign(handlers, datApi({
    getArchive: library.getArchive.bind(library),
    createArchive: library.createArchive.bind(library),
    forkArchive: library.forkArchive.bind(library),
}), {
    startGateway: ({ port=3000 }) => {
        return gateway.listen(port);
    },
});

// make API available over native messaging via stdio
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
                error: error.toString(),
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
