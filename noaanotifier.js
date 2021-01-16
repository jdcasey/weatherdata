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
        station: null,
        initialLoadDelay: 0, // 0 seconds delay
        retryDelay: 2500,

        apiBase: "https://api.weather.gov",
        updateInterval: 10 * 60 * 1000, // every 10 minutes
    },

    NOTIFICATION_GRIDPOINT_DATA: "NOAAWEATHER_GRIDPOINT_DATA",
    NOTIFICATION_GRIDPOINT_CURRENT_DATA: "NOAAWEATHER_GRIDPOINT_CURRENT_DATA",
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

    makeRequest: function(url, self){
        return new Promise(function(resolve, reject){
            var request = new XMLHttpRequest();
            Log.log("Requesting from URL: " + url);
            request.open("GET", url, true);

            request.onload = function () {
                if ( this.status === 200 ){
                    // Log.log("URL: " + url + "\nhas response body:\n\n" + request.response);
                    resolve(JSON.parse(request.response));
                }
                else{
                    self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);

                    Log.error("Error calling " + url + ": " + this.status + " " + request.statusText );
                    reject({
                        status: this.status,
                        statusText: request.statusText,
                        err: "Response status: " + this.status,
                    });
                }
            };

            request.onerror = function(err){
                self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
                Log.error("Error calling " + url, err );
                reject({
                    status: this.status,
                    statusText: request.statusText,
                    err: err,
                });
            };

            request.send();
        });
    },

    makeCurrentData: function(response){
      Log.log("Creating current weather data object.");
      const p = response.properties;

      const feelsLike = p.windChill.value === null ?
        p.heatIndex.value :
        p.windChill.value;

       return {
        temp: p.temperature.value,
        humidity: p.relativeHumidity.value,
        feelsLike: feelsLike,
        windSpeed: p.windSpeed.value,
        windDeg: p.windDirection.value,
        weatherIcon: p.icon,
      };
    },

    updateWeatherInfo: function(){
        // this.scheduleUpdate();

        // Log.log("Looking up NOAA weather by lat/long");

        const startUrl = this.config.apiBase + '/points/' + this.config.lat + "," + this.config.lon;
        const self = this;
        let officeData = {};

        let pendingNotifications = {};

        Log.log("Retrieving gridpoint information from: '" + startUrl + "'");
        this.makeRequest(startUrl, self)
        .then((response)=>{
          officeData = response;
          pendingNotifications[this.NOTIFICATION_GRIDPOINT_DATA] = response;
        })
        .then(()=>{
          if ( self.config.station === null || self.config.station === 'undefined' ){
            Log.log("Loading observation stations recorded at gridpoint.");
            return self.makeRequest(officeData.properties.observationStations, self)
            .then((obsResp)=>{
              Log.log("Loading observation data from stations recorded at gridpoint.");
              return self.makeRequest(obsResp.observationStations[0]  + "/observations/latest", self)
              .then((resp)=>{
                pendingNotifications[self.NOTIFICATION_CURRENT_DATA] = self.makeCurrentData(resp);
              })
              .catch((err) =>{
                self.updateDom(self.config.animationSpeed);
                Log.error("Failed to load current information for: " + obsResp.observationStations[0], err);
              });
            })
            .catch((err) =>{
              self.updateDom(self.config.animationSpeed);
              Log.error("Failed to load observation stations for Lat/Lon: " + self.config.lat + "," + self.config.lon, err);
            });
          }
          else{
            const currentUrl = self.config.apiBase + '/stations/' + self.config.station + "/observations/latest";
            Log.log("Loading observation data from configured station.");
            return self.makeRequest(currentUrl, self)
            .then((resp)=>{
              pendingNotifications[self.NOTIFICATION_CURRENT_DATA] = self.makeCurrentData(resp);
            })
            .catch((err) =>{
              self.updateDom(self.config.animationSpeed);
              Log.error("Failed to load current information for Lat/Lon: " + self.config.lat + "," + self.config.lon, err);
            });
          }
        })
        .then(()=>{
          Log.log("Got NWS office data.");

          let urlToKey={};
          urlToKey[officeData.properties.forecastGridData] = self.NOTIFICATION_GRIDPOINT_CURRENT_DATA,
          urlToKey[officeData.properties.forecastHourly] = self.NOTIFICATION_HOURLY_DATA;
          urlToKey[officeData.properties.forecast] = self.NOTIFICATION_FORECAST_DATA;

          let promises = [];
          Object.keys(urlToKey).forEach((u)=>{
            promises.push(
              self.makeRequest(u, self)
              .then((response)=>{
                const n = urlToKey[u];
                Log.log("Loaded " + n + " from: " + u);
                pendingNotifications[n] = response;
              })
              .catch((err) =>{
                self.updateDom(self.config.animationSpeed);
                Log.error("Failed to load " + n + " information for Lat/Lon: " + self.config.lat + "," + self.config.lon, err);
              })
            );
          });

          return Promise.all(promises);
        })
        .then((values)=>{
          Log.log("All weather data loaded.");
          Object.keys(pendingNotifications).forEach((n)=>{
            Log.log("Sending notification: " + n);
            self.sendNotification(n, pendingNotifications[n]);
          })
        })
        .catch(function(err){
            self.updateDom(self.config.animationSpeed);
            Log.error("Failed to load weather information for Lat/Lon: " + self.config.lat + "," + self.config.lon, err);
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
