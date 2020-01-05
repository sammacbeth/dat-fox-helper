const http = require('http');
const mime = require('mime');
const joinPaths = require('path').join;
const pump = require('pump')
const parseDatURL = require('parse-dat-url');
const pda = require('pauls-dat-api');
const parseRange = require('range-parser');
const datProtocol = require('@sammacbeth/dat-protocol-handler');
const dns = require('./dns');

class DatGateway {
    constructor(library) {
        this.library = library;
        this.server = http.createServer(async (req, res) => {
            try {
                await this.handleRequest(req, res);
            } catch(e) {
                res.statusCode = 500;
                res.end(e.toString());
            }
        });
        // this.handler = datProtocol.default(library.node, dns.resolveName, { persist: true, autoSwarm: true });
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
        // with minor alterations
        const errorResponse = (code, message) => {
            res.statusCode = code;
            res.end(message);
        }

        if (['GET', 'HEAD'].indexOf(req.method) === -1) {
            errorResponse(405, 'Method Not Supported');
            return;
        }

        const url = req.url;
        const { host, pathname, version } = parseDatURL(url);

        try {
            const address = await dns.resolveName(host);
            const dat = await this.library.node.getDat(address, {
                persist: true,
                autoSwarm: true,
                sparse: true
            });
            await dat.ready;
            const result = await datProtocol.resolvePath(dat.drive, pathname, version);

            if (result.directory === true) {
                res.statusCode = 200;
                res.write(`Directory ${result.path}`);
                res.end();
                return
            }
            const size = new Promise((resolve) => {
                result.drive.stat(result.path, (err, stat) => {
                    resolve(stat.size);
                });
            })

            // handle range
            /*
            res.setHeader('Accept-Ranges', 'bytes');
            let range = req.headers.Range || req.headers.range;
            let start = 0;
            let end = 0;
            if (range) range = parseRange(size, range);
            if (range && range.type === 'bytes') {
                const sendRange = range[0];
                start = sendRange.start;
                end = sendRange.end;
                res.statusCode = 206;
                res.setHeader('Content-Range', `bytes ${sendRange.start}-${sendRange.end}/${size}`);
                res.setHeader('Content-Length', sendRange.end - sendRange.start + 1);
            } else {
                res.setHeader('Content-Length', size);
                res.statusCode = 200;
            }
            */

            res.setHeader('Content-Type', mime.getType(result.path));
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age: 60');
            if (req.method === 'HEAD') {
                res.end();
            }
            pump(result.drive.createReadStream(result.path), res);
        } catch (e) {
            if (e instanceof datProtocol.NotFoundError) {
                errorResponse(404, 'Archive Not Found');
                return;
            }
            if (e instanceof datProtocol.NetworkTimeoutError) {
                errorResponse(500, 'Timed out loading dat');
                return;
            }
            errorResponse(501, e.toString());
        }
       
        // TODO: CSP in manifest
        /*
        if (manifest && manifest.content_security_policy && typeof manifest.content_security_policy === 'string') {
            res.setHeader('Content-Security-Policy', manifest.content_security_policy);
        }
        */

        
    }
}

module.exports = DatGateway;
