// Weather App Main Script

// API key and base URL for OpenWeatherMap
const API_KEY = '415b5436af0634bd2fea085e6b03c4e4';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/';

// --- DOM Elements ---
// Grabbing references to all major UI elements
// These variables reference HTML elements so we can update them from JS
const locationForm   = document.getElementById('location-form');
const locationInput  = document.getElementById('location-input');
const geoBtn         = document.getElementById('geo-btn');
const weatherDetails = document.getElementById('weather-details');
const hourlyForecast = document.getElementById('hourly-forecast');
const dailyForecast  = document.getElementById('daily-forecast');
const favoritesList  = document.getElementById('favorites-list');
const compareCities  = document.getElementById('compare-cities');
const unitToggle     = document.getElementById('unit-toggle');
const themeToggle    = document.getElementById('theme-toggle');
const suggestions    = document.getElementById('suggestions');

// --- State ---
// Tracks current unit, last searched location, and placeholders for favorites/compare features
// Use 'let' for variables that change, 'const' for ones that don't
let currentUnit = 'metric'; // 'metric' (°C, m/s) or 'imperial' (°F, mph)
let lastLocation = null;    // { lat, lon, cityName }
let favorites = [];         // not implemented fully (placeholders)
let compare = [];           // not implemented fully (placeholders)

// --- Events ---
// Handles search form submission
// Listen for the search form submit event
locationForm.addEventListener('submit', function (e) {
  e.preventDefault(); // Prevents page reload
  const city = locationInput.value.trim(); // Get user input
  if (city) fetchWeather(city); // Call function to fetch weather
});

// Handles geolocation button click
// Listen for the geolocation button click event
geoBtn.addEventListener('click', function () {
  // Checks if browser supports geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      // If successful, get latitude and longitude
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      fetchWeatherByCoords(lat, lon, 'Current location');
    }, function () {
      weatherDetails.innerHTML = '<p class="text-danger">Could not get your location.</p>';
    });
  }
});

// Handles unit toggle (°C/°F)
unitToggle.addEventListener('click', function () {
  // Toggle between metric and imperial
  currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';

  // Refresh weather data with new unit
  if (lastLocation) {
    fetchWeatherByCoords(lastLocation.lat, lastLocation.lon, lastLocation.cityName);
  } else {
    const city = locationInput.value.trim();
    if (city) fetchWeather(city);
  }
});

// Handles theme toggle (dark/light mode)
themeToggle.addEventListener('click', function () {
  // Toggle dark mode class
  document.body.classList.toggle('dark-mode');
  // Change button text
  themeToggle.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
});

