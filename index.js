"use strict";

const gcli = require("./dev/gcli");
const { Addon, ExistingDirectoryPath, mountAddon,
        reloadAddon, exportAddon } = require("./core");

gcli.uninstall(Addon, ExistingDirectoryPath, mountAddon, reloadAddon, exportAddon);
gcli.install(Addon, ExistingDirectoryPath, mountAddon, reloadAddon, exportAddon);
