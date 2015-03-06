"use strict";

const baseURI = module.uri.replace("/util.js", "");

const writeBootstrap = (mountURI, manifest) =>
`"use strict";
const { utils: Cu } = Components;
const {require} = Cu.import("${baseURI}/toolkit/require.js", {});
const {Bootstrap} = require("${baseURI}/boot.js");
const {startup, shutdown, install, uninstall} = new Bootstrap("${mountURI}");
`
exports.writeBootstrap = writeBootstrap;
