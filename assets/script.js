$(function() {
    // load saved locations from localStorage
    let savedLocations = localStorage.get('weather-dashboard-saved-locations');
    savedLocations = savedLocations != null ? JSON.parse(savedLocations) : [];

})