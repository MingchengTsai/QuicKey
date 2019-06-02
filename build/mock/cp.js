define([
	"bluebird"
], function(
	Promise
) {
	function promiseNoop()
	{
		return Promise.resolve([]);
	}


	global.chrome = {
		extension: {
			getBackgroundPage: () => ({})
		}
	};


	return {
		management: {
			getSelf: function()
			{
				return Promise.resolve({});
			}
		},
		tabs: {
			query: promiseNoop
		},
		sessions: {
			getRecentlyClosed: promiseNoop
		},
		commands: {
			getAll: () => Promise.resolve([{ name: "_execute_browser_action" }])
		},
		storage: {
			local: {
				get: promiseNoop,
				set: promiseNoop,
				clear: promiseNoop
			}
		}
	};
});
