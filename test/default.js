var events = require('events');
var vows = require('vows');
var assert = require('assert');
var emweb = require('../lib/emweb');

vows.describe('emweb').addBatch(
{
	'a server':
	{
		topic: new(emweb.Server),
		'when initialized':
		{
			topic: function(server)
			{
				server.port = 33338;
				return server.init();
			},
			'succeeds': function(err, server)
			{
				assert.isObject(server);
			},
			'when listening':
			{
				topic: function(server)
				{
					var promise = new events.EventEmitter();
					server.listen(promise);
					return promise;
				},
				'succeeds': function(err, server)
				{
					assert.isObject(server);
				}
			}
		}
	}
}).export(module);
