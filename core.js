const { Cc, Ci } = require("chrome");
const { OS: {File}} = require("resource://gre/modules/osfile.jsm");
const { Task } = require("resource://gre/modules/Task.jsm");
const { Conversion, Status } = require("./dev/gcli");
const { fromFilename: toFileURI } = require("sdk/url");
const { ZipWriter } = require("./zip");
const { readManifest } = require("./rdf");
const { writeBootstrap } = require("./util");
const { read, remove, isDirectory, exists, list, listTree, uriToPath } = require("./io");
const { TextDecoder } = require("sdk/io/buffer");
const { tmpdir } = require("node/os");
const { uninstall, install, disable, enable } = require("sdk/addon/installer");
const { set, get } = require("sdk/preferences/service");


const path = require("sdk/fs/path");

const { AddonManager } = require("resource://gre/modules/AddonManager.jsm");

function getAllAddons() {
    return new Promise((resolve, reject) => {
        AddonManager.getAllAddons(resolve);
    })
}

const Addon = {
    name: "Addon",
    parent: "string",
    parse(arg) {
        let {text:input} = arg;

        return Task.spawn(function*() {
            let addons = yield getAllAddons();
            let predictions = addons.map((addon) => {
                if (addon.id.match(input)) {
                    return { name: addon.id, incomplete: addon.id !== input }
                }
            });

            return new Conversion(input, arg, Status.VALID, "", predictions);
        });
    }
};

exports.Addon = Addon;

const ExistingDirectoryPath = {
  name: "ExistingDirectoryPath",
  parent: "string",
  parse(arg) {
    let {text:input} = arg;

    return Task.spawn(function*() {
      if ((yield exists(input)) &&
          (yield isDirectory(input)))
      {

        let predictions = []
        let entries = yield list(input)
        for (let entry of entries) {
          if (yield isDirectory(entry)) {
            predictions.push({name: entry,
                              incomplete: true})
          }
        }
        return new Conversion(input, arg,
                              Status.VALID,
                              "",
                              predictions)
      } else {
        let base = path.dirname(input)
        if (!(yield exists(base)) ||
            !(yield isDirectory(base)))
        {
          return new Conversion(base, arg,
                                Status.ERROR,
                                "There is no directory matching typed path")
        } else {
          let predictions = []
          let entries = yield list(base)
          for (let entry of entries) {
            if (entry.startsWith(input) &&
                (yield isDirectory(entry)))
            {
              predictions.push({name: entry,
                                incomplete: true})
            }
          }

          if (predictions.length > 0) {
            return new Conversion(void(0), arg,
                                  Status.INCOMPLETE,
                                  "",
                                  predictions)
          } else {
            return new Conversion(input, arg,
                                  Status.ERROR,
                                  "There is no directories that match typed path",
                                  predictions)
          }
        }
      }
    });
  },
  stringify(value) {
    return value
  }
}
exports.ExistingDirectoryPath = ExistingDirectoryPath

const installAddon = {
    name: "addon install",
    description: "Install add-on xpi",
    params: [{name: "addon_xpi",
              type: "string",
              description: "Add-on to install by add-on xpi"}],
    exec: ({addon_xpi}) => {
        return install(addon_xpi);
    }
};
exports.installAddon = installAddon;

const uninstallAddon = {
    name: "addon uninstall",
    description: "Install add-on",
    params: [{name: "addon",
              type: "Addon",
              description: "Add-on to uninstall by add-on id"}],
    exec: ({addon_id}) => {
        return uninstall(addon_id);
    }
};
exports.uninstallAddon = uninstallAddon;

const mountAddon = {
  name: "addon mount",
  description: "Load folder as an add-on",
  params: [{name: "path",
            type: "ExistingDirectoryPath",
            description: "Path to an add-on directory"}],
  exec: ({path: root}, context) => {
    console.log("mount", root)
    let mountURI = toFileURI(root)
    console.log("mount", mountURI)
    return Task.spawn(function*() {
      const manifestData = yield read(path.join(root, "package.json"));
      const decoder = new TextDecoder();
      const manifest = JSON.parse(decoder.decode(manifestData));
      console.log(manifest)
      const rdf = readManifest(manifest);
      console.log(rdf)
      const bootstrap = writeBootstrap(mountURI, manifest);
      const xpiPath = `${tmpdir()}/${manifest.name}.xpi`
      console.log(bootstrap)
      const zip = new ZipWriter({
        "bootstrap.js": new ZipWriter.StringDataEntry(bootstrap),
        "install.rdf": new ZipWriter.StringDataEntry(rdf)
      });
      yield zip.write(xpiPath);
      yield install(xpiPath);
      yield remove(xpiPath);
    });
  }
};
exports.mountAddon = mountAddon;

const reloadAddon = {
  name: "addon reload",
  description: "Reload add-on",
  params: [{name: "addon_id",
            type: "Addon",
            description: "Add-on to reloaded by addon id"}],
  exec: ({addon_id}) => {
    return disable(addon_id).then(_ => {
      Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService).
        notifyObservers({}, "startupcache-invalidate", null);

      return enable(addon_id);
    });
  }
};
exports.reloadAddon = reloadAddon;

const exportAddon = {
  name: "addon export",
  description: "Export an add-on as an xpi",
  params: [{name: "addon_id",
            type: "Addon",
            description: "Mounted add-on to export"},
           {name: "path",
            type: "ExistingDirectoryPath",
            description: "Path to export add-on to"}],
  exec({addon_id, path: targetPath}) {
    return Task.spawn(function*() {
      const mountURI = get(`extensions.${addon_id}.mountURI`)
      if (mountURI) {
        const root = uriToPath(mountURI);
        const manifestData = yield read(path.join(root, "package.json"));
        const decoder = new TextDecoder();
        const manifest = JSON.parse(decoder.decode(manifestData));
        console.log(manifest)
        const rdf = readManifest(manifest);
        console.log(rdf)
        const bootstrap = writeBootstrap("", manifest);
        const xpiPath = `${targetPath}/${manifest.name}.xpi`

        const content = {
          "bootstrap.js": new ZipWriter.StringDataEntry(bootstrap),
          "install.rdf": new ZipWriter.StringDataEntry(rdf)
        };

        const entries = yield listTree(root, {includeDirectories: false});
        for (let entry of entries) {
          content[`src/${path.relative(root, entry)}`] = new ZipWriter.FileEntry(entry);
        }

        console.log(content);
        const zip = new ZipWriter(content);
        yield zip.write(xpiPath);
      } else {
        throw Error("Only mounted add-ons can be exported");
      }
    });
  }
};
exports.exportAddon = exportAddon;
