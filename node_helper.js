/* Magic Mirror
 * Module: NOAANotifier
 * By John Casey https://github.com/jdcasey
 * MIT Licensed.
 */
const axios = require("axios")
const NodeHelper = require('node_helper')

module.exports = NodeHelper.create({
  start: function() {
    console.log("weather notifier node_helper started.");
  },

  stop: function() {
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case "START":
        this.work(payload);
        break;

      case "LOG":
        console.log(payload);
        break;
    }
  },

  work: function(config) {
    this.startWeatherScan(config, this.updateWeather);
  },

  startWeatherScan: function(config, callback) {
    console.log("weather notifier node_helper: starting weather scan.");
    const url = config.api_url;

    const self = this;
    axios.get(url, {
      params: {
        lat: config.lat,
        lon: config.lon,
        appid: config.appid,
        exclude: config.exclude,
        units: config.units,
      },
    })
    .then(res =>{
      if(res.status == 200){
        callback(res.data, config, self);
      }
    })
    .catch(err =>{
      if(err.response){
        console.error("Error in response:", err.message);
        console.log(err.response.data);
        console.log(err.response.status);
        console.log(err.response.headers);
      }
      else if (err.request){
        console.error("Error in request:", err.message);
        console.log(err.request);
      }
      else{
        console.error('Error constructing request:', err.message);
      }
    })
    .finally(()=>{
      console.log("Weather will be refreshed again in " + (config.updateInterval / 1000) + " seconds.");
      setTimeout( ()=>{
          self.startWeatherScan(config, callback);
        },
        config.updateInterval
      );
    });
  },

  classifyWeather: function(weatherId, feelsLike, sunrise, sunset, dt){
    switch(weatherId){
      case 200:
      case 210:
      case 221:
      case 230:
      case 231:
        return "wi-storm-showers";

      case 201:
      case 202:
      case 211:
      case 212:
      case 232:
        return "wi-thunderstorm";

      case 300:
      case 301:
      case 310:
      case 313:
      case 321:
        return "wi-showers";

      case 302:
      case 311:
      case 312:
      case 314:
      case 321:
        return "wi-rain";

      case 500:
      case 501:
      case 520:
      case 521:
      case 531:
        return "wi-sprinkle";

      case 502:
      case 503:
      case 504:
      case 522:
        return "wi-raindrops";

      case 511:
      case 615:
      case 616:
        return "wi-rain-mix";

      case 600:
      case 601:
      case 620:
      case 621:
        return "wi-snow";

      case 602:
      case 622:
        return "wi-snowflake-cold";

      case 611:
      case 612:
      case 613:
        return "wi-sleet";

      case 701:
      case 741:
        return "wi-fog";

      case 711:
      case 721:
        return "wi-smoke";

      case 731:
      case 751:
      case 761:
      case 762:
        return "wi-dust";

      case 771:
        return "wi-hail";

      case 781:
        return "wi-tornado";

      case 800:
        if ( dt < sunset ){
          return feelsLike > 90 ? "wi-hot" : "wi-day-sunny";
        }
        else{
          return feelsLike < 20 ? "wi-stars" : "wi-night-clear";
        }

      case 801:
      case 802:
        return dt < sunset ? "wi-day-cloudy" : "wi-night-alt-cloudy";

      case 803:
        return "wi-cloudy";

      case 804:
        return "wi-cloud";
    }

    return "wi-meteor";
  },

  classifyWindDeg: function(deg){
    const classes = [
      "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S",
      "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "N"
    ];

    if ( deg < 11.25 ){
      return "N";
    }

    const idx = Math.floor(deg / 22.5);
    return classes[idx];
  },

  updateWeather: function(data, config, self) {
    data.config = config;

    if ( data.current !== undefined ){
      data.current.weather.forEach((w)=>{
        w.weatherClass = self.classifyWeather(w.id, data.current.feels_like, data.current.sunrise, data.current.sunset, data.current.dt);
      });

      data.current.windDirection = self.classifyWindDeg(data.current.wind_deg);
    }

    if ( data.hourly !== undefined ){
      data.hourly.forEach((h)=>{
        h.weather.forEach((w)=>{
          w.weatherClass = self.classifyWeather(w.id, h.feels_like, data.current.sunrise, data.current.sunset, h.dt);
        });

        h.windDirection = self.classifyWindDeg(h.wind_deg);
      });
    }

    if ( data.daily !== undefined ){
      data.daily.forEach((d)=>{
        d.weather.forEach((w)=>{
          w.weatherClass = self.classifyWeather(w.id, d.feels_like.day, 0, 2, 1);
        });

        d.windDirection = self.classifyWindDeg(d.wind_deg);
      });
    }

    console.log("weather notifier node_helper: notifying socket of refreshed weather.");
    if ( data.minutely !== undefined ){
      console.log(`Minutely data has ${data.minutely.length} elements.`);
    }

    self.sendSocketNotification("WEATHER_REFRESHED", data);
  },
});
