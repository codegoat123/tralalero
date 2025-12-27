/**
 * Doge Proxy - A powerful web proxy service
 * Uses node-fetch and jsdom for HTML processing
 */

const express = require('express');
const path = require('path');
const http = require('http');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache configuration
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
});

// Proxy prefix
const PROXY_PREFIX = '/proxy/';

// HTML content modifier using jsdom
function modifyHtml(html, targetUrl) {
    const dom = new JSDOM(html, { url: targetUrl });
    const document = dom.window.document;
    const url = new URL(targetUrl);
    
    // Get all elements with href or src attributes
    const linkSelectors = [
        'a[href]',
        'link[href]',
        'script[src]',
        'img[src]',
        'iframe[src]',
        'embed[src]',
        'object[data]',
        'source[src]',
        'video[src]',
        'audio[src]',
        'form[action]'
    ];
    
    linkSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            let attr = el.tagName === 'A' || el.tagName === 'FORM' ? 'href' : 'src';
            if (el.tagName === 'FORM') attr = 'action';
            
            const originalValue = el.getAttribute(attr);
            if (!originalValue || 
                originalValue.startsWith('#') || 
                originalValue.startsWith('mailto:') ||
                originalValue.startsWith('tel:') ||
                originalValue.startsWith('javascript:')) {
                return;
            }
            
            try {
                const resolvedUrl = new URL(originalValue, targetUrl).href;
                const resolvedOrigin = new URL(resolvedUrl).origin;
                
                if (resolvedOrigin !== url.origin) {
                    // External link - open in new tab
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
                
                // Rewrite to go through proxy
                el.setAttribute(attr, PROXY_PREFIX + resolvedUrl);
            } catch (e) {
                console.log('Error processing URL:', originalValue);
            }
        });
    });
    
    // Remove frame-busting scripts
    document.querySelectorAll('script').forEach(script => {
        const content = script.textContent || '';
        if (content.includes('top.location') || 
            content.includes('frame busting') ||
            content.includes('if (top != self)')) {
            script.textContent = '// Frame busting removed';
        }
    });
    
    // Add base tag
    if (!document.querySelector('base')) {
        const base = document.createElement('base');
        base.href = url.origin + '/';
        base.target = '_blank';
        document.head.insertBefore(base, document.head.firstChild);
    }
    
    return dom.serialize();
}

