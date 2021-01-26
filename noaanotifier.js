/* Magic Mirror
 * Module: NOAANotifier
 * By John Casey https://github.com/jdcasey
 * MIT Licensed.
 */
Module.register("noaanotifier", {
    // Default module config.
    defaults: {
        // lat: <LATITUDE>,
        // lon: <LONGITUDE>,
        // appid: <API KEY>,
        exclude: 'minutely',
        lat: config.lat,
        lon: config.lon,
        units: config.units,
        api_url: 'https://api.openweathermap.org/data/2.5/onecall',

        updateInterval: 10 * 60 * 1000, // every 10 minutes
    },

    // Define start sequence.
    start: function () {
        Log.info("Starting module: " + this.name);
    },

    notificationReceived: function(noti, payload, sender) {
      if (noti == "DOM_OBJECTS_CREATED") {
        this.sendSocketNotification("START", this.config)
        return
      }
    },

    socketNotificationReceived: function(key, payload) {
      this.sendSocketNotification("LOG", "Sending notification: " + key);
      this.sendNotification(key, payload);
    },

});
