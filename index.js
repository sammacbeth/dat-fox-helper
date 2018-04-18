#!/usr/bin/env node

const process = require('process')
const DatGateway = require('dat-gateway');
const browser = require('./browser');
const DatArchive = require('node-dat-archive')

const gateway = new DatGateway({
    dir: '.dat-gateway',
    max: 20,
    maxAge:  10 * 60 * 1000,
});

const archives = new Map();

function getArchive(url) {
    if (!archives.has(url)) {
        const path = url.replace('dat://', '');
        archives.set(url, new DatArchive(url,  {
            localPath: `./archives/${path}`,
            datOptions: {
                latest: true,
            }
        }));
    }
    return archives.get(url);
}

const handlers = {
    supportedActions: () => Promise.resolve(Object.keys(handlers)),
    apiVersion: () => Promise.resolve(1),
    startGateway: ({ port=3000 }) => {
        return gateway.listen(port);
    },
    resolveName: (message) => DatArchive.resolveName(message.name),
    getInfo: (message) => getArchive(message.url).getInfo(message.opts),
    stat: (message) => getArchive(message.url).stat(message.path, message.opts),
    readdir: (message) => getArchive(message.url).readdir(message.path, message.opts),
    history: (message) => getArchive(message.url).history(message.opts),
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
