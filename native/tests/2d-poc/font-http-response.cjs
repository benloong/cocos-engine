'use strict';

const fs = require('node:fs');
const path = require('node:path');

module.exports = function fontHttpResponse () {
    const bytes = fs.readFileSync(path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf'));
    const requests = { interrupted: 0, complete: 0 };
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
    return { serve, requests };
};
