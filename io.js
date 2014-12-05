"use strict";

const { OS: {File, Path}} = require("resource://gre/modules/osfile.jsm");
const { Task } = require("resource://gre/modules/Task.jsm");

const uriToPath = uri => Path.fromFileURI(uri);
exports.uriToPath = uriToPath;

const exists = path => File.exists(path);
exports.exists = exists;

const isDirectory = path => File.stat(path).then(({isDir}) => isDir);
exports.isDirectory = isDirectory;

const isFile = path => isDirectory(path).then(x => !x);
exports.isFile = isFile;

const list = directory => Task.spawn(function*(){
  let iterator = new File.DirectoryIterator(directory);
  let entries = []
  try {
    while (true) {
     let {path} = yield iterator.next();
     entries.push(path);
    }
  } catch(error) {
    if (error.toString() !== "[object StopIteration]") {
      throw error
    }
  } finally {
    iterator.close();
  }
  return entries;
});
exports.list = list;

const read = path => File.read(path);
exports.read = read;

const remove = path => File.remove(path);
exports.remove = remove;
