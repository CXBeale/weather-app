// Test: Show map on page load with default coordinates (London), and show london weather

// ===== Weather App (Simple JS) =====
const API_KEY = '415b5436af0634bd2fea085e6b03c4e4';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/';

// --- DOM Elements ---
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
let currentUnit = 'metric'; // 'metric' (°C, m/s) or 'imperial' (°F, mph)
let lastLocation = null;    // { lat, lon, cityName }
let favorites = [];         // not implemented fully (placeholders)
let compare = [];           // not implemented fully (placeholders)
let weatherMap; // for Leaflet map instance

// --- Events ---
// Toggle favorites list visibility
const recentSearchesToggle = document.getElementById('recent-searches-toggle');
if (recentSearchesToggle && favoritesList) {
  recentSearchesToggle.addEventListener('click', function () {
    if (favoritesList.style.display === 'none') {
      favoritesList.style.display = '';
    } else {
      favoritesList.style.display = 'none';
    }
  });
}
locationForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const city = locationInput.value.trim();
  if (city) fetchWeather(city);
});

geoBtn.addEventListener('click', function () {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      fetchWeatherByCoords(lat, lon, 'Current location');
    }, function () {
      weatherDetails.innerHTML = '<p class="text-danger">Could not get your location.</p>';
    });
  }
});

unitToggle.addEventListener('click', function () {
  currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
  if (lastLocation) {
    fetchWeatherByCoords(lastLocation.lat, lastLocation.lon, lastLocation.cityName);
  } else {
    const city = locationInput.value.trim();
    if (city) fetchWeather(city);
  }
});

themeToggle.addEventListener('click', function () {
  document.body.classList.toggle('dark-mode');
  themeToggle.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
  // Reapply weather background after toggling dark mode
  if (lastLocation && lastLocation.weatherMain) {
    setDynamicBackground(lastLocation.weatherMain);
  }
});

// --- Fetch by city name (uses weather endpoint to resolve coords quickly) ---
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
    fetchWeatherByCoords(lat, lon, name);
  } catch (err) {
    weatherDetails.innerHTML = '<p class="text-danger">Something went wrong fetching that city.</p>';
  }
}

// --- Fetch current + forecast by coordinates ---
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

    const name = currentData.name || cityName || 'Location';
    lastLocation = { lat: lat, lon: lon, cityName: name };

    renderCurrentWeather(currentData, name);
    renderHourlyForecast(forecastData);
    renderDailyForecast(forecastData);
  } catch (err) {
    weatherDetails.innerHTML = '<p class="text-danger">Network error fetching weather.</p>';
  }
}

