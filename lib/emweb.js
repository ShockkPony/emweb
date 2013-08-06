var fs = require('fs');
var http = require('http');
var url = require('url');

exports.Server = function()
{
	this.uid = parseInt(process.env.SUDO_UID);
	this.gid = parseInt(process.env.SUDO_GID);

	this.config_file = process.cwd() + '/config.js';

	this.reset_config = function()
	{
		this.process_title = 'emweb';

		this.file_cache = {};
		this.modified_cache = {};
		this.route_cache = {};
		this.content_types = {};
		this.content_caching = {};
		this.routes = {};
		this.cache_ignores = {};

		this.max_connections = 10;
		this.port = 80;

		this.directory = process.cwd() + '/public/';
		this.content_types.default = 'text/html';
		this.routes.default = 'index.html';
		this.routes[404] = '404.html';

		this.do_log = true;
		this.do_cache_updates = true;
		this.drop_root_privilege = true;

		this.date_interval = 250;

		// non-configurable options
		this.date = new Date();
		this.date_utc = this.date.toUTCString();
		this.date_iso = this.date.toISOString();
	}.bind(this);

	this.load_config = function()
	{
		this.reset_config();

		try
		{
			delete require.cache[require.resolve(this.config_file)];
			var config = require(this.config_file);
			if(typeof config === 'function') config.call(this);
			this.log('CONFIG', 'loaded `' + this.config_file + '`');
		}
		catch(e)
		{
			this.log('CONFIG', 'failed to load `' + this.config_file + '`');
		}
	}.bind(this);

	this.finish_config = function()
	{
		// set process title
		process.title = this.process_title;

		// start asynchronous date updates
		if(this.interval_date) clearInterval(this.interval_date);
		this.interval_date = setInterval(function()
		{
			this.date.setTime(Date.now());
			this.date_utc = this.date.toUTCString();
			this.date_iso = this.date.toISOString();
		}.bind(this), this.date_interval);

		// cache all files in the public directory
		this.cache_all(this.directory);

		// watch public directory
		if(this.fs_watch_cache) this.fs_watch_cache.close();
		if(this.do_cache_updates)
		{
			this.fs_watch_cache = this.cache_watch(this.directory);
		}
	}

	this.handlers = {
		fallback: function(request, response, request_url, data)
		{
			response.write(data);
		},
	};

	// cache a file from disk
	this.cache_file = function(name)
	{
		// clear route cache
		// TODO: find a better way to do this
		this.route_cache = {};

		var parts = name.split('.');
		var ext = (parts.length > 1) ? parts[parts.length - 1] : '';

		if(this.cache_ignores[ext] === true)
		{
			this.log('CACHE', 'ignored ' + name);
			return;
		}

		try
		{
			var filepath = this.directory + name;
			var stats = fs.statSync(filepath);

			if(!isNaN(this.cache_ignores[ext]))
			{
				if(stats.size > this.cache_ignores[ext])
				{
					this.log('CACHE', 'ignored ' + name);
					return;
				}
			}
			else if(!isNaN(this.cache_ignores.default))
			{
				if(stats.size > this.cache_ignores.default)
				{
					this.log('CACHE', 'ignored ' + name);
					return;
				}
			}

			if(!isNaN(this.cache_ignores[ext]) && stats.size > this.cache_ignores[ext])
			{
				this.log('CACHE', 'ignored ' + name);
				return;
			}

			var data = fs.readFileSync(filepath);
			var stats = fs.statSync(filepath);
			this.file_cache[name] = data;
			this.modified_cache[name] = stats.mtime.toUTCString();
			this.log('CACHE', 'cached ' + name);
		}
		catch(e)
		{
			if(this.file_cache[name])
			{
				delete this.file_cache[name];
				this.log('CACHE', 'uncached ' + name);
			}

			if(this.modified_cache[name])
			{
				delete this.modified_cache[name];
			}
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
	}.bind(this);

	this.init = function()
	{
		// watch config file
		try
		{
			if(this.fs_watch_config) this.fs_watch_config.close();
			this.fs_watch_config = fs.watch(this.config_file, function(e, name)
			{
				switch(e)
				{
					case 'change':
					case 'rename':
						this.load_config();
						this.finish_config();
						break;
				}
			}.bind(this));
			this.load_config();
		} catch(e) { console.log(e); }

		// finish loading initial config
		this.finish_config();

		// store the date and time the server was started at
		this.start_date = new Date(this.date.getTime());

		this.server = http.createServer();
		this.log('HTTP', 'created');

		this.server.maxConnections = this.max_connections;

		this.server.on('request', this.cb_request);
		this.server.on('checkContinue', this.cb_checkContinue);

		return this;
	}.bind(this);

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

			if(!err)
			{
				var addr = this.server.address();
				this.log('HTTP', 'listening on ' + addr.address + ':' + addr.port);
				if(emitter) emitter.emit('success', this);
			}
		}.bind(this);

		this.server.listen(this.port, this.bind_host, cb_listen);
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
		response.setHeader('Server', 'emweb');
		this.do_route(safe_path, request, response, request_url, false);
	}.bind(this);

	this.get_route = function(path, ext)
	{
		var route = 'fallback';

		if(this.handlers[ext] !== undefined) route = ext;
		else if(this.routes[path] !== undefined)
		{
			if(typeof this.routes[path] === 'string')
			{
				route = this.get_route(this.routes[path]);
			}
			else if(typeof this.routes[path] === 'function')
			{
				route = this.routes[path];
			}
		}

		return route;
	}.bind(this);

	this.get_data = function(path, ext)
	{
		var data = this.file_cache[path];
		if(!data || this.cache_ignores[ext] === true)
		{
			try { data = fs.readFileSync(this.directory + path); }
			catch(e) { console.log(e); }
		}
		return data;
	}

	this.get_modified = function(path, ext)
	{
		var modified = this.modified_cache[path];
		if(!modified || this.cache_ignores[ext] === true)
		{
			try { modified = fs.statSync(this.directory + path).mtime.toUTCString(); }
			catch(e) { console.log(e); }
		}
		return modified;
	}

	this.do_route = function(path, request, response, request_url, fallback_404)
	{
		// cache route if undefined
		if(this.route_cache[path] === undefined)
		{
			var parts = path.split('.');
			var ext = (parts.length > 1) ? parts[parts.length - 1] : null;

			this.route_cache[path] = {};
			this.route_cache[path].route = this.get_route(path, ext);
			this.route_cache[path].ext = ext;
			this.route_cache[path].content_type = (this.content_types[ext] !== undefined) ? this.content_types[ext] : this.content_types.default;

			this.log('CACHE', 'cached route');
		}

		var route = this.route_cache[path].route;
		var ext = this.route_cache[path].ext;
		var content_type = this.route_cache[path].content_type;

		// if route is custom function, call it and return
		if(typeof route === 'function')
		{
			if(route.call(this, request, response, request_url, '') !== false)
			{
				response.end();
			}
			return;
		}

		// otherwise we need to get data
		var data = this.get_data(path, ext);

		// if 404
		if(data === undefined || typeof this.handlers[route] !== 'function')
		{
			response.statusCode = 404;

			if(fallback_404)
			{
				this.log('ERROR', '404 Not Found for 404 route');
				response.setHeader('Last-Modified', this.date_utc);
				response.setHeader('Content-Type', 'text/plain');
				response.write('404 Not Found\n404 Not Found for 404 route');
				response.end();
			}
			else
			{
				this.log('ERROR', '404 Not Found');
				this.do_route(this.routes[404], request, response, request_url, true);
			}

			return;
		}

		var modified = this.get_modified(path);
		if(modified) response.setHeader('Last-Modified', this.modified_cache[path]);

		response.setHeader('Content-Type', content_type);
		if(this.handlers[route].call(this, request, response, request_url, data) !== false)
		{
			response.end();
		}
	}.bind(this);

	// prevent uploads which eat memory and other important stuff
	this.cb_checkContinue = function(request, response)
	{
		response.writeHead(400);
		response.end();
		request.socket.end();
	}

	this.log = function(plugin, message)
	{
		if(this.do_log)
		{
			console.log(this.date_iso + ' [' + plugin + '] ' + message);
		}
	}

	// load config at end of constructor
	this.reset_config();
}