// --- Fetch by city name (uses weather endpoint to resolve coords quickly) ---
// Main entry point for searching weather by city name
async function fetchWeather(city) {
  try {
    const url = `${BASE_URL}weather?q=${encodeURIComponent(city)}&appid=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      weatherDetails.innerHTML = '<p class="text-danger">City not found.</p>';
      return;
    }
    const data = await res.json();
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    const name = data.name || city;
    lastLocation = { lat: lat, lon: lon, cityName: name };
    fetchWeatherByCoords(lat, lon, name); // Fetch details using coordinates
  } catch (err) {
    weatherDetails.innerHTML = '<p class="text-danger">Something went wrong fetching that city.</p>';
  }
}

// --- Fetch current + forecast by coordinates ---
// Fetches both current and forecast weather data for given coordinates
async function fetchWeatherByCoords(lat, lon, cityName) {
  try {
    const currentUrl  = `${BASE_URL}weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`;
    const forecastUrl = `${BASE_URL}forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`;
    const [currentRes, forecastRes] = await Promise.all([ fetch(currentUrl), fetch(forecastUrl) ]);

    if (!currentRes.ok || !forecastRes.ok) {
      weatherDetails.innerHTML = '<p class="text-danger">Weather data not available.</p>';
      return;
    }

    const currentData  = await currentRes.json();
    const forecastData = await forecastRes.json();
    const name = cityName || currentData.name || 'Location';
    lastLocation = { lat: lat, lon: lon, cityName: name };

    // Render results
    renderCurrentWeather(currentData, name);
    renderHourlyForecast(forecastData);
    renderDailyForecast(forecastData);
  } catch (err) {
    weatherDetails.innerHTML = '<p class="text-danger">Network error fetching weather.</p>';
  }
}

// --- Render: Current Weather ---
// Renders the current weather card in the UI
function renderCurrentWeather(currentData, cityName) {
  const conditionDesc = currentData.weather?.[0]?.description || 'N/A';
  const mainCond      = currentData.weather?.[0]?.main || '';
  const temp          = Math.round(currentData.main?.temp ?? 0);
  const feelsLike     = Math.round(currentData.main?.feels_like ?? 0);
  const humidity      = currentData.main?.humidity ?? 0;
  const wind          = Math.round(currentData.wind?.speed ?? 0);
  const icon          = getWeatherIcon(mainCond);

  // Build the HTML for the weather card
  weatherDetails.innerHTML = `
    <div class="card p-3 d-flex gap-2 align-items-start">
      <div class="d-flex align-items-center gap-3">
        <i class="${icon}" style="font-size:2rem;"></i>
        <div>
          <h3 class="m-0">${cityName}</h3>
          <div class="text-muted text-capitalize">${conditionDesc}</div>
        </div>
      </div>
      <div class="mt-2">
        <div><strong>Temp:</strong> ${temp}${currentUnit === 'metric' ? '°C' : '°F'}</div>
        <div><strong>Feels like:</strong> ${feelsLike}${currentUnit === 'metric' ? '°C' : '°F'}</div>
        <div><strong>Humidity:</strong> ${humidity}%</div>
        <div><strong>Wind:</strong> ${wind} ${currentUnit === 'metric' ? 'm/s' : 'mph'}</div>
      </div>
    </div>
  `;

  // Apply dynamic background + suggestions
  setDynamicBackground(mainCond);
  showSuggestions(mainCond, temp);
}

// --- Render: Hourly Forecast (next ~24h, 3h steps) ---
// Renders the next 8 forecast periods (3-hour steps)
function renderHourlyForecast(data) {
  hourlyForecast.innerHTML = '';
  if (!data?.list?.length) return;

  const count = Math.min(8, data.list.length);
  for (let i = 0; i < count; i++) {
    const item = data.list[i];
    const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const temp = Math.round(item.main.temp);
    const icon = getWeatherIcon(item.weather?.[0]?.main || '');

    hourlyForecast.innerHTML += `
      <div class="forecast-card">
        <div>${time}</div>
        <div><i class="${icon}" style="font-size:1.5rem;"></i></div>
        <div>${temp}${currentUnit === 'metric' ? '°C' : '°F'}</div>
      </div>
    `;
  }
}

// --- Render: Daily Forecast (group by date, show up to 5 days) ---
// Groups forecast by date, averages temperatures, and picks icon near noon
function renderDailyForecast(data) {
  dailyForecast.innerHTML = '';
  if (!data?.list?.length) return;

  const byDate = {};
  for (let item of data.list) {
    const dateKey = new Date(item.dt * 1000).toLocaleDateString();
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(item);
  }

  const dates = Object.keys(byDate).slice(0, 5); // limit to 5 days
  for (let dateKey of dates) {
    const dayData = byDate[dateKey];

    // Pick the forecast closest to 12:00 for the icon
    const firstDate = new Date(dayData[0].dt * 1000);
    const noon = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 12, 0, 0).getTime();
    let closest = dayData[0];
    for (let item of dayData) {
      if (Math.abs(item.dt * 1000 - noon) < Math.abs(closest.dt * 1000 - noon)) {
        closest = item;
      }
    }

    // Calculate average temperature
    const avgTemp = Math.round(dayData.reduce((sum, x) => sum + x.main.temp, 0) / dayData.length);
    const icon = getWeatherIcon(closest.weather?.[0]?.main || '');

    dailyForecast.innerHTML += `
      <div class="forecast-card">
        <div>${dateKey}</div>
        <div><i class="${icon}" style="font-size:1.5rem;"></i></div>
        <div>${avgTemp}${currentUnit === 'metric' ? '°C' : '°F'}</div>
      </div>
    `;
  }
}

// --- Background based on condition ---
// Dynamically changes the background based on weather condition
function setDynamicBackground(condition) {
  document.body.classList.remove('weather-sunny','weather-rainy','weather-snowy','weather-cloudy');
  if (/rain/i.test(condition)) document.body.classList.add('weather-rainy');
  else if (/snow/i.test(condition)) document.body.classList.add('weather-snowy');
  else if (/cloud/i.test(condition)) document.body.classList.add('weather-cloudy');
  else document.body.classList.add('weather-sunny');
}

// --- “Smart” suggestions ---
// Shows helpful suggestions and clothing recommendations based on weather
function showSuggestions(condition, temp) {
  let suggestion = '';
  let clothing = '';

  if (/rain/i.test(condition)) {
    suggestion = "It's rainy today, maybe stay in or bring an umbrella!";
    clothing = "Recommendation: Raincoat, umbrella, waterproof shoes.";
  } else if (/snow/i.test(condition)) {
    suggestion = "It's snowy, perfect for hot chocolate!";
    clothing = "Recommendation: Warm coat, boots, gloves.";
  } else if (/cloud/i.test(condition)) {
    suggestion = "Cloudy skies, good for a walk.";
    clothing = "Recommendation: Light jacket.";
  } else if (temp > 25) {
    suggestion = "It's sunny and warm, great for outdoor activities!";
    clothing = "Recommendation: T-shirt, sunglasses, sunscreen.";
  } else if (temp < 10) {
    suggestion = "It's chilly, dress warmly!";
    clothing = "Recommendation: Coat, scarf, hat.";
  } else {
    suggestion = "Weather is moderate, enjoy your day!";
    clothing = "Recommendation: Comfortable clothes.";
  }

  suggestions.innerHTML = `<div>${suggestion}<br><span class="fw-light">${clothing}</span></div>`;
}

// --- Icons (Font Awesome classes) ---
// Returns appropriate Font Awesome icon class for a given weather condition
function getWeatherIcon(condition) {
  if (/rain/i.test(condition))  return 'fas fa-cloud-showers-heavy text-primary';
  if (/snow/i.test(condition))  return 'fas fa-snowflake text-info';
  if (/cloud/i.test(condition)) return 'fas fa-cloud text-secondary';
  if (/clear/i.test(condition)) return 'fas fa-sun text-warning';
  return 'fas fa-smog text-muted'; // fallback icon
}

/* --- Placeholders (optional features you can fill later) --- */
// future features (favorites, compare)
function addFavorite(city) { /* TODO: Add city to favorites */ }
function renderFavorites()   { /* TODO: Render favorite cities */ }
function compareCityWeather(city) { /* TODO: Compare weather for multiple cities */ }
function renderCompare() { /* TODO: Render comparison UI */ }
