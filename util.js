"use strict";

const writeBootstrap = (mountURI, manifest) =>
`"use strict";
const { utils: Cu } = Components;
const {require} = Cu.import("resource://gre/modules/commonjs/toolkit/require.js", {});
const {Bootstrap} = require("resource://gre/modules/commonjs/sdk/addon/bootstrap");
const {startup, shutdown, install, uninstall} = new Bootstrap("${mountURI}");
`
exports.writeBootstrap = writeBootstrap;
