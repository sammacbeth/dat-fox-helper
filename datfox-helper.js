#!/home/sam/.nvm/versions/node/v9.9.0/bin/node
const browser = require('./src/browser');
const datApi = require('./src/api');
const gateway = require('./src/gateway');
const version = require('./package.json').version;

const handlers = {
    supportedActions: () => Promise.resolve(Object.keys(handlers)),
    getVersion: () => Promise.resolve(version),
};
// collect available APIs
Object.assign(handlers, datApi, gateway);

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
