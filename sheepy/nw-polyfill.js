(function () {
  function createStub() {
    return new Proxy(function(){}, {
      get: function (target, prop) {
        if (prop === "toString") return function () { return ""; };
        if (prop === Symbol.toPrimitive) return function () { return ""; };
        return createStub();
      },
      apply: function () { return ""; }
    });
  }

  var modules = {};

  // --- localStorage-backed fs module for game saves ---

  var LS_PREFIX = "_sheepy_";

  var DEFAULT_SAVE = '{"c2array":true,"size":[1,1,1],"data":[[[""]]]}';

  seedSaves: {
    try {
      if (localStorage.getItem(LS_PREFIX + "save1.json") === null) {
        localStorage.setItem(LS_PREFIX + "save1.json", DEFAULT_SAVE);
        localStorage.setItem(LS_PREFIX + "save2.json", DEFAULT_SAVE);
        localStorage.setItem(LS_PREFIX + "save3.json", DEFAULT_SAVE);
      }
    } catch (e) {}
  }

  function lsKey(path) {
    var i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return LS_PREFIX + (i >= 0 ? path.substring(i + 1) : path);
  }

  function enoent(msg) {
    var e = new Error(msg);
    e.code = "ENOENT";
    e.errno = -2;
    return e;
  }

  var mockFs = {
    readFileSync: function (path, opts) {
      var key = lsKey(path);
      var v = localStorage.getItem(key);
      if (v === null) throw enoent("ENOENT: open '" + path + "'");
      return v;
    },
    writeFileSync: function (path, data, opts) {
      localStorage.setItem(lsKey(path), data);
    },
    existsSync: function (path) {
      return localStorage.getItem(lsKey(path)) !== null;
    },
    unlinkSync: function (path) {
      localStorage.removeItem(lsKey(path));
    },
    renameSync: function (oldPath, newPath) {
      var oldKey = lsKey(oldPath);
      var newKey = lsKey(newPath);
      var v = localStorage.getItem(oldKey);
      if (v === null) throw enoent("ENOENT: rename '" + oldPath + "'");
      localStorage.setItem(newKey, v);
      localStorage.removeItem(oldKey);
    },
    copyfileSync: function (src, dest) {
      var srcKey = lsKey(src);
      var destKey = lsKey(dest);
      var v = localStorage.getItem(srcKey);
      if (v === null) throw enoent("ENOENT: copy '" + src + "'");
      localStorage.setItem(destKey, v);
    },
    readdirSync: function (path) {
      var files = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) {
          files.push(k.substring(LS_PREFIX.length));
        }
      }
      return files;
    },
    statSync: function (path) {
      var key = lsKey(path);
      var v = localStorage.getItem(key);
      if (v === null) throw enoent("ENOENT: stat '" + path + "'");
      return { size: v.length, isFile: function () { return true; }, isDirectory: function () { return false; } };
    },
    appendFileSync: function (path, data, opts) {
      var key = lsKey(path);
      var existing = localStorage.getItem(key) || "";
      localStorage.setItem(key, existing + data);
    },
    mkdirSync: function (path) {},
    readFile: function (path, opts, cb) {
      if (typeof opts === "function") { cb = opts; opts = {}; }
      setTimeout(function () {
        try { cb(null, mockFs.readFileSync(path, opts)); }
        catch (e) { cb(e); }
      }, 0);
    },
    writeFile: function (path, data, opts, cb) {
      if (typeof opts === "function") { cb = opts; opts = {}; }
      setTimeout(function () {
        try { mockFs.writeFileSync(path, data, opts); cb(null); }
        catch (e) { cb(e); }
      }, 0);
    },
  };

  self.require = function (name) {
    if (modules[name]) return modules[name];

    if (name === "fs") {
      modules[name] = mockFs;
      return mockFs;
    }

    if (name === "./greenworks") {
      var gw = {
        init: function () { return true; },
        initAPI: function () { return true; },
        isSteamRunning: function () { return true; },
        getSteamId: function () { return null; },
        isGameOverlayEnabled: function () { return false; },
        isSteamRunningOnSteamDeck: function () { return false; },
        getCurrentGameLanguage: function () { return "english"; },
        getCurrentUILanguage: function () { return "english"; },
        activateAchievement: function (name, resolve, reject) {
          if (typeof resolve === "function") resolve();
        },
        activateGameOverlay: function () {},
        on: function () {},
        _version: "0.0.0",
      };
      modules[name] = gw;
      return gw;
    }

    modules[name] = createStub();
    return modules[name];
  };

  self.process = {
    platform: "browser",
    arch: "js",
    versions: { node: "0.0.0", greenworks: "0.0.0" },
    env: {},
    argv: [],
    execPath: "/",
    mainModule: { filename: "/index.html" },
    on: function () {},
    exit: function () {},
  };

  self.nw = {
    process: self.process,
    App: {
      clearCache: function () {},
      argv: [],
      manifest: {},
    },
    Window: {
      get: function () {
        return {
          title: document.title || "",
          x: window.screenX || 0,
          y: window.screenY || 0,
          width: window.innerWidth || 640,
          height: window.innerHeight || 360,
          on: function () {},
          setInnerWidth: function () {},
          setMaximumSize: function () {},
          setMinimumSize: function () {},
          setResizable: function () {},
          setAlwaysOnTop: function () {},
          requestAttention: function () {},
          minimize: function () {},
          maximize: function () {},
          unmaximize: function () {},
          restore: function () {},
          showDevTools: function () {},
        };
      },
    },
    Clipboard: {
      get: function () {
        return {
          get: function () { return ""; },
          set: function () {},
          clear: function () {},
        };
      },
    },
    Shell: {
      openItem: function () {},
      openExternal: function () {},
    },
  };

  // Prevent the game from triggering Fullscreen API
  var elemProto = Element.prototype;
  if (elemProto.requestFullscreen) {
    elemProto.requestFullscreen = function () {
      return Promise.reject(new Error("blocked"));
    };
  }
  if (elemProto.webkitRequestFullScreen) {
    elemProto.webkitRequestFullScreen = function () {};
  }
  if (elemProto.mozRequestFullScreen) {
    elemProto.mozRequestFullScreen = function () {};
  }
  if (elemProto.msRequestFullscreen) {
    elemProto.msRequestFullscreen = function () {};
  }
})();
