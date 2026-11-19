'use strict';

const fs = require('node:fs');
const path = require('node:path');

module.exports = function fontHttpResponse () {
    const bytes = fs.readFileSync(path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf'));
    const requests = { interrupted: 0, complete: 0, cancelled: 0, resumed: 0 };
    function serveResumable(req, res) {
        const headers = { 'Content-Type': 'font/ttf', 'Content-Length': bytes.length,
            'accept-ranges': 'bytes', 'Cache-Control': 'no-store' };
        if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return; }
        if (req.headers.range === 'bytes=4096-') {
            ++requests.resumed;
            res.writeHead(206, { ...headers, 'Content-Range': `bytes 4096-${bytes.length - 1}/${bytes.length}`,
                'Content-Length': bytes.length - 4096 });
            res.end(bytes.subarray(4096));
            return;
        }
        res.writeHead(200, headers);
        res.write(bytes.subarray(0, 4096));
        // Keep the transfer open until the client cancels it. A timeout is a test failure.
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; res.destroy(); }, 8000);
        res.once('close', () => { clearTimeout(timeout); if (!timedOut) ++requests.cancelled; });
    }
    function serve (req, res) {
        res.writeHead(200, { 'Content-Type': 'font/ttf', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
        if (req.method === 'HEAD') { res.end(); return; }
        if (!requests.interrupted) {
            ++requests.interrupted;
            res.write(bytes.subarray(0, 4096), () => setTimeout(() => res.destroy(), 50));
            return;
        }
        ++requests.complete;
        res.end(bytes);
    }
    return { serve, serveResumable, requests };
};
