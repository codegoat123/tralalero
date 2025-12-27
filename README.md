# Doge Proxy - Web Proxy Service

A powerful web proxy service similar to Doge Unblocker, built with Node.js.

## Features

- 🚀 Fast proxying using node-fetch
- 🌐 HTML rewriting with jsdom for proper URL handling
- 🔒 Removes frame-busting code
- 📱 Responsive design
- ⚡ Redirect handling
- 🎮 Gaming site support

## Quick Start

### Install Dependencies
```bash
npm install --prefix /workspace/doge-proxy
```

### Start Server
```bash
cd /workspace/doge-proxy
npm start
```

### Usage
1. Open `http://localhost:3000`
2. Enter any website URL
3. Click "Go!" to open it through the proxy

## Deploying to Render.com (Free)

1. Create a GitHub repository with this code
2. Go to [Render.com](https://render.com) and sign up
3. Create a new Web Service
4. Connect your GitHub repository
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Create the service (free tier available)

## File Structure

```
doge-proxy/
├── package.json      # Node.js dependencies
├── server.js         # Main proxy server
└── README.md         # This file
```

## How It Works

1. User enters a URL on the homepage
2. Server fetches the target URL using node-fetch
3. HTML is parsed with jsdom
4. All links and resources are rewritten to go through the proxy
5. Frame-busting code is removed
6. Modified HTML is sent back to the browser
7. All subsequent clicks stay within the proxy

## Best Sites to Use

- ✅ Wikipedia
- ✅ W3Schools
- ✅ GitHub
- ✅ Stack Overflow
- ✅ Documentation sites

## Limitations

- ⚠️ Some sites actively block proxies
- ⚠️ Complex JavaScript apps may not work fully
- ⚠️ WebSocket connections not supported
- ⚠️ Google, Facebook, Netflix may block access

## Tech Stack

- Express.js - Web server framework
- node-fetch - HTTP requests
- jsdom - HTML parsing and manipulation

## License

MIT License
