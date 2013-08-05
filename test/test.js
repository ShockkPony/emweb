var http = require('http');
var events = require('events');
var vows = require('vows');
var assert = require('assert');
var emweb = require('../lib/emweb');
var server;

var request = function(path)
{
	var promise = new events.EventEmitter();

	var options = {
		hostname: 'localhost',
		port: server.port,
		path: '/' + path,
		method: 'GET'
	};

	http.request(options, function(response)
	{
		promise.emit('success', response);
		response.socket.destroy();
	}).on('error', function(err)
	{
		promise.emit('error', err);
	}).end();
	return promise;
}

vows.describe('emweb').addBatch(
{
	'a server':
	{
		topic: new(emweb.Server),
		'when initialized':
		{
			topic: function(s)
			{
				server = s;
				server.port = 33338;
				return server.init();
			},
			'does not throw an error': function(err, server)
			{
				assert.isObject(server);
			}
		},
		'when listening':
		{
			topic: function(s)
			{
				var promise = new events.EventEmitter();
				server.listen(promise);
				return promise;
			},
			'does not throw an error': function(err, s)
			{
				assert.isObject(s);
			},
			'when a client requests `/`':
			{
				topic: function()
				{
					server.file_cache[server.routes.default] = '<html></html>';
					return request('/');
				},
				'does not throw an error': function(err, response)
				{
					assert.isNull(err);
				},
				'returns status code `200`': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.statusCode, 200);
				},
				'if missing':
				{
					topic: function()
					{
						server.file_cache[server.routes.default] = undefined;
						return request('');
					},
					'does not throw an error': function(err, response)
					{
						assert.isNull(err);
					},
					'returns status code `404`': function(err, response)
					{
						assert.isObject(response);
						assert.strictEqual(response.statusCode, 404);
					}
				}
			},
			'when a client requests `/qwerty.html`':
			{
				topic: function()
				{
					server.file_cache['qwerty.html'] = '<html></html>';
					return request('qwerty.html');
				},
				'does not throw an error': function(err, response)
				{
					assert.isNull(err);
				},
				'returns status code `200`': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.statusCode, 200);
				},
				'if missing':
				{
					topic: function()
					{
						server.file_cache['qwerty.html'] = undefined;
						return request('qwerty.html');
					},
					'does not throw an error': function(err, response)
					{
						assert.isNull(err);
					},
					'returns status code `404`': function(err, response)
					{
						assert.isObject(response);
						assert.strictEqual(response.statusCode, 404);
					}
				}
			},
			'when a client requests `/test.htm` from disk':
			{
				topic: function()
				{
					server.cache_ignores.htm = true;
					return request('test.htm');
				},
				'does not throw an error': function(err, response)
				{
					assert.isNull(err);
				},
				'returns status code `200`': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.statusCode, 200);
				},
				'returns default content type': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.headers['content-type'], server.content_types.default);
				}
			},
			'when a client requests `routes[404]`':
			{
				topic: function()
				{
					server.file_cache[server.routes[404]] = '<html></html>';
					return request(server.routes[404]);
				},
				'does not throw an error': function(err, response)
				{
					assert.isNull(err);
				},
				'returns status code `404`': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.statusCode, 200);
				},
				'if missing':
				{
					topic: function()
					{
						server.file_cache[server.routes[404]] = undefined;
						return request(server.routes[404]);
					},
					'does not throw an error': function(err, response)
					{
						assert.isNull(err);
					},
					'returns statusCode `404`': function(err, response)
					{
						assert.isObject(response);
						assert.strictEqual(response.statusCode, 404);
					},
					'returns content type `text/plain`': function(err, response)
					{
						assert.isObject(response);
						assert.strictEqual(response.headers['content-type'], 'text/plain');
					}
				}
			}
		}
	}
}).addBatch(
{
	'when stopping a server':
	{
		topic: function()
		{
			var ret = null;

			try
			{
				server.server.close();
			}
			catch(e)
			{
				console.log(e);
				ret = e;
			}

			return ret;
		},
		'does not throw an error': function(err)
		{
			assert.isNull(err);
		}
	}
}).export(module);
