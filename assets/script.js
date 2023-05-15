const apiKey = 'f4cf9af4f3815f411ad27d36e8c20078';
const storageKey = 'weather-dashboard-saved-locations';
let savedLocations;
let currIndex;

$(function() {
    const savedLocationsListEl = $('#saved-locations-list');
    const currentWeatherSection = $('#current-weather');
    const forecastSection = $('#5-day-forecast');

    // load saved locations from localStorage
    savedLocations = localStorage.getItem(storageKey);
    savedLocations = savedLocations != null ? JSON.parse(savedLocations) : [];
    displayLocationList();

    function displayLocationList() {
        savedLocationsListEl.empty();
        savedLocations.forEach(displayLocationInList);
    }

    function displayLocationInList(location, index) {
        const listEl = $(`<li data-index=${index} class='list-group-item d-flex align-items-center'></li>`).append(
            $(`<button class='btn btn-primary flex-grow-1 me-1'>${location.name}</button>`),
            $(`<button class='btn-close' aria-label='Remove ${location.name} from shortcuts'></button>`)
        );
        listEl.children().eq(0).on('click', setCurrentCityButtonHandler);
        listEl.children().eq(1).on('click', removeSavedLocationButtonHandler);
        savedLocationsListEl.append(listEl);
    }

    function setCurrentCityButtonHandler() {
        const index = $(this).parent().attr('data-index');
        setCurrentCity(index);
    }

    function removeSavedLocationButtonHandler() {
        const index = $(this).parent().attr('data-index');
        savedLocations.splice(index, 1);
        displayLocationList();
        localStorage.setItem(storageKey, JSON.stringify(savedLocations));
    }

    $('#city-form').on('submit', function(event) {
        event.preventDefault();

        const searchTerm = $('#city-input').val();
        const existingIndex = savedLocations.findIndex(location => location.name == searchTerm);
        if (existingIndex != -1) {
            // switch to the existing city
            console.log('city already found');
            return;
        }

        fetchGeocodingData(searchTerm);
    })

    async function fetchGeocodingData(searchTerm) {
        const fetchResult = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${searchTerm}&appId=${apiKey}`);
        if (!fetchResult.ok) {
            return;
        }
        const fetchData = await fetchResult.json();
        if (Array.isArray(fetchData) && fetchData.length > 0) {
            fetchData.forEach(location => {
                let nameStr = location.name;
                if (location.state) {
                    nameStr += ', ' + location.state;
                }
                nameStr += ', ' + location.country;
                const locationToSave = {
                    name: nameStr,
                    lat: location.lat,
                    lon: location.lon
                }
                savedLocations.push(locationToSave);
                displayLocationInList(locationToSave, savedLocations.length - 1);
            });
            localStorage.setItem(storageKey, JSON.stringify(savedLocations));
        }
    }

    async function setCurrentCity(index) {
        if (isTenMinutesOld(index)) {
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
        }
        displayCurrentWeather(savedLocations[index].currentWeatherData);
        displayForecastWeather(savedLocations[index].forecastWeatherData);
    }

    function isTenMinutesOld(index) {
        const oldDate = savedLocations[index].date;
        if (!oldDate) {
            return true;
        }
        
        return ((Date.now() - oldDate) / 60000) >= 10;
    }

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

    function processForecastWeatherData(data) {
        const results = [];
        const formatter = new Intl.DateTimeFormat();
        let currentDayStr;
        let currentDayData;
        let firstSnapshotOfDay;

        data.list.forEach(snapshot => {
            const snapshotDayStr = formatter.format(snapshot.dt * 1000);
            if (snapshotDayStr != currentDayStr) {
                if (currentDayData) {
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

    function displayForecastWeather(weatherData) {
        forecastSection.empty();
        forecastSection.append(weatherData.map(
            forecastElem => $(`<div class='col'></div`).append(
                $(`<div class='card'></div>`).append(
                    $(`<div class='card-header bg-primary text-white'></div>`).append(
                        $(`<h2>${forecastElem.day}</h2>`),
                        $('<div></div>').append(
                            forecastElem.icons.map(icon => $(`<img src='https://openweathermap.org/img/wn/${icon}.png' />`))
                        )
                    ),
                    $(`<div class='card-body'></div>`).append(
                        $(`<p class='card-text'>High: ${forecastElem.high}&deg;C</p>`),
                        $(`<p class='card-text'>Low: ${forecastElem.low}&deg;C</p>`),
                        $(`<p class='card-text'>Wind: ${forecastElem.wind} m/s</p>`),
                        $(`<p class='card-text'>Humidity: ${forecastElem.humidity}%</p>`)
                    )
                )
            )
        ));
    }
})