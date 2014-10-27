// Cordova specific code for the OAuth package.

// Open a popup window, centered on the screen, and call a callback when it
// closes.
//
// @param url {String} url to show
// @param callback {Function} Callback function to call on completion. Takes no
//   arguments.
// @param dimensions {optional Object(width, height)} The dimensions of
//   the popup. If not passed defaults to something sane.
OAuth.showPopup = function (url, callback, dimensions) {

  var popup;

  var open = function (url) {
    popup = window.open(url, '_blank', 'location=yes,hidden=yes');
    popup.addEventListener('loadstop', pageLoaded);
    popup.addEventListener('loaderror', fail);
    popup.addEventListener('exit', onExit);
    popup.show();
  };

  var fail = function (err) {
    if (err.type === "loaderror" && err.url &&
        Package["oauth-debug-only"] &&
        err.url.indexOf("http://localhost") === 0) {
      var anchor = document.createElement("a");
      anchor.href = err.url;
      var urlPath = anchor.pathname;
      if (urlPath.charAt(0) === "/") {
        urlPath = urlPath.substring(1);
      }
      var urlSearch = anchor.search + "?";
      urlSearch = urlSearch + "&only_credential_secret_for_test=1";

      var newUrl = Meteor.absoluteUrl(urlPath + urlSearch);
      popup.close();

      HTTP.get(newUrl, function (err, result) {
        if (err) {
          Meteor._debug("Error retrieve OAuth secret in OAuth popup: " +
                        JSON.stringify(err));
        } else if (result && result.statusCode === 200 && result.content) {
          callback(result.content);
        } else {
          Meteor._debug("Could not retrieve OAuth secret in OAuth popup: " +
                        result.statusCode);
        }
      });
    } else {
      Meteor._debug("Error from OAuth popup: " + JSON.stringify(err));
    }
  };

  var pageLoaded = function (event) {
    if (event.url.indexOf(Meteor.absoluteUrl('_oauth')) === 0) {
      var splitUrl = event.url.split("#");
      var hashFragment = splitUrl[1];

      if (! hashFragment) {
        throw new Error("No hash fragment in OAuth popup?");
      }

      var credentials = JSON.parse(decodeURIComponent(hashFragment));
      OAuth._handleCredentialSecret(credentials.credentialToken,
                                    credentials.credentialSecret);

      // On iOS, this seems to prevent "Warning: Attempt to dismiss from
      // view controller <MainViewController: ...> while a presentation
      // or dismiss is in progress". My guess is that the last
      // navigation of the OAuth popup is still in progress while we try
      // to close the popup. See
      // https://issues.apache.org/jira/browse/CB-2285.
      //
      // XXX Can we make this timeout smaller?
      setTimeout(function () {
        popup.close();
        callback();
      }, 100);
    }
  };

  var onExit = function () {
    popup.removeEventListener('loadstop', pageLoaded);
    popup.removeEventListener('loaderror', fail);
    popup.removeEventListener('exit', onExit);
  };

  open(url);
};
