/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
var { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function SearchSubmission(url, data) {
  this.url = url;
  this.data = data;
}
SearchSubmission.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISearchSubmission]),

  get postData() { return null; },
  get uri() {
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var uri = ioService.newURI(this.url + encodeURIComponent(this.data), null, null);
    return uri;
  }
}

function SearchEngine(url) {
  this.url = url
}
SearchEngine.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISearchEngine]),

  getSubmission: function(data, responseType, purpose) {
    return (new SearchSubmission(this.url, data)).QueryInterface(Ci.nsISearchSubmission);
  },

  supportsResponseType: function(responseType) {
    return responseType == 'application/x-moz-keywordsearch';
  }
}


function SearchServiceProxy(target) {
  this.target = target;
}
SearchServiceProxy.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIBrowserSearchService]),

    init: function (observer) {
      this.target.init(observer);
    },
    get isInitialized() {
      return this.target.isInitialized;
    },
    addEngine: function(engineURL, dataType, iconURL, confirm) {
      this.target.addEngine(engineURL, dataType, iconURL, confirm);
    },
    addEngineWithDetails: function(name, iconURL, alias, description, method, url) {
      this.target.addEngineWithDetails(name, iconURL, alias, description, method, url);
    },
    restoreDefaultEngines: function() {
      return this.target.restoreDefaultEngines();
    },
    getEngineByAlias: function(alias) {
      return this.target.getEngineByAlias(alias);
    },
    getEngineByName: function(name) {
      return this.target.getEngineByName(name);
    },
    getEngines: function(count) {
      var engines = this.target.getEngines();
      count.value = engines.length;
      return engines;
    },
    getVisibleEngines: function(count) {
      var engines = this.target.getVisibleEngines();
      count.value = engines.length;
      return engines;
    },
    getDefaultEngines: function(count) {
      var engines = this.target.getDefaultEngines();
      count.value = engines.length;
      return engines;
    },
    moveEngine: function(engine, newIndex) {
      this.target.moveEngine(engine, newIndex);
    },
    removeEngine: function(engine) {
      this.target.removeEngine(engine);
    },
    get defaultEngine() {
      // All this is done to minize fallout from this HACK!
      function shouldFake(stack) {
        if (!stack.caller)
          return false;

        // This happens when somebody enters "bla bla bla"
        if (stack.caller.name == 'loadURIWithFlags')
          return true;

        // This tries to match the case where a pageload already failed.
        if (stack.caller.languageName != 'C++')
          return false;

        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
        var mainWindow = wm.getMostRecentWindow("navigator:browser");

        const FLAGS = (Ci.nsIDocShell.BUSY_FLAGS_BUSY | Ci.nsIDocShell.BUSY_FLAGS_BEFORE_PAGE_LOAD);
        if (mainWindow.gBrowser.docShell.busyFlags != FLAGS)
          return false;

        if (mainWindow.gBrowser.docShell.loadType != Ci.nsIDocShell.LOAD_CMD_NORMAL)
          return false;

        return true;
      }

      if (!shouldFake(Components.stack))
        return this.target.defaultEngine;

      var url = Cc["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService).getBranch(null).getCharPref("keyword.URL");
      if (!url)
        return this.target.defaultEngine;

      return (new SearchEngine(url));
    },
    set defaultEngine(v) {
      this.target.defaultEngine = v;
    },
    get currentEngine() {
      return this.target.currentEngine;
    },
    set currentEngine(v) {
      this.target.currentEngine = v;
    },
};

var SearchServiceFactory = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory]),

  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return (new SearchServiceProxy(SearchServiceFactory.target)).QueryInterface(aIID);
  }
};


var previous = null;
function startup(data, reason) {
  var old = Cc["@mozilla.org/browser/search-service;1"].getService(Ci.nsIBrowserSearchService)

  var cid = Cc["@mozilla.org/browser/search-service;1"];
  var name  = "keyword.URL service addon";
  var contract = "@mozilla.org/browser/search-service;1";

  previous = Components.manager.getClassObject(cid, Components.interfaces.nsIFactory);
  Components.manager.nsIComponentRegistrar.unregisterFactory(cid, previous);

  SearchServiceFactory.target = old;
  Components.manager.nsIComponentRegistrar.registerFactory(cid, name, contract, SearchServiceFactory);
}

function shutdown(data, reason) {
  var cid = Cc["@mozilla.org/browser/search-service;1"];
  var name  = "Normal Search Service";
  var contract = "@mozilla.org/browser/search-service;1";

  var current = Components.manager.getClassObject(cid, Components.interfaces.nsIFactory);
  Components.manager.nsIComponentRegistrar.unregisterFactory(cid, current);
  Components.manager.nsIComponentRegistrar.registerFactory(cid, name, contract, previous);
}

function install() {}
function uninstall() {}
