/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8c46aa05b12f37c1989f449803bb6b9c"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d7935889faafac8c7f0bd7711699cac2"
  }, {
    "url": "pwa-192x192.png",
    "revision": "09270a1d182c1d94e2e1a78a9817bc9f"
  }, {
    "url": "index.html",
    "revision": "c851e64f038d6b1b990fa5e2b3d3552d"
  }, {
    "url": "icon.svg",
    "revision": "ebbdc97aed1061f15949e305dfc2f927"
  }, {
    "url": "favicon.ico",
    "revision": "49a3d83c39206e2f4b44145d64962033"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "04a62188f81d7f5ec638038de3da703e"
  }, {
    "url": "assets/web-kNx06hwd.js",
    "revision": null
  }, {
    "url": "assets/web-D5P1KgYg.js",
    "revision": null
  }, {
    "url": "assets/web-CSOuB0dX.js",
    "revision": null
  }, {
    "url": "assets/web-BwFNWFDm.js",
    "revision": null
  }, {
    "url": "assets/index-e7XXuX9t.css",
    "revision": null
  }, {
    "url": "assets/index-SN5m7MG9.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "04a62188f81d7f5ec638038de3da703e"
  }, {
    "url": "icon.svg",
    "revision": "ebbdc97aed1061f15949e305dfc2f927"
  }, {
    "url": "pwa-192x192.png",
    "revision": "09270a1d182c1d94e2e1a78a9817bc9f"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d7935889faafac8c7f0bd7711699cac2"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8c46aa05b12f37c1989f449803bb6b9c"
  }, {
    "url": "manifest.webmanifest",
    "revision": "2fc406fcedfcef19c73952ef87e4fdcc"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
