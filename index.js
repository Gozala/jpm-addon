"use strict";

const gcli = require("./dev/gcli");
const { ExistingDirectoryPath, mountAddon,
        reloadAddon, exportAddon } = require("./core");

gcli.uninstall(ExistingDirectoryPath, mountAddon, reloadAddon, exportAddon);
gcli.install(ExistingDirectoryPath, mountAddon, reloadAddon, exportAddon);
