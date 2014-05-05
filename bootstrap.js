const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Messaging.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Make these IDs unique, preferably tied to a domain that you own.
const PANEL_ID = "instagram.panel@margaretleibovic.com";
const DATASET_ID = "instagram.dataset@margaretleibovic.com";

// An example of how to create a string bundle for localization.
XPCOMUtils.defineLazyGetter(this, "Strings", function() {
  return Services.strings.createBundle("chrome://instagrampanel/locale/instagrampanel.properties");
});

// An example of how to import a helper module.
XPCOMUtils.defineLazyGetter(this, "Instagram", function() {
  let win = Services.wm.getMostRecentWindow("navigator:browser");
  Services.scriptloader.loadSubScript("chrome://instagrampanel/content/instagram.js", win);
  return win["Instagram"];
});

function optionsCallback() {
  return {
    title: Strings.GetStringFromName("title"),
    views: [{
      type: Home.panels.View.GRID,
      dataset: DATASET_ID,
      onrefresh: refreshDataset
    }]
  };
}

function refreshDataset() {
  Instagram.getPopular(function (response) {
    let items = [];
    response.data.forEach(function (d) {
      let item = {
        url: d.link,
        image_url: d.images.standard_resolution.url // 640x640
      };
      items.push(item);
    });

    Task.spawn(function* () {
      let storage = HomeProvider.getStorage(DATASET_ID);
      yield storage.deleteAll();
      yield storage.save(items);
    }).then(null, e => Cu.reportError("Error refreshing dataset " + DATASET_ID + ": " + e));
  });
}

function deleteDataset() {
  Task.spawn(function* () {
    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
  }).then(null, e => Cu.reportError("Error deleting data from HomeProvider: " + e));
}

/**
 * bootstrap.js API
 * https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions
 */
function startup(data, reason) {
  // Always register your panel on startup.
  Home.panels.register(PANEL_ID, optionsCallback);

  switch(reason) {
    case ADDON_INSTALL:
      Home.panels.install(PANEL_ID);
      HomeProvider.requestSync(DATASET_ID, refreshDataset);
      break;

    case ADDON_UPGRADE:
    case ADDON_DOWNGRADE:
      Home.panels.update(PANEL_ID);
      break;
  }

  // Update data once every hour.
  HomeProvider.addPeriodicSync(DATASET_ID, 3600, refreshDataset);
}

function shutdown(data, reason) {
  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    Home.panels.uninstall(PANEL_ID);
    deleteDataset();
  }

  Home.panels.unregister(PANEL_ID);
}

function install(data, reason) {}

function uninstall(data, reason) {}
