const apiKey = 'f4cf9af4f3815f411ad27d36e8c20078';
const storageKey = 'weather-dashboard-saved-locations';
let savedLocations;

// TODO: refactor saved locations into an object to be looked up by key, rather than by index
$(function() {
    const citySearchForm = $('#city-search-form');
    const savedLocationsListEl = $('#saved-locations-list');
    const currentWeatherSection = $('#current-weather');
    const forecastSection = $('#5-day-forecast');

    // load saved locations from localStorage
    savedLocations = localStorage.getItem(storageKey);
    savedLocations = savedLocations != null ? JSON.parse(savedLocations) : [];
    displayLocationList();

    // reset full list of locations
    function displayLocationList() {
        savedLocationsListEl.empty();
        savedLocations.forEach(displayLocationInList);
    }

    // add a location to the history list
    function displayLocationInList(location, index) {
        const listEl = $(`<li data-index=${index} class='list-group-item d-flex align-items-center'></li>`).append(
            $(`<button class='btn btn-primary flex-grow-1 me-1'>${location.name}</button>`),
            $(`<button class='btn-close' aria-label='Remove ${location.name} from shortcuts'></button>`)
        );
        listEl.children().eq(0).on('click', setCurrentCityButtonHandler);
        listEl.children().eq(1).on('click', removeSavedLocationButtonHandler);
        savedLocationsListEl.append(listEl);
    }

    // when the user clicks on a saved location, show weather data for it
    function setCurrentCityButtonHandler() {
        const index = $(this).parent().attr('data-index');
        setCurrentCity(index);
    }

    // allow the user to delete saved locations
    function removeSavedLocationButtonHandler() {
        const index = $(this).parent().attr('data-index');
        savedLocations.splice(index, 1);
        displayLocationList();
        localStorage.setItem(storageKey, JSON.stringify(savedLocations));
    }

    citySearchForm.on('submit', function(event) {
        event.preventDefault();

        const searchTerm = $('#city-input').val();
        fetchGeocodingData(searchTerm);
    })

    /* the search form and history list should be disabled when fetching data
     * to avoid race conditions */
    let disabledCount = 0;
    function setNavigationEnabled(val) {
        const elementsToAdjust = citySearchForm.children().add('#saved-locations-list button');
        if (val == true) {
            disabledCount--;
            if (disabledCount == 0) {
                elementsToAdjust.prop('disabled', false);
            }
        } else {
            if (disabledCount == 0) {
                elementsToAdjust.prop('disabled', true);
            }
            disabledCount++;
        }
    }

    // Find latitude and longitude for a given city
    async function fetchGeocodingData(searchTerm) {
        setNavigationEnabled(false);
        const fetchResult = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${searchTerm}&appId=${apiKey}`);
        if (!fetchResult.ok) {
            setNavigationEnabled(true);
            return;
        }

        const fetchData = await fetchResult.json();
        // a request could return an empty array
        if (Array.isArray(fetchData) && fetchData.length > 0) {
            let updateLocalStorage = false;
            fetchData.forEach(location => {
                let nameStr = location.name;
                if (location.state) {
                    nameStr += ', ' + location.state;
                }
                nameStr += ', ' + location.country;

                // check if the city is already in the saved locations
                const existingIndex = savedLocations.findIndex(savedLoc => savedLoc.name == nameStr);
                if (existingIndex != -1) {
                    // if this is the only result, display data for it automatically
                    if (fetchData.length == 1) {
                        return setCurrentCity(existingIndex);
                    }
                    return;
                }
                
                updateLocalStorage = true;
                const locationToSave = {
                    name: nameStr,
                    lat: location.lat,
                    lon: location.lon
                }
                savedLocations.push(locationToSave);
                displayLocationInList(locationToSave, savedLocations.length - 1);
                if (fetchData.length == 1) {
                    setCurrentCity(savedLocations.length - 1);
                }
            });

            setNavigationEnabled(true);
            if (updateLocalStorage) {
                localStorage.setItem(storageKey, JSON.stringify(savedLocations));
            }
        }
    }

    // Get current and forecast weather data for a city, and show them
    async function setCurrentCity(index) {
        /* The OpenWeatherMap API only updates every 10 minutes, so keep data around
         * and only re-fetch if it's older than that */
        if (dataIsMissingOrOld(index)) {
            setNavigationEnabled(false);
            let [currentData, forecastData] = await Promise.all([
                fetchCurrentWeatherData(index),
                fetchForecastWeatherData(index)
            ]);
            if (currentData && forecastData) {
                savedLocations[index].date = Date.now();
                savedLocations[index].currentWeatherData = currentData;
                savedLocations[index].forecastWeatherData = forecastData;
                localStorage.setItem(storageKey, JSON.stringify(savedLocations));
            }
            setNavigationEnabled(true);
        }
        displayCurrentWeather(savedLocations[index].currentWeatherData);
        displayForecastWeather(savedLocations[index].forecastWeatherData);
    }

    function dataIsMissingOrOld(index) {
        const oldDate = savedLocations[index].date;
        if (!oldDate) {
            return true;
        }
        
        return ((Date.now() - oldDate) / 60000) >= 10;
    }

    // Build the current weather section
    function displayCurrentWeather(weatherData) {
        currentWeatherSection.empty();
        currentWeatherSection.append(
            $(`<h2 class='bg-primary text-white p-3'>${weatherData.name} (${new Date().toLocaleDateString()})</h2>`).append(
                $(`<img src='https://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png' />`)
            ),
            $(`<div class='px-3'></div>`).append(
                $(`<p>Temperature: ${weatherData.main.temp}&deg;C</p>`),
                $(`<p>Wind: ${weatherData.wind.speed} m/s</p>`),
                $(`<p>Humidity: ${weatherData.main.humidity}%</p>`)
            )
        );
        // borders should only be applied if the section is non-empty
        currentWeatherSection.addClass(['border', 'border-2', 'border-primary', 'rounded']);
    }

    async function fetchCurrentWeatherData(index) {
        const lat = savedLocations[index].lat;
        const lon = savedLocations[index].lon;

        const fetchResult = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appId=${apiKey}&units=metric`);
        if (!fetchResult.ok) {
            console.log(`Fetching current weather data failed: status ${fetchResult.status}`);
            return;
        }

        return await fetchResult.json();
    }

    async function fetchForecastWeatherData(index) {
        const lat = savedLocations[index].lat;
        const lon = savedLocations[index].lon;

        const fetchResult = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appId=${apiKey}&units=metric`);
        if (!fetchResult.ok) {
            console.log(`Fetching weather forecast data failed: status ${fetchResult.status}`);
            return;
        }

        const fetchData = await fetchResult.json();
        return processForecastWeatherData(fetchData);
    }

    // Extract highs and lows from the forecast weather data (it returns 8 entries per day)
    function processForecastWeatherData(data) {
        const results = [];
        const formatter = new Intl.DateTimeFormat();
        let currentDayStr;
        let currentDayData;
        let firstSnapshotOfDay;

        data.list.forEach(snapshot => {
            // group data based on day
            const snapshotDayStr = formatter.format(snapshot.dt * 1000);
            // if it's a new day
            if (snapshotDayStr != currentDayStr) {
                // if it's the first day, there's nothing to push
                if (currentDayData) {
                    /* Normally, only daytime icons are displayed (as opposed to night icons).
                     * However, if there are no daytime icons available, show the first night
                     * icon for the current day */
                    if (currentDayData.icons.size == 0) {
                        currentDayData.icons.add(firstSnapshotOfDay.weather[0].icon);
                    }
                    currentDayData.icons = Array.from(currentDayData.icons);
                    results.push(currentDayData);
                }
                currentDayStr = snapshotDayStr;
                currentDayData = {
                    day: snapshotDayStr,
                    high: -Infinity,
                    low: Infinity,
                    wind: -Infinity,
                    humidity: -Infinity,
                    icons: new Set()
                }
                firstSnapshotOfDay = snapshot;
            }

            /* For each day, find the highest and lowest temperatures, the highest wind and humidity
             * and all unique daytime icons */
            currentDayData.high = Math.max(currentDayData.high, snapshot.main.temp);
            currentDayData.low = Math.min(currentDayData.low, snapshot.main.temp);
            currentDayData.wind = Math.max(currentDayData.wind, snapshot.wind.speed);
            currentDayData.humidity = Math.max(currentDayData.humidity, snapshot.main.humidity);
            if (snapshot.weather[0].icon.endsWith('d')) {
                currentDayData.icons.add(snapshot.weather[0].icon);
            }
        });

        return results;
    }

    // Build the 5 day forecast section
    function displayForecastWeather(weatherData) {
        forecastSection.empty();
        forecastSection.append(
            $(`<h2 class='mb-3'>5-Day Forecast:</h2>`),
            $(`<div class='row row-cols-auto g-3'></div>`).append(
                weatherData.map(dayData => $(`<div class='col'></div`).append(  // the column element is necessary for spacing to work right
                    buildForecastDayCard(dayData)
                ))
            )
        );
    }

    // show day data in a bootstrap card
    function buildForecastDayCard(forecastDayData) {
        return $(`<div class='card'></div>`).append(   
            $(`<div class='card-header bg-primary text-white'></div>`).append(
                $(`<h3>${forecastDayData.day}</h3>`),
                $('<div></div>').append(
                    forecastDayData.icons.map(icon => $(`<img src='https://openweathermap.org/img/wn/${icon}.png' />`))
                )
            ),
            $(`<div class='card-body'></div>`).append(
                $(`<p class='card-text'>High: ${forecastDayData.high}&deg;C</p>`),
                $(`<p class='card-text'>Low: ${forecastDayData.low}&deg;C</p>`),
                $(`<p class='card-text'>Wind: ${forecastDayData.wind} m/s</p>`),
                $(`<p class='card-text'>Humidity: ${forecastDayData.humidity}%</p>`)
            )
        )
    }
})