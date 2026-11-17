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
    "url": "pwa-maskable-512x512.png",
    "revision": "25a77fe8ed64beb76fcf08bb0b3bdf86"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f37438d0768b7511a497ce9da9572d39"
  }, {
    "url": "pwa-192x192.png",
    "revision": "641801290a5577b0b1ddc95486e84578"
  }, {
    "url": "index.html",
    "revision": "1c82abf8fc32dcbdc2101525f670e223"
  }, {
    "url": "icon.svg",
    "revision": "ebbdc97aed1061f15949e305dfc2f927"
  }, {
    "url": "favicon.ico",
    "revision": "e36853f8d2457f7b7f9d442616217a33"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ee9fd7a51a3fd826cdd124af9e2fad01"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-DRRJ_WjS.js",
    "revision": null
  }, {
    "url": "assets/web-CyPpvsn5.js",
    "revision": null
  }, {
    "url": "assets/web-BkV9GS_m.js",
    "revision": null
  }, {
    "url": "assets/web-BLI-8aJb.js",
    "revision": null
  }, {
    "url": "assets/index-DfyYBkhO.css",
    "revision": null
  }, {
    "url": "assets/index-C905f9W3.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ee9fd7a51a3fd826cdd124af9e2fad01"
  }, {
    "url": "icon.svg",
    "revision": "ebbdc97aed1061f15949e305dfc2f927"
  }, {
    "url": "pwa-192x192.png",
    "revision": "641801290a5577b0b1ddc95486e84578"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f37438d0768b7511a497ce9da9572d39"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "25a77fe8ed64beb76fcf08bb0b3bdf86"
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
