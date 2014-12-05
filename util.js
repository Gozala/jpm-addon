"use strict";

const writeBootstrap = (mountURI, manifest) =>
`"use strict";
const { utils: Cu } = Components;
const {require} = Cu.import("resource://jpm/toolkit/require.js", {});
const {Bootstrap} = require("resource://jpm/boot.js");
const {startup, shutdown, install, uninstall} = new Bootstrap("${mountURI}");
`
exports.writeBootstrap = writeBootstrap;
