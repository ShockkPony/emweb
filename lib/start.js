var emweb = require('./emweb');
var server = new emweb.Server();

// content types
server.content_types.css = 'text/css';
server.content_types.js = 'application/javascript';
server.content_types.png = 'image/png';
server.content_types.jpg = 'image/jpeg';
server.content_types.jpeg = 'image/jpeg';
server.content_types.gif = 'image/gif';

// cache ignore files over 200KiB
server.cache_ignores.default = 204800;

// start the server
server.start();
