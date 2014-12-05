/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @see http://mxr.mozilla.org/mozilla-central/source/js/src/xpconnect/loader/mozJSComponentLoader.cpp

"use strict";

// IMPORTANT: Avoid adding any initialization tasks here, if you need to do
// something before add-on is loaded consider addon/runner module instead!

const { Cm, Cc, Ci, Cu, Cr } = require("chrome");

const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const resourceHandler = ioService.getProtocolHandler('resource').
                        QueryInterface(Ci.nsIResProtocolHandler);
const systemPrincipal = Cc['@mozilla.org/systemprincipal;1'].
                          createInstance(Ci.nsIPrincipal);
const scriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const prefService = Cc['@mozilla.org/preferences-service;1'].
                    getService(Ci.nsIPrefService).
                    QueryInterface(Ci.nsIPrefBranch);
const { get, exists } = Cc['@mozilla.org/process/environment;1'].
                        getService(Ci.nsIEnvironment);

const prefSvc = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefService).getBranch(null);

const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");
const { Task: { spawn } } = require("resource://gre/modules/Task.jsm");
const { Loader, Require, Module, main, unload } = require("toolkit/loader");

// load below now, so that it can be used by sdk/addon/runner
// see bug https://bugzilla.mozilla.org/show_bug.cgi?id=1042239
// const Startup = Cu.import("resource://gre/modules/sdk/system/Startup.js", {}).exports;

const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];


function getPref(name, defaultValue) {
  defaultValue = defaultValue || null;
  switch (prefSvc.getPrefType(name)) {
  case Ci.nsIPrefBranch.PREF_STRING:
    return prefSvc.getComplexValue(name, Ci.nsISupportsString).data;

  case Ci.nsIPrefBranch.PREF_INT:
    return prefSvc.getIntPref(name);

  case Ci.nsIPrefBranch.PREF_BOOL:
    return prefSvc.getBoolPref(name);

  default:
    return defaultValue;
  }
}

const UUID_PATTERN = /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/;
// Takes add-on ID and normalizes it to a domain name so that add-on
// can be mapped to resource://domain/
const readDomain = id =>
  // If only `@` character is the first one, than just substract it,
  // otherwise fallback to legacy normalization code path. Note: `.`
  // is valid character for resource substitutaiton & we intend to
  // make add-on URIs intuitive, so it's best to just stick to an
  // add-on author typed input.
  id.lastIndexOf("@") === 0 ? id.substr(1).toLowerCase() :
  id.toLowerCase().
     replace(/@/g, "-at-").
     replace(/\./g, "-dot-").
     replace(UUID_PATTERN, "$1");

// Takes JSON `options` and sets prefs for each key under
// the given `root`. Given `options` may contain nested
// objects.
const setPrefs = (root, options) =>
  void Object.keys(options).forEach(id => {
    const key = root + "." + id;
    const value = options[id]
    const type = typeof(value);

    value === null ? void(0) :
    value === undefined ? void(0) :
    type === "boolean" ? prefService.setBoolPref(key, value) :
    type === "string" ? prefService.setCharPref(key, value) :
    type === "number" ? prefService.setIntPref(key, parseInt(value)) :
    type === "object" ? setPrefs(key, value) :
    void(0);
  });

function Bootstrap(mountURI) {
  this.mountURI = mountURI
  this.install = this.install.bind(this)
  this.uninstall = this.uninstall.bind(this)
  this.startup = this.startup.bind(this)
  this.shutdown = this.shutdown.bind(this)


  console.log("Bootstrap", mountURI);
}
Bootstrap.prototype = {
  constructor: Bootstrap,
  install(addon, reason) {
    if (this.mountURI) {
      prefService.setCharPref(`extensions.${addon.id}.mountURI`, this.mountURI);
    }
  },
  uninstall(addon, reason) {
    if (this.mountURI) {
      prefService.clearUserPref(`extensions.${addon.id}.mountURI`);
    }
  },
  startup(addon, reasonCode) {
    console.log("startup");
    const { id, version, resourceURI: {spec: rootURI} } = addon;
    const mountURI = this.mountURI || `${rootURI}src/`;
    const reason = REASON[reasonCode];
    const loadCommand = exists("CFX_COMMAND") ?
                          get("CFX_COMMAND") :
                          getPref("extensions." + id + ".sdk.load.command", undefined);

    try {
      const metadata = require(`${mountURI}package.json`);
      console.log("load metadata", metadata);
      const isNative = true;
      const options = {};

      const permissions = Object.freeze(metadata.permissions || {});
      const domain = readDomain(id);
      const name = metadata.name;

      const baseURI = `resource://${domain}/`;
      resourceHandler.setSubstitution(domain, ioService.newURI(mountURI, null, null));

      setPrefs("extensions." + id + ".sdk", {
        id: id,
        version: version,
        domain: domain,
        mainPath: options.mainPath,
        baseURI: baseURI,
        rootURI: rootURI,
        load: {
          reason: reason,
          command: loadCommand
        },
        input: {
          staticArgs: JSON.stringify(options.staticArgs)
        },
        output: {
          resultFile: options.resultFile,
          style: options.parseable ? "tbpl" : null,
          logLevel: options.verbose ? "verbose" : null,
        },
        test: {
          stop: options.stopOnError ? 1 : null,
          filter: options.filter,
          iterations: options.iterations,
        },
        profile: {
          memory: options.profileMemory,
          leaks: options.check_memory ? "refcount" : null
        }
      });

      const loader = Loader({
        id: id,
        isNative: isNative,
        prefixURI: baseURI,
        rootURI: baseURI,
        name: name,
        paths: {
          "": "resource://gre/modules/commonjs/",
          "devtools/": "resource://gre/modules/devtools/",
          "./": baseURI
        },
        manifest: metadata,
        metadata: metadata,
        modules: {
          '@test/options': {},
          "toolkit/loader": require("toolkit/loader")
        },
        noQuit: getPref("extensions." + id + ".sdk.test.no-quit", false)
      });
      this.loader = loader;

      const module = Module("package.json", `${baseURI}package.json`);

      const { startup } = Require(loader, module)("sdk/addon/runner")
      startup(reason, {
        loader: loader,
        main: metadata.main || "./index.js"
      });

      console.log("Loaded main");
    }
    catch (error) {
      console.error("Failed to bootstrap addon: ", id, error);
      throw error;
    }
  },
  shutdown(data, reasonCode) {
    let reason = REASON[reasonCode];
    if (this.loader) {
      unload(this.loader, reason);

      Cc["@mozilla.org/timer;1"].
        createInstance(Ci.nsITimer).
        initWithCallback(this,
                         1000,
                         Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },
  nuke() {
    let {loader} = this;
    for (let uri of Object.keys(loader.sandboxes)) {
      Cu.nukeSandbox(loader.sandboxes[uri]);
      delete loader.sandboxes[uri];
      delete loader.modules[uri];
    }
    this.loader = null;
  },
  notify() {
    this.nuke();
  }
}
exports.Bootstrap = Bootstrap;
