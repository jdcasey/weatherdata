/* Magic Mirror
 * Module: NOAACurrent
 * By John Casey https://github.com/jdcasey
 *
 * Based on Module: CurrentWeather, 
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("noaanotifier", {
    // Default module config.
    defaults: {
        lat: config.lat,
        lon: config.lon,
        initialLoadDelay: 0, // 0 seconds delay
        retryDelay: 2500,

        apiBase: "https://api.weather.gov",
        updateInterval: 10 * 60 * 1000, // every 10 minutes
    },

    NOTIFICATION_GRIDPOINT_DATA: "NOAAWEATHER_GRIDPOINT_DATA",
    NOTIFICATION_CURRENT_DATA: "NOAAWEATHER_CURRENT_DATA",
    NOTIFICATION_HOURLY_DATA: "NOAAWEATHER_HOURLY_DATA",
    NOTIFICATION_FORECAST_DATA: "NOAAWEATHER_FORECAST_DATA",

    // Define required scripts.
    getScripts: function () {
        return [];
    },

    // Define required scripts.
    getStyles: function () {
        return [];
    },

    // Define required translations.
    getTranslations: function () {
        // The translations for the default modules are defined in the core translation files.
        // Therefor we can just return false. Otherwise we should have returned a dictionary.
        // If you're trying to build your own module including translations, check out the documentation.
        return false;
    },

    // Define start sequence.
    start: function () {
        Log.info("Starting module: " + this.name);

        this.scheduleUpdate(this.config.initialLoadDelay);
    },

    makeRequest: function(method, url, self){
        return new Promise(function(resolve, reject){
            var request = new XMLHttpRequest();
            request.open(method, url, true);

            request.onload = function () {
                if ( this.status === 200 ){
                    resolve(JSON.parse(request.response));
                }
                else{
                    self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);

                    Log.error("Error calling " + url + ": " + this.status + " " + request.statusText );
                    reject({
                        status: this.status,
                        statusText: request.statusText
                    });
                }
            };

            request.onerror = function(err){
                self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
                Log.error("Error calling " + url + ": " + err )
                reject({
                    status: this.status,
                    statusText: request.statusText,
                    err: err,
                });
            };

            request.send();
        });
    },

    loadAndNotify: function(url, notification){
        var self = this;

        Log.log("Looking up " + notification + " from NOAA URL: " + url);
        return this.makeRequest("GET", url, self)
            .then((response)=>{
                Log.log("Notifying of " + notification);
                self.sendNotification(notification, response);
                Log.log(notification + " sent.");
                return response;
            })
            .catch(function(err){
                Log.error("Failed to load NOAA hourly forecast for Lat/Lon: " + self.config.lat + "," + self.config.lon + ": " + err.status);
                return null;
            });
    },

    updateWeatherInfo: function(){
        // this.scheduleUpdate();

        // Log.log("Looking up NOAA weather by lat/long");

        var url = this.config.apiBase + '/points/' + this.config.lat + "," + this.config.lon;
        var self = this;
        var officeData = {};

        Log.log("Retrieving gridpoint information from: '" + url + "'");
        this.loadAndNotify(url, this.NOTIFICATION_GRIDPOINT_DATA.toString())
        .then(function(response){
            officeData = response;
        })
        .then((response)=>{
            Log.log("Got NWS office data.");

            self.loadAndNotify(officeData.properties.forecastGridData, self.NOTIFICATION_CURRENT_DATA.toString());
            self.loadAndNotify(officeData.properties.forecastHourly, self.NOTIFICATION_HOURLY_DATA.toString());
            self.loadAndNotify(officeData.properties.forecast, self.NOTIFICATION_FORECAST_DATA.toString());
        })
        .catch(function(err){
            self.updateDom(self.config.animationSpeed);
            Log.error("Failed to load NOAA information for Lat/Lon: " + self.config.lat + "," + self.config.lon);
        });

        this.scheduleUpdate();
    },

    /* scheduleUpdate()
     * Schedule next update.
     *
     * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
     */
    scheduleUpdate: function (delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }

        Log.log("Scheduling update for weather at " + nextLoad);

        var self = this;
        setTimeout(function () {
            self.updateWeatherInfo();
        }, nextLoad);
    },

});
