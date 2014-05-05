"use strict";

XPCOMUtils.defineLazyGetter(this, "CLIENT_ID", function() {
  let sandbox = {};
  Services.scriptloader.loadSubScript("chrome://instagrampanel/content/key.js", sandbox);
  return sandbox.CLIENT_ID;
});

const ACCESS_TOKEN_PREF = "margaretleibovic.instagram.accessToken";
const REDIRECT_URI = "http://margaretleibovic.com/instagram/";

var Instagram = {
  _accessToken: "",

  get accessToken() {
    if (this._accessToken) {
      return this._accessToken;
    }
    try {
      this._accessToken = Services.prefs.getCharPref(ACCESS_TOKEN_PREF);
    } catch (e) {}

    return this._accessToken;
  },

  set accessToken(token) {
    this._accessToken = token;
    Services.prefs.setCharPref(ACCESS_TOKEN_PREF, token);
  },

  isAuthenticated: function() {
    return !!this.accessToken;
  },

  clearAccessToken: function() {
    Services.prefs.clearUserPref(ACCESS_TOKEN_PREF);
  },

  authenticate: function(callback) {
    let authUrl = "https://instagram.com/oauth/authorize/?response_type=token&" +
      "client_id=" + CLIENT_ID + "&redirect_uri=" + REDIRECT_URI;

    let tab = window.BrowserApp.addTab(authUrl);
    tab.browser.addEventListener("pageshow", evt => {
      let href = tab.browser.contentWindow.location.href;
      if (href.startsWith(REDIRECT_URI)) {
        let index = href.indexOf("access_token=") + "access_token=".length;
        this.accessToken = href.substring(index);
        callback();
        window.BrowserApp.closeTab(tab);
      }
    }, false);
  },

  getUserInfo: function(callback) {
    if (!this.isAuthenticated()) {
      throw "Can't get user info because user isn't authenticated";
    }
    let url = "https://api.instagram.com/v1/users/self?access_token=" + this.accessToken;
    this._get(url, callback);
  },

  getUserFeed: function(callback) {
    if (!this.isAuthenticated()) {
      throw "Can't get user feed because user isn't authenticated";
    }
    let url = "https://api.instagram.com/v1/users/self/feed?access_token=" + this.accessToken;
    this._get(url, callback);
  },

  getPopularFeed: function(callback) {
    let url = "https://api.instagram.com/v1/media/popular?client_id=" + CLIENT_ID;
    this._get(url, callback);
  },

  /**
   * @param callback function takes response JSON as a parameter
   */
  _get: function(url, callback) {
    let req = new XMLHttpRequest();
    req.addEventListener("error", evt => {
      Cu.reportError("Pocket: POST error - " + url + ": " + req.statusText);
    }, false);
    req.addEventListener("abort", evt => {
      Cu.reportError("Pocket: POST abort - " + url + ": " + req.statusText);
    }, false);

    req.addEventListener("load", evt => {
      if (req.status === 401) {
        Cu.reportError("Pocket: POST fail - " + url + ": not authenticated");
      } else if (req.status === 200 && callback) {
        let response = JSON.parse(req.responseText);
        callback(response);
      }
    }, false);

    req.open("GET", url);
    req.setRequestHeader("Content-type", "application/json; charset=UTF8");
    req.setRequestHeader("X-Accept", "application/json");
    req.send();
  }
};
