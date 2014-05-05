"use strict";

XPCOMUtils.defineLazyGetter(this, "Client", function() {
  let sandbox = {};
  Services.scriptloader.loadSubScript("chrome://instagrampanel/content/key.js", sandbox);
  return { id: sandbox.CLIENT_ID, secret: sandbox.CLIENT_SECRET };
});

var Instagram = {
  getPopular: function(callback) {
    let url = "https://api.instagram.com/v1/media/popular?client_id=" + Client.id;
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