// --- Render: Current Weather ---
function renderCurrentWeather(currentData, cityName) {
  const conditionDesc = (currentData.weather && currentData.weather[0] && currentData.weather[0].description) ? currentData.weather[0].description : 'N/A';
  const mainCond      = (currentData.weather && currentData.weather[0] && currentData.weather[0].main) ? currentData.weather[0].main : '';
  lastLocation.weatherMain = mainCond;
  const temp          = Math.round(currentData.main && typeof currentData.main.temp !== 'undefined' ? currentData.main.temp : 0);
  const feelsLike     = Math.round(currentData.main && typeof currentData.main.feels_like !== 'undefined' ? currentData.main.feels_like : 0);
  const humidity      = currentData.main && typeof currentData.main.humidity !== 'undefined' ? currentData.main.humidity : 0;
  const wind          = Math.round(currentData.wind && typeof currentData.wind.speed !== 'undefined' ? currentData.wind.speed : 0);
  const icon          = getWeatherIcon(mainCond);
    // Add to favorites (last 5 searched places)
    const favoriteDetails = {
      city: cityName,
      temp: temp,
      condition: conditionDesc,
      icon: icon
    };
    // Remove if already exists (avoid duplicates)
    favorites = favorites.filter(fav => fav.city !== cityName);
    favorites.unshift(favoriteDetails);
    if (favorites.length > 5) favorites.pop();
    renderFavorites();
    // Get sunrise and sunset times
    const sunrise = currentData.sys && currentData.sys.sunrise ? new Date(currentData.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
    const sunset  = currentData.sys && currentData.sys.sunset  ? new Date(currentData.sys.sunset  * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';

  weatherDetails.innerHTML = `
    <div class="card p-3 d-flex gap-2 align-items-start">
      <div class="d-flex align-items-center gap-3">
        <i class="${icon}" style="font-size:2rem;"></i>
        <div>
          <h3 class="m-0">${cityName}</h3>
          <div class="text-muted text-capitalize">${conditionDesc}</div>
        </div>
          <div class="ms-auto d-flex flex-column align-items-end">
            <div><i class="fas fa-sun text-warning"></i> <span title="Sunrise">${sunrise}</span></div>
            <div><i class="fas fa-moon text-info"></i> <span title="Sunset">${sunset}</span></div>
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

    setDynamicBackgroundWithUnsplash(cityName, mainCond);
  showSuggestions(mainCond, temp);
}

// --- Render: Hourly Forecast (next ~24h, 3h steps) ---
function renderHourlyForecast(data) {
  hourlyForecast.innerHTML = '';
  if (!data || !data.list || !data.list.length) return;

  const count = Math.min(8, data.list.length);
  for (let i = 0; i < count; i++) {
    const item = data.list[i];
    const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const temp = Math.round(item.main.temp);
    const icon = getWeatherIcon((item.weather && item.weather[0] && item.weather[0].main) ? item.weather[0].main : '');

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
function renderDailyForecast(data) {
  dailyForecast.innerHTML = '';
  if (!data || !data.list || !data.list.length) return;

  const byDate = {};
  for (let i = 0; i < data.list.length; i++) {
    const item = data.list[i];
    const dateKey = new Date(item.dt * 1000).toLocaleDateString();
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(item);
  }

  const dates = Object.keys(byDate).slice(0, 5);
  for (let i = 0; i < dates.length; i++) {
    const dateKey = dates[i];
    const dayData = byDate[dateKey];

    // pick entry closest to 12:00 for icon
    const firstDate = new Date(dayData[0].dt * 1000);
    const noon = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 12, 0, 0).getTime();
    let closest = dayData[0];
    for (let j = 1; j < dayData.length; j++) {
      const a = Math.abs(dayData[j].dt * 1000 - noon);
      const b = Math.abs(closest.dt * 1000 - noon);
      if (a < b) closest = dayData[j];
    }

    // average temp
    let sum = 0;
    for (let j = 0; j < dayData.length; j++) sum += dayData[j].main.temp;
    const avgTemp = Math.round(sum / dayData.length);

    const icon = getWeatherIcon((closest.weather && closest.weather[0] && closest.weather[0].main) ? closest.weather[0].main : '');

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
// --- Unsplash background based on city and condition ---
const UNSPLASH_ACCESS_KEY = 'kUeQ6srQ_1kNgwuWJunoc7mXr_7ceX1vw8nE2yzI4e8';
async function setDynamicBackgroundWithUnsplash(city, condition) {
  const query = `${city} ${condition}`;
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.urls && data.urls.regular) {
      const bgContainer = document.getElementById('unsplash-bg-container');
      if (bgContainer) {
        bgContainer.style.backgroundImage = `url('${data.urls.regular}')`;
        bgContainer.style.backgroundSize = 'cover';
        bgContainer.style.backgroundPosition = 'center';
        bgContainer.style.backgroundRepeat = 'no-repeat';
        bgContainer.style.minHeight = '1px'; // Prevent collapse
      }
      document.body.classList.remove('weather-sunny','weather-rainy','weather-snowy','weather-cloudy');
    } else {
      setDynamicBackground(condition);
    }
  } catch (err) {
    setDynamicBackground(condition);
  }
}
function setDynamicBackground(condition) {
  document.body.classList.remove('weather-sunny','weather-rainy','weather-snowy','weather-cloudy');
  if (/rain/i.test(condition)) {
    document.body.classList.add('weather-rainy');
  } else if (/snow/i.test(condition)) {
    document.body.classList.add('weather-snowy');
  } else if (/cloud/i.test(condition)) {
    document.body.classList.add('weather-cloudy');
  } else {
    document.body.classList.add('weather-sunny');
  }
}

// --- “Smart” suggestions ---
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
function getWeatherIcon(condition) {
  if (/rain/i.test(condition))  return 'fas fa-cloud-showers-heavy text-primary';
  if (/snow/i.test(condition))  return 'fas fa-snowflake text-info';
  if (/cloud/i.test(condition)) return 'fas fa-cloud text-secondary';
  if (/clear/i.test(condition)) return 'fas fa-sun text-warning';
  return 'fas fa-smog text-muted';
}

/* --- Placeholders (optional features you can fill later) --- */
function addFavorite(city) { /* TODO */ }
function renderFavorites() {
  favoritesList.innerHTML = '';
  favorites.forEach(fav => {
    favoritesList.innerHTML += `
      <li class="list-group-item d-flex align-items-center gap-2">
        <i class="${fav.icon}" style="font-size:1.2rem;"></i>
        <span><strong>${fav.city}</strong> - ${fav.temp}°${currentUnit === 'metric' ? 'C' : 'F'}, ${fav.condition}</span>
      </li>
    `;
  });
}
function compareCityWeather(city) { /* TODO */ }
function renderCompare() { /* TODO */ }

// Show London weather by default after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  fetchWeather('London');
});

const weatherFacts = [
  "The highest temperature ever recorded on Earth was 56.7°C (134°F) in Death Valley, USA.",
  "Raindrops can fall at speeds of about 22 miles per hour.",
  "Snowflakes can take up to an hour to reach the ground.",
  "A bolt of lightning is five times hotter than the surface of the sun.",
  "The coldest temperature ever recorded was -89.2°C (-128.6°F) in Antarctica.",
  "The wettest place on Earth is Mawsynram, India.",
  "Hurricanes can release the energy of 10,000 nuclear bombs.",
  "The fastest wind speed ever recorded was 253 mph during Cyclone Olivia in 1996."
];

// Show a random weather fact on page load and when button is clicked
function showRandomFact() {
  const fact = weatherFacts[Math.floor(Math.random() * weatherFacts.length)];
  document.getElementById('weather-fact').textContent = fact;
}

document.addEventListener('DOMContentLoaded', function() {
  showRandomFact();
  document.getElementById('new-fact-btn').addEventListener('click', showRandomFact);
});


/* ===== Minimal helpers ===== */
function showMapLoading(show) {
  const el = document.getElementById('map-loading');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
}
function toFixed(n, d=2) {
  return (typeof n === 'number' && isFinite(n)) ? n.toFixed(d) : 'N/A';
}

/* ===== Map module ===== */
let clickMarker = null;

function initWeatherMap(initialLat = 51.5074, initialLon = -0.1278, initialZoom = 6) {
  if (weatherMap) return weatherMap; // already initialized

  // Base map
  weatherMap = L.map('map', { zoomControl: true }).setView([initialLat, initialLon], initialZoom);
  const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(weatherMap);

  // Weather overlays (OpenWeatherMap tiles)
  const clouds = L.tileLayer(
    `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.5, attribution: 'Clouds © OpenWeatherMap' }
  );
  const precip = L.tileLayer(
    `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.5, attribution: 'Precipitation © OpenWeatherMap' }
  );
  const temp = L.tileLayer(
    `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.5, attribution: 'Temperature © OpenWeatherMap' }
  );

  // Show one overlay by default
  clouds.addTo(weatherMap);

  // Layer toggle
  L.control.layers(
    { 'OpenStreetMap': base },
    { 'Clouds': clouds, 'Precipitation': precip, 'Temperature': temp }
  ).addTo(weatherMap);

  // Map click → fetch weather + update marker/popup + recenter
  weatherMap.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    await selectLocationAndShowWeather(lat, lng, true);
  });

  return weatherMap;
}

