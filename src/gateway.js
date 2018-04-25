const http = require('http');
const mime = require('mime');
const joinPaths = require('path').join;
const pump = require('pump')
const parseDatURL = require('parse-dat-url');
const pda = require('pauls-dat-api');

const library = require('./library');

class DatGateway {
    constructor() {
        this.server = http.createServer(async (req, res) => {
            try {
                await this.handleRequest(req, res);
            } catch(e) {
                res.statusCode = 500;
                res.end(e.toString());
            }
        });
    }

    listen (port) {
        return new Promise((resolve, reject) => {
          this.server.listen(port, (err) => {
            if (err) return reject(err)
            else return resolve()
          })
        })
    }

    async handleRequest(req, res) {
        // mimic beakerbrowser's dat protocol handling for the web.
        // Cribbed from https://github.com/beakerbrowser/beaker/blob/master/app/background-process/protocols/dat.js
        // minor minor alterations
        const errorResponse = (code, message) => {
            res.statusCode = code;
            res.end(message);
        }

        const { host, path, version, search } = parseDatURL(req.url);

        if (!host) {
            errorResponse(404, 'Archive Not Found');
            return;
        }
        if (['GET', 'HEAD'].indexOf(req.method) === -1) {
            errorResponse(405, 'Method Not Supported');
            return;
        }
        const archive = library.getArchive(`dat://${host}`);
        const filePath = decodeURIComponent(path).split('?')[0] || '/';
        const isFolder = filePath.endsWith('/');

        await archive._loadPromise;
        const manifest = await pda.readManifest(archive._archive).catch(_ => {});

        // CSP in manifest
        if (manifest && manifest.content_security_policy && typeof manifest.content_security_policy === 'string') {
            res.setHeader('Content-Security-Policy', manifest.content_security_policy);
        }

        let entry = null;
        const tryStat = async (path) => {
            // abort if we've already found it
            if (entry) return
            // apply the web_root config
            if (manifest && manifest.web_root && !urlp.query.disable_web_root) {
                if (path) {
                    path = joinPaths(manifest.web_root, path)
                } else {
                    path = manifest.web_root
                }
            }
            // attempt lookup
            try {
                entry = await archive.stat(path)
                entry.path = path
            } catch (e) {}
        }

        if (!isFolder) {
            await tryStat(filePath)
            if (entry && entry.isDirectory()) {
                res.statusCode = 303;
                res.setHeader('Location', `${path}/${search}`);
                return;
            }
        }

        if (isFolder) {
            await tryStat(filePath + 'index.html')
            await tryStat(filePath + 'index.md')
            await tryStat(filePath)
        } else {
            await tryStat(filePath)
            await tryStat(filePath + '.html') // fallback to .html
        }

        // handle folder
        if (entry && entry.isDirectory()) {
            if (req.method === 'HEAD') {
                res.statusCode = 204;
                res.end('');
            } else {
                res.statusCode = 200;
                res.write(`Directory ${entry.path}`);
                res.end();
            }
            return;
        }

        if (!entry) {
            // check for a fallback page
            if (manifest && manifest.fallback_page) {
                await tryStat(manifest.fallback_page)
            }

            if (!entry) {
                errorResponse(404, 'Not Found');
                return;
            }
        }

        res.setHeader('Content-Length', entry.size);
        res.setHeader('Content-Type', mime.getType(entry.path));
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age: 60');
        res.statusCode = 200;
        if (req.method === 'HEAD') {
            res.end();
        }
        pump(archive._archive.createReadStream(entry.path), res);
    }
}

const gateway = new DatGateway();

module.exports = {
    startGateway: ({ port=3000 }) => {
        return gateway.listen(port);
    },
}