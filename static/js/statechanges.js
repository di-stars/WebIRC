var assert = function() {
	// server-side assert only; do nothing on the client
};

// if Node.js
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	assert = require('assert');
}

var statechanges = {
	stateChangeFunctions: {
		'NamesUpdateAdd': function(serverIdx, channelIdx, userlistEntries) {
			var channel = this.servers[serverIdx].channels[channelIdx];

			channel.tempUserlist = channel.tempUserlist.concat(userlistEntries);
		},
		'NamesUpdate': function(serverIdx, channelIdx) {
			var channel = this.servers[serverIdx].channels[channelIdx];

			// swap tempUserlist for userlist and clear it
			channel.userlist = channel.tempUserlist;
			channel.tempUserlist = [];

			// TODO: sort tempUserlist and apply it
		},
		'AddServer': function(server) {
			this.servers.push(server);
		},
		'AddChannel': function(serverIdx, channel) {
			var server = this.servers[serverIdx];

			return server.channels.push(channel) - 1; // returns the index of the pushed element
		},
		'RemoveChannel': function(windowPath, utils) {
			utils.onCloseWindow(this, windowPath);

			var targetWindow = utils.getWindowByPath(this, windowPath);

			assert(targetWindow.type === 'channel');

			// remove the channel
			targetWindow.server.channels.splice(windowPath.channelIdx, 1);
		},
		'AddQuery': function(serverIdx, query) {
			var server = this.servers[serverIdx];

			return server.queries.push(query) - 1; // returns the index of the pushed element
		},
		'RemoveQuery': function(windowPath, utils) {
			utils.onCloseWindow(this, windowPath);

			var targetWindow = utils.getWindowByPath(this, windowPath);

			assert(targetWindow.type === 'query');

			// remove the channel
			targetWindow.server.queries.splice(windowPath.queryIdx, 1);
		},
		'SetActiveWindow': function(newActiveWindowPath, utils) {
			console.log('active window being set to:');
			console.log(newActiveWindowPath);

			// if there is already an active window, remove the 'activeWindow' flag from it
			if (this.currentActiveWindow !== null) {
				var currentActiveWindow = utils.getWindowByPath(this, this.currentActiveWindow);

				delete currentActiveWindow.object.activeWindow;
			}

			var newActiveWindow = utils.getWindowByPath(this, newActiveWindowPath);

			newActiveWindow.object.activeWindow = true;
			this.currentActiveWindow = newActiveWindowPath;
		},
		'Join': function(serverIdx, channelIdx, newUserlistEntry) {
			var channel = this.servers[serverIdx].channels[channelIdx];

			channel.userlist.push(newUserlistEntry);

			channel.activityLog.push({type: 'Join', who: newUserlistEntry});
		},
		'Part': function(serverIdx, channelIdx, who) {
			var channel = this.servers[serverIdx].channels[channelIdx];

			channel.userlist = channel.userlist.filter(function(currentUserlistEntry) {
				return (currentUserlistEntry.nick !== who.nick);
			});

			channel.activityLog.push({type: 'Part', who: who});
		},
		'ChatMessage': function(windowPath, nick, text, utils) {
			var targetWindow = utils.getWindowByPath(this, windowPath);

			targetWindow.object.activityLog.push({type: 'ChatMessage', nick: nick, text: text});
		},
		'ActionMessage': function(windowPath, nick, text, utils) {
			var targetWindow = utils.getWindowByPath(this, windowPath);

			targetWindow.object.activityLog.push({type: 'Action', nick: nick, text: text});
		},
		'NickChange': function(serverIdx, oldNickname, newNickname, utils) {
			var server = this.servers[serverIdx];

			// if the nickname change origin matches ours
			if (server.nickname !== null && server.nickname === oldNickname) {
				server.nickname = newNickname;
			}

			utils.forEveryChannelWithNick(server, oldNickname,
				function(channel) {
					channel.activityLog.push({type: 'NickChange', oldNickname: oldNickname, newNickname: newNickname});

					// TODO: apply the change to the userlist
				}
			);
		},
		'Quit': function(serverIdx, who, quitMessage, utils) {
			var server = this.servers[serverIdx];

			// if we are the quitter
			if (server.nickname !== null && server.nickname === who.nick) {
				// do we need to do anything special?
			}

			utils.forEveryChannelWithNick(server, who.nick,
				function(channel) {
					channel.activityLog.push({type: 'Quit', who: who});

					// TODO: apply the change to the userlist
				}
			);
		},
		'ModeChange': function(windowPath, origin, modes, modeArgs, utils) {
			var targetWindow = utils.getWindowByPath(this, windowPath);

			targetWindow.object.activityLog.push({
				type: 'ModeChange',
				origin: origin,
				modes: modes,
				modeArgs: modeArgs
			});
		},
		'UserlistModeUpdate': function(windowPath, userlistEntry, utils) {
			var targetWindow = utils.getWindowByPath(this, windowPath);

			// TODO
			//targetWindow.object.
		},
	},
	utilityFunctions: {
		forEveryChannelWithNick: function(server, nickname, successCallback) {
			server.channels.forEach(function(channel, channelIdx) {
				var channel = server.channels[channelIdx];

				if (statechanges.utilityFunctions.isNicknameInUserlist(nickname, channel.userlist)) {
					successCallback(channel);
				}
			});
		},
		isNicknameInUserlist: function(nickname, userlist) {
			return userlist.some(function(userlistEntry) {
				return (nickname === userlistEntry.nick);
			});
		},
		onCloseWindow: function(state, path) {
			if ('serverIdx' in path) {
				var serverIdx = path.serverIdx;
				var server = state.servers[serverIdx];

				if ('channelIdx' in path) {
					var channelIdx = path.channelIdx;
					var channel = server.channels[channelIdx];

					if (channel.activeWindow) {
						if (channelIdx > 0) {
							statechanges.utilityFunctions.setActiveWindow(state, {serverIdx: serverIdx, channelIdx: channelIdx - 1});
						} else {
							statechanges.utilityFunctions.setActiveWindow(state, {serverIdx: serverIdx});
						}
					}
				} else if ('queryIdx' in path) {
					// TODO: implement when query windows can be closed
					console.log('NOT IMPL');
				} else {
					// just the server
					console.log('NOT IMPL');
				}
			} else {
				console.log('serverIdx required in onCloseWindow');
			}
		},
		setActiveWindow: function(state, path) {
			callStateChangeFunction(state, 'SetActiveWindow', [path]);
		},
		getWindowByPath: function(state, path) {
			if ('serverIdx' in path) {
				if (path.serverIdx < 0 || path.serverIdx >= state.servers.length)
					return null;

				var server = state.servers[path.serverIdx];

				if ('channelIdx' in path) {
					if (path.channelIdx < 0 || path.channelIdx >= server.channels.length)
						return null;

					var channel = server.channels[path.channelIdx];

					return {object: channel, server: server, type: 'channel', windowPath: path};
				} else if ('queryIdx' in path) {
					if (path.queryIdx < 0 || path.queryIdx >= server.queries.length)
						return null;

					var query = server.queries[path.queryIdx];

					return {object: query, server: server, type: 'query', windowPath: path};
				} else {
					// just the server
					return {object: server, server: server, type: 'server', windowPath: path};
				}
			} else {
				console.log('serverIdx required in getWindowByPath');
				return null;
			}
		}
	}
};

function callStateChangeFunction(stateObject, funcId, args) {
	var newArgs = args.concat([statechanges.utilityFunctions]);

	if (funcId in statechanges.stateChangeFunctions) {
		return statechanges.stateChangeFunctions[funcId].apply(stateObject, newArgs);
	} else {
		assert(false, 'Received invalid state change function: ' + funcId);
	}
}

// if being loaded into Node.js, export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports.callStateChangeFunction = callStateChangeFunction;
	module.exports.utils = statechanges.utilityFunctions;
}