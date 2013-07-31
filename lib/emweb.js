var fs = require('fs');
var http = require('http');
var url = require('url');

exports.Server = function()
{
	this.do_cache_updates = true;
	this.drop_root_privilege = true;

	this.uid = parseInt(process.env.SUDO_UID);
	this.gid = parseInt(process.env.SUDO_GID);

	this.file_cache = {};
	this.content_types = {};
	this.content_caching = {};
	this.routes = {};
	this.cache_ignores = {};

	this.directory = process.cwd() + '/public/';
	this.routes.default = 'index.html';
	this.routes[404] = '404.html';

	this.date = new Date();
	this.date_iso = this.date.toISOString();
	this.date_interval = 250;

	this.port = 80;

	this.handlers = {
		fallback: function(request, response, request_url, data)
		{
			response.write(data);
		},
	};

	// cache a file from disk
	this.cache_file = function(name)
	{
		var parts = name.split('.');
		var ext = (parts.length > 1) ? parts[parts.length - 1] : '';

		if(this.cache_ignores[ext] != true)
		{
			try
			{
				var data = fs.readFileSync(this.directory + name);
				this.file_cache[name] = data;
				this.log('CACHE', 'cached ' + name);
			}
			catch(e)
			{
				delete this.file_cache[name];
				this.log('CACHE', 'uncached ' + name);
			}
		}
		else
		{
			this.log('CACHE', 'ignored ' + name);
		}
	}.bind(this);

	this.cache_all = function(dir)
	{
		fs.readdir(dir, function(err, files)
		{
			if(err)
			{
				this.log('CACHE', 'failed to cache files in `' + dir + '`');
			}
			else
			{
				this.log('CACHE', 'caching files in `' + dir + '`');
				for(var iFile in files)
				{
					var name = files[iFile];
					if(name.match(/^\./) || name.match(/~$/) || name === '4913') continue;
					this.cache_file(name);
				}
			}
		}.bind(this));
	}

	this.cache_watch = function(dir)
	{
		try
		{
			// set up a file system watch on dir
			fs.watch(dir, function(e, name)
			{
				// ignore vi/vim magic files
				if(name.match(/^\./) || name.match(/~$/) || name === '4913') return;

				switch(e)
				{
					case 'change':
					case 'rename':
						this.cache_file(name);
						break;
				}
			}.bind(this));
			this.log('CACHE', 'watching `' + dir + '`');
		}
		catch(e)
		{
			this.log('CACHE', 'failed to watch `' + dir + '`');
		}
	}.bind(this)

	this.init = function()
	{
		// start asynchronous date updates
		setInterval(function()
		{
			this.date.setTime(Date.now());
			this.date_iso = this.date.toISOString();
		}.bind(this), this.date_interval);

		// store the date and time the server was started at
		this.start_date = new Date(this.date.getTime());

		// cache all files in the public directory
		this.cache_all(this.directory);

		if(this.do_cache_updates)
		{
			// watch the public directory
			this.cache_watch(this.directory);
		}

		this.server = http.createServer();
		this.log('HTTP', 'created');

		this.server.on('request', this.cb_request);
		this.server.on('checkContinue', this.cb_checkContinue);

		return this;
	}.bind(this)

	this.listen = function(emitter)
	{
		var cb_listen = function(err)
		{
			if(err)
			{
				console.log(err);
				if(emitter) emitter.emit('error', err);
			}

			if(this.drop_root_privilege === true)
			{
				if(!isNaN(this.gid)) process.setgid(this.gid);
				if(!isNaN(this.uid)) process.setuid(this.uid);
			}

			if(!err && emitter) emitter.emit('success', this);
		}.bind(this);

		this.server.listen(this.port, cb_listen);

		var addr = this.server.address();

		if(addr !== null)
		{
			this.log('HTTP', 'listening on ' + addr.address + ':' + addr.port);
		}
		else
		{
			this.log('HTTP', 'failed to bind to port');
		}
	}.bind(this);

	// start the server
	this.start = function()
	{
		this.init();
		this.listen();
	}.bind(this);

	// receive requests and respond to them
	this.cb_request = function(request, response)
	{
		var request_url = url.parse(request.url, true);
		var safe_pathname = request_url.pathname.replace(/[^A-Za-z0-9_\-\.%]/g, '');
		var safe_path = (safe_pathname !== '') ? safe_pathname : this.routes.default;

		this.log('HTTP', 'request from ' + request.socket.remoteAddress + ' for ' + safe_path);

		response.statusCode = 200;
		this.do_route(safe_path, request, response, request_url, false);
	}.bind(this);

	this.do_route = function(safe_path, request, response, request_url, fallback_404)
	{
		var parts = safe_path.split('.');
		var ext = (parts.length > 1) ? parts[parts.length - 1] : 'html';
		var content_type = (this.content_types[ext] !== undefined) ? this.content_types[ext] : 'text/html';
		var route = 'fallback';

		if(this.handlers[ext] !== undefined) route = ext;
		else if(this.routes[safe_path] !== undefined)
		{
			if(typeof this.routes[safe_path] === 'string')
			{
				this.do_route(this.routes[safe_path], request, response, request_url, false);
				return;
			}
			else if(typeof this.routes[safe_path] === 'function')
			{
				if(this.routes[safe_path].call(this, request, response, request_url, '') !== false)
				{
					response.end();
				}
				return;
			}
		}

		var data = this.file_cache[safe_path];

		if(this.cache_ignores[ext] === true)
		{
			try
			{
				data = fs.readFileSync(this.directory + safe_path);
			}
			catch(e)
			{

			}
		}

		if(data === undefined || typeof this.handlers[route] !== 'function')
		{
			this.log('ERROR', '404 Not Found');
			response.statusCode = 404;

			if(fallback_404)
			{
				response.setHeader('Content-Type', 'text/plain');
				response.write('404 Not Found\n404 Not Found for 404 Not Found document');
				response.end();
			}
			else
			{
				if(this.do_route(this.routes[404], request, response, request_url, true) !== false)
				{
					response.end();
				}
			}
		}
		else
		{
			response.setHeader('Content-Type', content_type);
			if(this.handlers[route].call(this, request, response, request_url, data) !== false)
			{
				response.end();
			}
		}
	}.bind(this)

	// prevent uploads which eat memory and other important stuff
	this.cb_checkContinue = function(request, response)
	{
		response.writeHead(400);
		response.end();
		request.socket.end();
	}

	this.log = function(plugin, message)
	{
		console.log(this.date_iso + ' [' + plugin + '] ' + message);
	}
}
