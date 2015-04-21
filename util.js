"use strict";

const rootURI = `__SCRIPT_URI_SPEC__.replace("bootstrap.js", "src/")`;
const writeBootstrap = (mountURI, manifest) =>
`"use strict";
const { utils: Cu } = Components;
const {require} = Cu.import("resource://gre/modules/commonjs/toolkit/require.js", {});
const {Bootstrap} = require("resource://gre/modules/commonjs/sdk/addon/bootstrap");
const {startup, shutdown, install, uninstall} = new Bootstrap(${mountURI ? `"${mountURI}"` : rootURI});
`
exports.writeBootstrap = writeBootstrap;
