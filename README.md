# emweb

emweb is a micro web server designed to be lightweight and efficient.

## Usage

### Installation

```
npm install emweb
```

### Quick Start

To set up a basic web server:

##### index.js
```javascript
var emweb = require('emweb');
var server = new emweb.Server();
server.start();
```

By default, the server listens on port 80, the standard port used for HTTP, this requires root privileges.

```
$ sudo node index
```

The server drops root privileges as soon as it is listening on port 80. This can be verified by running `ps -u`.

### Example

##### index.js
```javascript
var server = new require('emweb').start();

// change the index page from index.html to home.html
server.routes.default = 'home.html';

// change the 404 page from 404.html to notfound.html
server.routes[404] = 'notfound.html';

// map common file types to content types
server.content_types.css = 'text/css';
server.content_types.png = 'image/png';
server.content_types.gif = 'image/gif';
server.content_types.mp4 = 'video/mp4';
server.content_types.txt = 'text/plain';
server.content_types.getjson = 'application/json';

// ignore caching certain file types to avoid excessive memory usage
server.cache_ignores.png = true;
server.cache_ignores.mp4 = true;

// ignore certain file types
server.handlers.log = false;
server.handlers.bak = false;
server.handlers.db = false;
server.handlers.json = false;

// an example handler, just for demonstration purposes
server.handlers.getjson = function(request, response, request_url, data)
{
	response.write(data);
}

// start the server!
server.start();
```
