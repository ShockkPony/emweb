# emweb [![Build Status](https://travis-ci.org/ShockkPony/emweb.png?branch=master)](https://travis-ci.org/ShockkPony/emweb)

emweb is a micro web server designed to be lightweight and efficient. emweb supports [mods](https://npmjs.org/package/mods).

## Usage

### Installation

```
$ npm install emweb
```

### Quick Start

To set up a basic web server:

##### index.js
```javascript
var emweb = require('emweb');
var server = new emweb.Server();
server.start();
```

By default, the server reads files from `./public/`. All files should be placed in here as forward slashes are stripped from requests. The server requires root privileges to run as it listens on port 80, the standard port used for HTTP.

```
$ sudo node index
```

The server drops root privileges as soon as it is listening on port 80. This can be verified by running `ps -u`.

### Example

The server attempts to read additional config from `./config.js` by default.

##### index.js
```javascript
var server = new require('emweb').start();
```

##### config.js
```javascript
module.exports = function()
{
	// change the public directory
	this.directory = '/var/www/';

	// set user id and group id - must be able to read /var/www/
	this.uid = 'emweb';
	this.gid = 'emweb';

	// change the index page from index.html to home.html
	this.routes.default = 'home.html';

	// change the 404 page from 404.html to notfound.html
	this.routes[404] = 'notfound.html';

	// map common file types to content types
	this.content_types.css = 'text/css';
	this.content_types.png = 'image/png';
	this.content_types.gif = 'image/gif';
	this.content_types.mp4 = 'video/mp4';
	this.content_types.txt = 'text/plain';
	this.content_types.getjson = 'application/json';

	// ignore caching all mp4 files
	this.cache_ignores.mp4 = true;

	// ignore caching png files IF over 400KiB in size
	this.cache_ignores.png = 409600;

	// ignore caching OTHER files IF over 100KiB in size
	this.cache_ignores.default = 102400;

	// don't handle certain file types
	this.handlers.log = false;
	this.handlers.bak = false;
	this.handlers.db = false;
	this.handlers.json = false;

	// an example handler, just for demonstration purposes
	this.handlers.getjson = function(request, response, request_url, data)
	{
		response.write(data);
	}

	// listen on port 1337
	this.port = 1337;

	// bind to all ipv4 AND ipv6 hosts
	this.bind_host = '::';

	// disable logging
	this.do_log = false;

	// for some weird reason, change the default content type to javascript
	this.content_types.default = 'application/javascript';
}
```
