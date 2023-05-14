const storageKey = 'weather-dashboard-saved-locations';
let savedLocations;

$(function() {
    const savedLocationsListEl = $('#saved-locations-list');

    // load saved locations from localStorage
    savedLocations = localStorage.getItem(storageKey);
    savedLocations = savedLocations != null ? JSON.parse(savedLocations) : [];
    savedLocations.forEach(displayLocationInList);

    function displayLocationInList(location, index) {
        savedLocationsListEl.append(`<li><button data-index=${index}>${location.name}</button></li>`);
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

        fetchCityData(searchTerm);
    })

    async function fetchCityData(searchTerm) {
        const fetchResult = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${searchTerm}&appId=`);
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
})