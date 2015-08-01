/*
 *  Copyright 2013-2015 David Farrell
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var http = require('http')
var url = require('url')

exports.name = 'emweb'

exports.config$load = function(config) {
	config.maxConnections = config.maxConnections || 5
	config.timeout        = config.timeout        || 5
	config.port           = config.port           || 80
	exports.listen(config)
}

exports.$unload = function(name) {
	if(name === exports.name) {
		exports.stop()
	}
}

exports.stop = function() {
	if(exports.server !== undefined) {
		try {
			exports.mods.fire(exports.name + '$down')
			exports.server.close()
			delete exports.server
		} catch(e) {
			console.log(e)
		}
	}
}

exports.listen = function(config) {
	if(exports.server !== undefined) { exports.stop() }
	exports.server = http.createServer()
	exports.server.maxConnections = config.maxConnections
	exports.server.setTimeout(config.timeout)
	exports.server.on('request', function(request, response) {
		var requestURL = url.parse(request.url, true)
		var safePath = requestURL.pathname.replace(/[^A-Za-z0-9_\-\.%]/g, '')
		var safeResponse = {}
		if(safePath === '') {
			exports.mods.fire(exports.name + '$defaultroute', safeResponse)
		} else {
			exports.mods.fire(exports.name + '$route', safePath, safeResponse)
			exports.mods.fire(exports.name + '$route_' + safePath, safeResponse)
		}
		response.statusCode = 200
		response.setHeader('Content-Type', safeResponse.contentType || 'text/plain')
		response.write(safeResponse.content || '')
		response.end()
	})
	exports.server.on('checkContinue', function(request, response) {
		response.writeHead(400)
		response.end()
		request.socket.end()
	})
	exports.server.listen(config.port, function(err) {
		if(err) { console.log(err) }
		else { exports.mods.fire(exports.name + '$up') }
	})
}
