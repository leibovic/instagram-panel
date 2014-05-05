const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const ADDON_ID = "instagram.panel@margaretleibovic.com";
const PANEL_ID = "instagram.panel@margaretleibovic.com";
const DATASET_ID = "instagram.dataset@margaretleibovic.com";

XPCOMUtils.defineLazyGetter(this, "Strings", function() {
  return Services.strings.createBundle("chrome://instagrampanel/locale/instagrampanel.properties");
});

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

function openPanel() {
  Services.wm.getMostRecentWindow("navigator:browser").BrowserApp.loadURI("about:home?panel=" + PANEL_ID);
}

function refreshDataset() {
  function callback(response) {
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
  }

  if (Instagram.isAuthenticated()) {
    Instagram.getUserFeed(callback);
  } else {
    Instagram.getPopularFeed(callback);
  }
}

function deleteDataset() {
  Task.spawn(function* () {
    let storage = HomeProvider.getStorage(DATASET_ID);
    yield storage.deleteAll();
  }).then(null, e => Cu.reportError("Error deleting data from HomeProvider: " + e));
}

function optionsDisplayed(doc, topic, id) {
  if (id != ADDON_ID) {
    return;
  }

  let setting = doc.getElementById("auth-setting");
  let button = doc.getElementById("auth-button");
  updateOptions(setting, button);

  button.addEventListener("click", function(e) {
    if (Instagram.isAuthenticated()) {
      // Log out
      Instagram.clearAccessToken();
      refreshDataset();
      updateOptions(setting, button);
    } else {
      // Log in
      Instagram.authenticate(function() {
        refreshDataset();
        updateOptions(setting, button);
      });
    }
  });
}

function updateOptions(setting, button) {
  if (Instagram.isAuthenticated()) {
    Instagram.getUserInfo(function (response) {
      setting.setAttribute("title",  Strings.browser.formatStringFromName("loggedInAs", [response.data.username], 1));
    });
    button.setAttribute("label", Strings.GetStringFromName("logOut"));
  } else {
    setting.setAttribute("title", Strings.GetStringFromName("notLoggedIn"));
    button.setAttribute("label", Strings.GetStringFromName("logIn"));
  }
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

  Services.obs.addObserver(optionsDisplayed, AddonManager.OPTIONS_NOTIFICATION_DISPLAYED, false);
}

function shutdown(data, reason) {
  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    Home.panels.uninstall(PANEL_ID);
    deleteDataset();
    Instagram.clearAccessToken();
  }

  Home.panels.unregister(PANEL_ID);

  Services.obs.removeObserver(optionsDisplayed, AddonManager.OPTIONS_NOTIFICATION_DISPLAYED);
}

function install(data, reason) {}

function uninstall(data, reason) {}
