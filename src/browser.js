const process = require('process');

// Implementation of the extension native messaging protocol over stdio
let expected = null;
const empty = Buffer.alloc(0)
let buffer = empty;

const listeners = new Set();

function processData(data) {
    buffer = Buffer.concat([ buffer, data ]);

    if (expected == null) {
        // this is the start of a message, the length is in the first 4 bytes
        expected = buffer.readInt32LE(0);
        buffer = buffer.length > 4 ? buffer.slice(4) : empty;
    }
    if (buffer.length < expected) {
        // we didn't get all of the message yet
        return;
    }
    const message = JSON.parse(buffer.toString('utf8', 0, expected));
    listeners.forEach((fn) => {
        try {
            fn(message);
        } catch(e) {
            postMessage({ type: 'native_exception', error: e });
        }
    });
    buffer = buffer.length === expected ? empty : Buffer.from(buffer.slice(expected));
    expected = null;
    // check if there are more messages to process
    if (buffer.length > 0) {
        processData(Buffer.alloc(0));
    }
}
process.stdin.on('data', processData);

function postMessage(message) {
    const string = JSON.stringify(message);
    const length = Buffer.byteLength(string, 'utf8');
    const buffer = Buffer.allocUnsafe(4 + length);
    buffer.writeInt32LE(length);
    buffer.write(string, 4, length, 'utf8');
    process.stdout.write(buffer);
};

module.exports = {
    onMessage: {
        addListener(fn) {
            listeners.add(fn);
        }
    },
    postMessage,
};