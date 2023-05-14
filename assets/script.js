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
    savedLocations.forEach(displayLocationInList);

    function displayLocationInList(location, index) {
        const listEl = $(`<li data-index=${index}><button >${location.name}</button></li>`);
        listEl.children().on('click', setCurrentCity);
        savedLocationsListEl.append(listEl);
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

    async function setCurrentCity() {
        const index = $(this).parent().attr('data-index');
        if (isTenMinutesOld(index)) {
            await fetchCurrentWeatherData(index);
        }
        displayCurrentWeather(savedLocations[index].weatherData);
    }

    function isTenMinutesOld(index) {
        const oldDate = savedLocations[index].date;
        if (!oldDate) {
            return true;
        }
        
        return ((Date.now() - oldDate) / 60000) >= 10;
    }

    function displayCurrentWeather(weatherData) {
        const header = $(`<h2>${weatherData.name} (${new Date().toLocaleDateString()})</h2>`).append(
            $(`<img src='https://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png' />`)
        );
        const temp = $(`<p>Temperature: ${weatherData.main.temp}&deg;C</p>`);
        const wind = $(`<p>Wind: ${weatherData.wind.speed} m/s</p>`);
        const humidity = $(`<p>Humidity: ${weatherData.main.humidity}</p>`);

        currentWeatherSection.empty();
        currentWeatherSection.append(header, temp, wind, humidity);
    }

    async function fetchCurrentWeatherData(index) {
        const lat = savedLocations[index].lat;
        const lon = savedLocations[index].lon;

        const fetchResult = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appId=${apiKey}&units=metric`);
        if (!fetchResult.ok) {
            return;
        }

        const fetchData = await fetchResult.json();
        savedLocations[index].weatherData = fetchData;
        savedLocations[index].date = Date.now();
    }
})