// Main proxy route
app.all('/proxy/*', async (req, res) => {
    try {
        // Extract target URL from the path
        let targetUrl = req.params[0];
        
        if (!targetUrl) {
            return res.redirect('/');
        }
        
        // Add protocol if missing
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
        
        const url = new URL(targetUrl);
        
        console.log(`[${new Date().toISOString()}] Proxying: ${req.method} ${targetUrl}`);
        
        // Fetch the target URL
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': req.headers.accept || 'text/html,application/xhtml+xml,*/*',
                'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
                'Referer': url.origin
            },
            redirect: 'manual'
        });
        
        // Handle redirects
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            const redirectUrl = new URL(response.headers.get('location'), targetUrl).href;
            console.log(`Redirecting to: ${redirectUrl}`);
            return res.redirect('/proxy/' + redirectUrl);
        }
        
        const contentType = response.headers.get('content-type') || '';
        const buffer = await response.buffer();
        
        // For HTML content, modify it
        if (contentType.includes('text/html')) {
            try {
                const decoder = new TextDecoder('utf-8');
                const html = decoder.decode(buffer);
                const modifiedHtml = modifyHtml(html, targetUrl);
                
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(modifiedHtml);
            } catch (parseError) {
                console.error('HTML parse error:', parseError);
                res.set('Content-Type', contentType);
                res.send(buffer);
            }
        }
        // For other content types, pass through
        else {
            // Filter headers
            const safeHeaders = ['content-type', 'content-length', 'cache-control', 'last-modified', 'etag'];
            response.headers.forEach((value, key) => {
                if (safeHeaders.includes(key.toLowerCase())) {
                    res.set(key, value);
                }
            });
            
            res.set('X-Proxy-By', 'DogeProxy');
            res.status(response.status);
            res.send(buffer);
        }
        
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(502).send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Proxy Error</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            backdrop-filter: blur(10px);
            max-width: 500px;
        }
        h1 { color: #f9d423; margin-bottom: 20px; }
        p { color: #ccc; margin-bottom: 20px; line-height: 1.6; }
        .error { color: #ff4e50; font-family: monospace; margin: 20px 0; padding: 10px; background: rgba(255,78,80,0.2); border-radius: 8px; }
        a {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(90deg, #f9d423, #ff4e50);
            color: #1a1a2e;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        a:hover { transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dogecoin Proxy Error</h1>
        <p>Could not access the requested website.</p>
        <div class="error">${error.message}</div>
        <a href="/">Go Back Home</a>
    </div>
</body>
</html>
        `);
    }
});

// API endpoint to test proxy
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Doge Proxy is running!',
        version: '1.0.0'
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doge Proxy - Fast & Free Web Proxy</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 80px 20px;
            text-align: center;
        }
        .logo {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 52px;
            margin-bottom: 15px;
            background: linear-gradient(90deg, #f9d423, #ff4e50, #f9d423);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
        }
        .subtitle {
            color: #a0a0a0;
            font-size: 20px;
            margin-bottom: 50px;
        }
        .search-box {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .input-group {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }
        input[type="text"] {
            flex: 1;
            padding: 18px 24px;
            border: none;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 16px;
            outline: none;
            transition: all 0.3s;
        }
        input[type="text"]::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        input[type="text"]:focus {
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 20px rgba(249, 212, 35, 0.3);
        }
        button {
            padding: 18px 40px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #f9d423, #ff4e50);
            color: #1a1a2e;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(249, 212, 35, 0.4);
        }
        .quick-links {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .quick-link {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            color: #ccc;
            text-decoration: none;
            font-size: 13px;
            transition: all 0.2s;
        }
        .quick-link:hover {
            background: rgba(249, 212, 35, 0.2);
            color: #f9d423;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-top: 60px;
        }
        .feature {
            background: rgba(255, 255, 255, 0.05);
            padding: 30px 20px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s;
        }
        .feature:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.08);
        }
        .feature-icon {
            font-size: 36px;
            margin-bottom: 15px;
        }
        .feature h3 {
            color: #f9d423;
            margin-bottom: 10px;
            font-size: 18px;
        }
        .feature p {
            color: #888;
            font-size: 13px;
            line-height: 1.5;
        }
        .info {
            margin-top: 50px;
            padding: 25px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            font-size: 14px;
            color: #666;
            line-height: 1.7;
        }
        .footer {
            margin-top: 40px;
            color: #444;
            font-size: 12px;
        }
        .footer a {
            color: #f9d423;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            h1 { font-size: 36px; }
            .input-group { flex-direction: column; }
            button { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🐕</div>
        <h1>Doge Proxy</h1>
        <p class="subtitle">Fast, Free & Unlimited Web Proxy</p>
        
        <div class="search-box">
            <form action="/proxy/" method="GET" target="_blank">
                <div class="input-group">
                    <input type="text" name="url" placeholder="Enter website URL (e.g., wikipedia.org, discord.com)" required>
                    <button type="submit">Go! 🚀</button>
                </div>
            </form>
            <div class="quick-links">
                <a href="/proxy/https://www.wikipedia.org" class="quick-link" target="_blank">Wikipedia</a>
                <a href="/proxy/https://www.w3schools.com" class="quick-link" target="_blank">W3Schools</a>
                <a href="/proxy/https://www.github.com" class="quick-link" target="_blank">GitHub</a>
                <a href="/proxy/https://www.stackoverflow.com" class="quick-link" target="_blank">Stack Overflow</a>
            </div>
        </div>
        
        <div class="features">
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3>Lightning Fast</h3>
                <p>Optimized servers for the fastest browsing experience</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🔒</div>
                <h3>Secure & Private</h3>
                <p>Hide your IP and encrypt your connection</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🌐</div>
                <h3>Unblock Any Site</h3>
                <p>Access blocked websites from anywhere</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🎮</div>
                <h3>Gaming Support</h3>
                <p>Play unblocked games online</p>
            </div>
        </div>
        
        <div class="info">
            <strong>How it works:</strong> Enter any website URL above and click "Go!" to open it through our proxy.
            All links and navigation within the proxied site will automatically be routed through our servers.
            <br><br>
            <strong>Best for:</strong> Wikipedia, W3Schools, GitHub, documentation sites, and general web browsing.
        </div>
        
        <div class="footer">
            Made with ❤️ using Node.js | <a href="#">Doge Proxy</a>
        </div>
    </div>
</body>
</html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║        Doge Proxy Server Started          ║
╠═══════════════════════════════════════════╣
║  Server running on port ${PORT}             ║
║  Open http://localhost:${PORT}               ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
