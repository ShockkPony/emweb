var http = require('http');
var events = require('events');
var vows = require('vows');
var assert = require('assert');
var emweb = require('../lib/emweb');
var server;

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

					var promise = new events.EventEmitter();
					http.get('http://localhost:' + server.port + '/', function(response)
					{
						promise.emit('success', response);
					}).on('error', function(err)
					{
						promise.emit('error', err);
					});
					return promise;
				},
				'does not throw an error': function(err, response)
				{
					assert.isNull(err);
				},
				'returns status code 200': function(err, response)
				{
					assert.isObject(response);
					assert.strictEqual(response.statusCode, 200);
				},
				'if missing':
				{
					topic: function()
					{
						server.file_cache[server.routes.default] = undefined;

						var promise = new events.EventEmitter();
						http.get('http://localhost:' + server.port + '/', function(response)
						{
							promise.emit('success', response);
						}).on('error', function(err)
						{
							promise.emit('error', err);
						});
						return promise;
					},
					'does not throw an error': function(err, response)
					{
						assert.isNull(err);
					},
					'returns status code 404': function(err, response)
					{
						assert.isObject(response);
						assert.strictEqual(response.statusCode, 404);
					}
				}
			}
		}
	}
}).export(module);