/* Click handler in one place so you can reuse it programmatically too */
async function selectLocationAndShowWeather(lat, lon, recenter = false) {
  try {
    showMapLoading(true);

    // Fetch current weather
    const url = `${BASE_URL}weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();

    // Create readable popup content
    const name = data?.name || 'Selected Location';
    const temp = data?.main?.temp;
    const wind = data?.wind?.speed;
    const hum  = data?.main?.humidity;
    const desc = (data?.weather?.[0]?.description || 'No description').replace(/\b\w/g, c => c.toUpperCase());

    const popupHtml = `
      <b>${name}</b><br>
      ${desc}<br>
      🌡️ ${toFixed(temp, 0)} °C &nbsp;|&nbsp; 💨 ${toFixed(wind, 1)} m/s &nbsp;|&nbsp; 💧 ${hum ?? 'N/A'}%
      <div style="margin-top:6px; font-size:12px; opacity:.8;">
        Lat: ${toFixed(lat, 2)}, Lon: ${toFixed(lon, 2)}
      </div>
    `;

    // Keep only one marker
    if (clickMarker) weatherMap.removeLayer(clickMarker);
    clickMarker = L.marker([lat, lon]).addTo(weatherMap).bindPopup(popupHtml).openPopup();

    // Recenter optionally
    if (recenter) weatherMap.setView([lat, lon], Math.max(weatherMap.getZoom(), 10));

    // Optional: update your side panels/cards if present
    if (typeof fetchWeatherByCoords === 'function') {
      // Uses your app’s existing function to refresh current + forecast panels
      await fetchWeatherByCoords(lat, lon, name);
    } else if (typeof updatePanelsHook === 'function') {
      // Or a custom hook you define elsewhere
      updatePanelsHook(data, lat, lon);
    }
  } catch (err) {
    console.error(err);
    alert('Could not load weather for that point. Check network/API key.');
  } finally {
    showMapLoading(false);
  }
}

/* ===== Init on load ===== */
document.addEventListener('DOMContentLoaded', () => {
  fetchWeather('London');
  initWeatherMap(51.5074, -0.1278); // London coordinates
});