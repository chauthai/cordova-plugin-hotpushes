/* global cordova:false */

/*!
 * Module dependencies.
 */

var ContentSync = cordova.require('ContentSync');

/**
 * HotPush constructor.
 *
 * @param {Object} options to initiate a new content synchronization.
 *   @param {String} src is a URL to hot push endpoint
 *   @param {String} versionJSONPFileName is the name of the jsonp file containing the version information
 *   @param {String} versionJSONFileName is the name of the json file containing the version information
 *   @param {Object} type defines the hot push strategy applied to the content.
 *     @param {String} replace completely removes existing content then copies new content from a zip file.
 *     @param {String} merge   download and replace only content which has changed
 *   @param {String} archiveURL is the url of the zip containing the files to hot push (if type === replace)
 *   @param {Object} headers are used to set the headers for when we send a request to the src URL
 *   @param {String} documentsPath is the path to the Documents folder
 * @return {HotPush} instance that can be monitored and cancelled.
 */

var HotPush = function(options) {
  this._handlers = {
    'progress': [],
    'cancel': [],
    'error': [],
    'complete': []
  };

  // require options parameter
  if (typeof options === 'undefined') {
    throw new Error('The options argument is required.');
  }

  // require options.src parameter
  if (typeof options.src === 'undefined') {
    throw new Error('The options.src argument is required.');
  }

  // require options.versionJSONPFileName parameter
  if (typeof options.versionJSONPFileName === 'undefined') {
    throw new Error('The options.versionJSONPFileName argument is required.');
  }

  // require options.versionJSONFileName parameter
  if (typeof options.versionJSONFileName === 'undefined') {
    throw new Error('The options.versionJSONFileName argument is required.');
  }

  // define synchronization strategy
  //
  //     replace: This is the normal behavior. completely removes existing
  //              content then copies new content from a zip file.
  //     merge:   Download and replace only content which has changed
  //
  if (typeof options.type === 'undefined') {
    options.type = 'replace';
  }

  if (options.type === 'replace' && typeof options.archiveURL === 'undefined') {
    throw new Error('The options.archiveURL argument is required when type === replace.');
  }

  if (typeof options.headers === 'undefined') {
    options.headers = null;
  }

  if (typeof options.bundlePath === 'undefined') {
    options.bundlePath = cordova.file.applicationDirectory + 'www/';
  }

  if (typeof options.documentsPath === 'undefined') {
    options.documentsPath = cordova.file.applicationStorageDirectory + 'Documents/';
  }

  // store the options to this object instance
  this.options = options;

  // triggered on update and completion
  var self = this;
  var success = function(result) {
    if (result && typeof result.progress !== 'undefined') {
      self.emit('progress', result);
    } else if (result && typeof result.localPath !== 'undefined') {
      self.emit('complete', result);
    }
  };

  // triggered on error
  var fail = function(msg) {
    var e = (typeof msg === 'string') ? new Error(msg) : msg;
    self.emit('error', e);
  };

  this.localVersion = null;
  this.remoteVersion = null;
  this.countForCallback = null;
  this.fetchFromBundle = false;
  this.checking = false;
  this._syncs = [];

  window.hotPushJSONP = function(version) {
    if (!version && !self.fetchFromBundle) { // error when we tried to fetch from /Documents
      // search in bundle
      self.fetchFromBundle = true;
      this._loadLocalVersion();
    } else if (version) {
      self.localVersion = version;
      if (self.checking {
        self._callback();
      } else {
        self._loadAllLocalFiles();
      }
    }
  }
};

/**
* Load files from local
*/
HotPush.prototype.loadFromLocal = function() {
  this.checking = false;
  this.fetchFromBundle = false;
  this._loadLocalVersion();
}

/**
* Check if there is a new version available
*/
HotPush.prototype.check = function() {
  var self = this;

  // reset variable
  this.checking = true;
  this.fetchFromBundle = false;
  this.countForCallback = 2;

  // fetch localVersion
  this._loadLocalVersion();

  // fetch remoteVersion
  var remoteRequest = new XMLHttpRequest();
  remoteRequest.open('GET', this.options.src + this.options.versionJSONFileName, true);

  remoteRequest.onload = function() {
    if (remoteRequest.status >= 200 && remoteRequest.status < 400) {
      // Success!
      self.remoteVersion = JSON.parse(remoteRequest.responseText);
      self._callback();
    } else {
      console.log('nothing on the remote, fallback to the bundle');
    }
  };

  remoteRequest.onerror = function(err) {
    console.log(err);
    that.emit('error');
  };

  remoteRequest.send();
}

/**
* Load all local files
*/
HotPush.prototype._loadAllLocalFiles = function() {
  var step = 0;
  var nbOfFilesInThisStep;

  do {
    nbOfFilesInThisStep = 0;
    for(var i = 0; i < this.localVersion.files.length; i++) {
      if (this.localVersion.files[i].position === step) {
        nbOfFilesInThisStep++;
        setTimeout(function() {
          this._loadLocalFile(this.localVersion.files[i].name);
        }.bind(this), step * 100);
      }
    }
    step ++;
  } while (nbOfFilesInThisStep > 0);
};

/**
* Fetch the local version of the version file
*/
HotPush.prototype._updateHotPush = function() {
  var self = this;
  if (this.options.type === 'replace') {
    this._syncs = [ContentSync.sync({ src: this.options.archiveURL, id: 'assets' })];

    this._syncs[0].on('progress', function(data) {
      console.log(data.progress)
    });

    this._syncs[0].on('complete', function(data) {
      location.reload();
    });

    this._syncs[0].on('error', function(e) {
      console.log(e)
      self.emit('error');
    });

  } else if (this.options.type === 'merge') {
    throw new Error('not implemented yet')
  }
}

/**
* Get the path to a local file
*/

HotPush.prototype._getLocalPath = function(filename) {
  if (this.fetchFromBundle) {
    return '/' + filename;
  } else {
    return this.documentsPath + filename;
  }
};

/**
* Fetch the local version of the version file
*/

HotPush.prototype._loadLocalVersion = function() {
  var head = document.getElementsByTagName("head")[0];
  var time = new Date().getTime();
  var domEl = document.createElement("script");
  domEl.setAttribute("type", "text/javascript");
  domEl.setAttribute("src", this._getLocalPath(this.options.versionJSONPFileName) + '?' + time);
  domEl.onerror = function() {window.hotPushJSONP(null);}
  setTimeout(function(){window.hotPushJSONP(null);},100); // check for timeout
};

/**
* Callback for async call to version files
*/
HotPush.prototype._callback = function() {
  this.countForCallback--;
  if (this.countForCallback === 0) {
    if (this.localVersion.timestamp !== this.remoteVersion.timestamp) {
      console.log('Not the last version, ' + currentVersion.timestamp +' !== ' + myVersion.timestamp);
      this._updateHotPush();
    } else {
      console.log('All good, last version running');
    }
  }
};

HotPush.prototype._loadLocalFile(filename) {
  var head = document.getElementsByTagName("head")[0];
  var domEl;
  var time = new Date().getTime();
  if (filename.split('.css').length > 1) {
    domEl = document.createElement("link");
    domEl.setAttribute("rel", "stylesheet");
    domEl.setAttribute("type", "text/css");
    domEl.setAttribute("href", this._getLocalPath(filename) + '?' + time);
  } else if (filename.split('.js').length > 1) {
    domEl = document.createElement('script');
    domEl.setAttribute("type", "text/javascript");
    domEl.setAttribute("src", this._getLocalPath(filename) + '?' + time);
  }
  head.appendChild(domEl);
}

/**
* Cancel the Hot Push
*
* After successfully canceling the hot push process, the `cancel` event
* will be emitted.
*/

HotPush.prototype.cancel = function() {
  var self = this;
  this.countForCallback = 100;
  this._syncs.forEach(function(sync) {
    sync.cancel();
  });
  self.emit('cancel');
};

/**
* Listen for an event.
*
* The following events are supported:
*
*   - progress
*   - cancel
*   - error
*   - completion
*
* @param {String} eventName to subscribe to.
* @param {Function} callback triggered on the event.
*/

HotPush.prototype.on = function(eventName, callback) {
  if (this._handlers.hasOwnProperty(eventName)) {
      this._handlers[eventName].push(callback);
  }
};

/**
* Emit an event.
*
* This is intended for internal use only.
*
* @param {String} eventName is the event to trigger.
* @param {*} all arguments are passed to the event listeners.
*
* @return {Boolean} is true when the event is triggered otherwise false.
*/

HotPush.prototype.emit = function() {
  var args = Array.prototype.slice.call(arguments);
  var eventName = args.shift();

  if (!this._handlers.hasOwnProperty(eventName)) {
      return false;
  }

  for (var i = 0, length = this._handlers[eventName].length; i < length; i++) {
      this._handlers[eventName][i].apply(undefined,args);
  }

  return true;
};

/*!
* Content Sync Plugin.
*/

module.exports = {
  /**
   * Synchronize the content.
   *
   * This method will instantiate a new copy of the HotPush object
   * and start synchronizing.
   *
   * @param {Object} options
   * @return {HotPush} instance
   */

  sync: function(options) {
      return new HotPush(options);
  },

  HotPush: HotPush,

  /**
   * PROGRESS_STATE enumeration.
   *
   * Maps to the `progress` event's `status` object.
   * The plugin user can customize the enumeration's mapped string
   * to a value that's appropriate for their app.
   */

  PROGRESS_STATE: {
      0: 'STOPPED',
      1: 'DOWNLOADING',
      2: 'EXTRACTING',
      3: 'COMPLETE'
  }
};