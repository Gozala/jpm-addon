"use strict";

const gcli = require("./dev/gcli");
const { Addon, ExistingDirectoryPath, mountAddon,
        reloadAddon, exportAddon, installAddon, uninstallAddon } = require("./core");

gcli.uninstall(Addon, ExistingDirectoryPath,
               mountAddon, reloadAddon, exportAddon, installAddon, uninstallAddon);
gcli.install(Addon, ExistingDirectoryPath,
             mountAddon, reloadAddon, exportAddon, installAddon, uninstallAddon);
