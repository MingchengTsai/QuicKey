define([
	"react",
	"jsx!./search-box",
	"jsx!./results-list",
	"jsx!./results-list-item",
	"array-score",
	"quick-score",
	"get-bookmarks",
	"get-history",
	"lodash"
], function(
	React,
	SearchBox,
	ResultsList,
	ResultsListItem,
	arrayScore,
	qsScore,
	getBookmarks,
	getHistory,
	_
) {
	const MinScore = .5,
		MaxItems = 10,
		MinItems = 3,
		MinScoreDiff = .4,
		BookmarksQuery = "/b ",
		BookmarksQueryPattern = new RegExp("^" + BookmarksQuery),
		HistoryQuery = "/h ",
		HistoryQueryPattern = new RegExp("^" + HistoryQuery),
		BHQueryPattern = /^\/[bh]$/,
		CommandQuery = "/",
		IsWindows = /Win/i.test(navigator.platform);


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "displayURL"]);


	var TabSelector = React.createClass({
		mode: "tabs",
		forceUpdate: false,
		bookmarks: [],
		history: [],


		getInitialState: function()
		{
			var query = this.props.initialQuery;

			return {
				query: query,
				matchingItems: this.getMatchingItems(query),
					// default to the first item being selected, in case we got
					// an initial query
				selected: 0
			};
		},


		componentDidUpdate: function()
		{
				// we only want this to be true through one render cycle
			this.forceUpdate = false;
		},


		getMatchingItems: function(
			query)
		{
			if (!query) {
					// short-circuit the empty query case, since quick-score now
					// returns 0.9 as the scores for an empty query
				return [];
			}

			var mode = this.mode,
				items = mode == "tabs" ? this.props.tabs :
					mode == "bookmarks" ? this.bookmarks : this.history,
				scores = scoreArray(items, query),
				firstScoresDiff = (scores.length > 1 && scores[0].score > MinScore) ?
					(scores[0].score - scores[1].score) : 0,
					// first limit the items to 10, then drop barely-matching
					// results, keeping a minimum of 3, unless there's a big
					// difference in scores between the first two items
				matchingItems = _.dropRightWhile(scores.slice(0, MaxItems), function(item, i) {
					return item.score < MinScore && (i + 1 > MinItems || firstScoresDiff > MinScoreDiff);
				});

			return matchingItems;
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var updateData = { active: true };

				if (unsuspend && tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
				}

					// switch to the selected tab
				chrome.tabs.update(tab.id, updateData);

					// make sure that tab's window comes forward
				if (tab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(tab.windowId, { focused: true });
				}
			}
		},


		openItem: function(
			item,
			shiftKey,
			altKey)
		{
			if (item) {
				if (this.mode == "tabs") {
						// switch to the tab
					this.focusTab(item, shiftKey);
				} else if (shiftKey) {
						// open in a new window
					chrome.windows.create({ url: item.url });
				} else if (altKey) {
						// open in a new tab
					chrome.tabs.create({ url: item.url });
				} else {
						// open in the same tab
					chrome.tabs.update({ url: item.url });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		modifySelected: function(
			delta)
		{
			this.setSelectedIndex(this.state.selected + delta);
		},


		setSelectedIndex: function(
			index)
		{
			var length = this.state.matchingItems.length;

				// wrap around the end or beginning of the list
			index = (index + length) % length;
			this.setState({ selected: index });
		},


		onQueryChange: function(
			event)
		{
			var query = event.target.value,
				queryString = query,
				matchingItems,
				promise = Promise.resolve(),
				self = this;

			if (BookmarksQueryPattern.test(query)) {
				this.mode = "bookmarks";
				query = query.replace(BookmarksQueryPattern, "");
			} else if (HistoryQueryPattern.test(query)) {
				this.mode = "history";
				query = query.replace(HistoryQueryPattern, "");
			} else if (query == CommandQuery || BHQueryPattern.test(query)) {
				this.mode = "command";
				query = "";
			} else {
				this.mode = "tabs";
			}

			if (this.mode == "bookmarks" && !this.bookmarks.length) {
				promise = getBookmarks().then(function(bookmarks) {
					self.bookmarks = bookmarks;
				});
			} else if (this.mode == "history" && !this.history.length) {
				promise = getHistory().then(function(history) {
					self.history = history;
				});
			}

			promise.then(function() {
				matchingItems = self.getMatchingItems(query);

				self.setState({
					query: queryString,
					matchingItems: matchingItems,
					selected: 0
				});
			});
		},


		onKeyDown: function(
			event)
		{
			var query = event.target.value,
				state = this.state;

			switch (event.which) {
				case 27:	// escape
					if (!query) {
							// pressing esc in an empty field should close the popup
						window.close();
					} else {
							// there's a default behavior where pressing esc in
							// a search field clears the input, but we want to
							// control what it gets cleared to
						event.preventDefault();

							// if we're searching for bookmarks or history,
							// reset the query to just /b or /h, rather than
							// clearing it, unless it's already that, in which
							// case, clear it
						if (this.mode == "tabs" || this.mode == "command" ||
								query == BookmarksQuery || query == HistoryQuery) {
							this.forceUpdate = true;
							query = "";
						} else if (this.mode == "bookmarks") {
							this.forceUpdate = true;
							query = BookmarksQuery;
						} else if (this.mode == "history") {
							this.forceUpdate = true;
							query = HistoryQuery;
						}

						this.onQueryChange({ target: { value: query }});
					}
					break;

				case 38:	// up arrow
					this.modifySelected(-1);
					event.preventDefault();
					break;

				case 40:	// down arrow
					this.modifySelected(1);
					event.preventDefault();
					break;

				case 13:	// enter
					this.openItem(state.matchingItems[state.selected],
						event.shiftKey, event.ctrlKey || event.metaKey);
					event.preventDefault();
					break;
			}
		},


		render: function()
		{
			var state = this.state,
				query = state.query;

			return <div className={IsWindows ? "win" : ""}>
				<SearchBox
					mode={this.mode}
					forceUpdate={this.forceUpdate}
					query={query}
					onChange={this.onQueryChange}
					onKeyDown={this.onKeyDown}
				/>
				<ResultsList
					ItemComponent={ResultsListItem}
					items={state.matchingItems}
					query={query}
					selectedIndex={state.selected}
					ignoreMouse={state.ignoreMouse}
					setSelectedIndex={this.setSelectedIndex}
					onItemClicked={this.openItem}
				/>
			</div>
		}
	});


	return TabSelector;
});