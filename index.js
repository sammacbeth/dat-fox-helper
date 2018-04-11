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

const handlers = {
    startGateway: ({ port=3000 }) => {
        return gateway.load().then(() => {
            return gateway.listen(port)
        });
    },
    resolveName: (message) => DatArchive.resolveName(message.name),
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
                error,
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
