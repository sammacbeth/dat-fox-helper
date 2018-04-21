#!/home/sam/.nvm/versions/node/v9.9.0/bin/node
const browser = require('./src/browser');
const handlers = require('./src/api');

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
