const { log } = require('console');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MAX_REDIRECTS = 3;

const checkM3UAvaliable = async (url) => {
    const response = await fetch(url, { method: 'HEAD' })

    return response.ok
}

const server = http.createServer((req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': '*', /* @dev First, read about security */
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Max-Age': 2592000, // 30 days
      };


    if (req.method === 'GET') {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const url = params.get('url');

        if (!url) {
            res.statusCode = 400;
            res.end('URL parameter is required');
            return
        }

        
        res.writeHead(200, {
            ...headers,
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ 
            success: true,
            url 
        }));

        return;
    }

    if (req.method !== 'POST') {
        res.statusCode = 404;
        res.end();        
    }

    const chunks = [];
        
    req.on('data', (chunk) => chunks.push(chunk));
    
    req.on('end', () => {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        
        if (!checkM3UAvaliable(data.url)) {
            res.statusCode = 404;
            res.end('URL is not available');
        }

        const redirects = 0;
        const fileName = path.join(__dirname, 'file.m3u');
        const file = fs.createWriteStream(fileName);
        const getFile = (url) => {
            http.get(url, (response) => {
                if (response.headers.location) {
                    if (redirects >= MAX_REDIRECTS) {
                        fs.unlink(fileName, () => {
                            res.statusCode = 500;
                            res.end('Too many redirects');
                        });
                        return;
                    }
    
                    log('Redirecting to', response.headers.location);
                    // if the URL has been moved, download the file from the new location
                    getFile(response.headers.location);
                    return;
                }
        
                response.pipe(file);
        
                file.on('finish', () => {
                    file.close(() => {
                        // send the file to the client
                        res.writeHead(200, {
                            ...headers,
                            'Content-Type': 'text/plain'
                        });
                        // res.setHeader('Content-Type', 'application/octet-stream');
                        // res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                        fs.createReadStream(fileName).pipe(res);
                    });
                });
            }).on('error', (err) => {
                fs.unlink(fileName, () => {
                    res.statusCode = 500;
                    res.end('Error downloading file');
                });
            });
        };


        getFile(data.url);
    });
});

const port = 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});