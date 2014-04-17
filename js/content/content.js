

(function(app) {
	
	function getSelection() {
		return window.getSelection().toString().trim();
	}
	
	function init(callback) {
		if (!settings) {
			settings = {};
			app.sendMessageToExtension({type: 'getSettings'}, function(sett) {
				settings = sett;
				callback();
			});
		}
		else {
			callback();
		}
	}
	
	
	function onReaderDestroy() {
		settings = reader = null;
		app.isReaderStarted(false);
	}
	
	function onMessage(msg, sender, callback) {
		if (!app.isStartAllowed()) return;
		
		switch (msg.type) {
			case 'isAlive':
				isTopWindow && callback(true);
				break;
			case 'isOfflinePage':
				isTopWindow && callback(app.isOfflinePage);
				break;
			case 'popupSettings':
				settings && (settings[msg.key] = msg.value);
				app.trigger(app, 'popupSettings', [msg.key, msg.value]);
				callback();
				break;
			case 'getSelection':
				// Since the content script is being installed in all the frames on the page,
				// we shold give a priority to the one who have a text selection.
				var sel = getSelection();
				setTimeout(function() {
					// Try-catch is needed because any second call of the callback throws an exception
					try {
						callback(sel);
					}
					catch(e) { }
				}, sel ? 0 : 200);
				return true;
			case 'startReading':
				app.startReader(msg.text, msg.selectionText);
				callback();
				break;
			case 'startSelector':
				app.startContentSelection();
				callback();
				break;
			case 'closeReader':
				app.destroyReader();
				callback();
				break;
			case 'isReaderStarted':
				callback(app.isReaderStarted());
				break;
			case 'onReaderStarted':
				app.stopContentSelection();
				callback();
				break;
		}
	}
	
	function onKeyDown(e) {
		if (!app.isStartAllowed()) return;
		
		switch (e.keyCode) {
			case 83: // S
				if (e.altKey) {
					app.stopEvent(e);
					var text = getSelection();
					if (text.length) {
						app.startReader(text);
						app.event('Reader', 'Open', 'Shortcut (Alt+S)');
					}
					else {
						app.startContentSelection();
						app.event('Content selector', 'Start', 'Shortcut (Alt+S)');
					}
				}
				break;
		}
	}
	
	
	
	var isTopWindow = window.top === window,
		settings, reader;
	
	
	app._isReaderStarted = false;
	
	app.isOfflinePage = false;
	
	app.isStartAllowed = function() {
		try {
			return !!window.top.fastReader;
		}
		catch(e) {
			// If an iframe is not accessible, we don't try to launch on it
			return false;
		}
	}
	
	app.isReaderStarted = function(val) {
		try {
			if (typeof val === 'boolean')
				window.top.fastReader._isReaderStarted = val;
			
			return window.top.fastReader._isReaderStarted;
		}
		catch(e) {
			return false;
		}
	}
	
	
	app.get = function(key) {
		return settings[key];
	}
	
	app.set = function(key, value) {
		settings[key] = value;
		app.sendMessageToExtension({type: 'setSettings', key: key, value: value});
	}
	
	
	app.startReader = function(text, selectionText) {
		if (!app.isStartAllowed() || app.isReaderStarted()) return;
		
		text = text != null ? text : getSelection() || selectionText;
		
		if (!text) {
			var frames = document.querySelectorAll('iframe,frame'), i;
			for (i = 0; i < frames.length; i++) {
				// Iframe's window might be inaccessible due to privacy policy
				try {
					frames[i].contentWindow.fastReader.startReader();
				}
				catch(e) { }
			}
			return;
		}
		
		app.isReaderStarted(true);
		app.sendMessageToExtension({type: 'onReaderStarted'});
		
		init(function() {
			reader = new app.Reader(text);
			app.on(reader, 'destroy', onReaderDestroy);
			app.event('Text', 'Length', app.roundExp(text.length));
		});
	}
	
	app.destroyReader = function() {
		reader && reader.destroy();
	}
	
	app.isPopupOpen = function(callback) {
		app.sendMessageToExtension({type: "isPopupOpen"}, callback);
	}
	
	
	
	chrome.runtime.onMessage.addListener(onMessage);
	
	app.on(window, "keydown", onKeyDown);
	
	
})(window.fastReader);
