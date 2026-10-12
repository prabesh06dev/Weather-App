
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const message = document.getElementById("message");
const weatherResult = document.getElementById("weather-result");

const cityName = document.getElementById("city-name");
const temperature = document.getElementById("temperature");
const description = document.getElementById("description");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");

const forecastSection = document.getElementById("forecast-section");
const forecastContainer = document.getElementById("forecast-container");

const locationButton = document.getElementById("location-button");
const refreshButton = document.getElementById("refresh-button");

const recentSection = document.getElementById("recent-section");
const recentCitiesContainer = document.getElementById("recent-cities");

const celsiusButton = document.getElementById("celsius-button");
const fahrenheitButton = document.getElementById("fahrenheit-button");

let temperatureUnit = "C";
let latestWeather = null;
let lastSearch = null;
let isLoading = false;

let recentCities = [];

try {
    recentCities = JSON.parse(
        localStorage.getItem("recentCities") || "[]"
    );

    if (!Array.isArray(recentCities)) {
        recentCities = [];
    }
} catch {
    recentCities = [];
}


// Weather descriptions
function getWeatherDescription(code) {
    const conditions = {
        0: "Clear sky ☀️",
        1: "Mainly clear 🌤️",
        2: "Partly cloudy ⛅",
        3: "Overcast ☁️",
        45: "Foggy 🌫️",
        48: "Depositing rime fog 🌫️",
        51: "Light drizzle 🌦️",
        53: "Moderate drizzle 🌦️",
        55: "Dense drizzle 🌧️",
        61: "Slight rain 🌧️",
        63: "Moderate rain 🌧️",
        65: "Heavy rain 🌧️",
        71: "Slight snowfall 🌨️",
        73: "Moderate snowfall ❄️",
        75: "Heavy snowfall ❄️",
        77: "Snow grains ❄️",
        80: "Rain showers 🌦️",
        81: "Moderate rain showers 🌧️",
        82: "Violent rain showers ⛈️",
        85: "Snow showers ❄️",
        86: "Heavy snow showers ❄️",
        95: "Thunderstorm ⛈️",
        96: "Thunderstorm with hail ⛈️",
        99: "Thunderstorm with heavy hail ⛈️"
    };

    return conditions[code] || "Weather conditions unavailable";
}


// Weather icons
function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if (code <= 2) return "🌤️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 80 && code <= 82) return "🌦️";
    if (code >= 85 && code <= 86) return "❄️";
    if (code >= 95) return "⛈️";

    return "🌡️";
}


// Convert Celsius to the selected unit
function convertTemperature(celsius) {
    if (temperatureUnit === "F") {
        return Math.round((celsius * 9) / 5 + 32);
    }

    return Math.round(celsius);
}


// Get weather data from Open-Meteo
async function fetchWeather(latitude, longitude) {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Could not retrieve weather data.");
    }

    return await response.json();
}


// Search for a city
async function searchCity(city) {
    const cleanCity = city.trim();

    if (!cleanCity) {
        message.textContent = "Please enter a city name.";
        return;
    }

    setLoading(true, "Searching for your city...");

    try {
        const geocodingUrl =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`;

        const geocodingResponse = await fetch(geocodingUrl);

        if (!geocodingResponse.ok) {
            throw new Error("Could not search for the city.");
        }

        const geocodingData = await geocodingResponse.json();
        const location = geocodingData.results?.[0];

        if (!location) {
            message.textContent =
                "City not found. Please try another name.";
            return;
        }

        const data = await fetchWeather(
            location.latitude,
            location.longitude
        );

        latestWeather = {
            current: data.current,
            daily: data.daily,
            city: `${location.name}, ${location.country}`
        };

        lastSearch = {
            type: "city",
            value: cleanCity
        };

        saveRecentCity(location.name);
        renderLatestWeather();

        message.textContent =
            `Feels like ${convertTemperature(data.current.apparent_temperature)}°${temperatureUnit}`;

    } catch (error) {
        console.error(error);
        message.textContent =
            "Couldn't load weather. Check your connection and try again.";
    } finally {
        setLoading(false);
    }
}


// Get weather for the user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Your browser does not support location."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    });
}


async function searchCurrentLocation() {
    setLoading(true, "Getting your location...");

    try {
        const position = await getCurrentLocation();

        const data = await fetchWeather(
            position.coords.latitude,
            position.coords.longitude
        );

        latestWeather = {
            current: data.current,
            daily: data.daily,
            city: "Your Current Location"
        };

        lastSearch = {
            type: "location"
        };

        renderLatestWeather();

        message.textContent =
            `Feels like ${convertTemperature(data.current.apparent_temperature)}°${temperatureUnit}`;

    } catch (error) {
        console.error(error);

        if (error.code === 1) {
            message.textContent =
                "Location permission denied. Allow access in browser settings.";
        } else if (error.code === 2) {
            message.textContent =
                "Your location is unavailable. Please try again.";
        } else if (error.code === 3) {
            message.textContent =
                "Location request timed out. Please try again.";
        } else {
            message.textContent =
                "Couldn't get your location or weather. Please try again.";
        }
    } finally {
        setLoading(false);
    }
}


// Manage loading state
function setLoading(loading, status = "") {
    isLoading = loading;

    locationButton.disabled = loading;
    refreshButton.disabled = loading;

    locationButton.textContent = loading && status.includes("location")
        ? "Getting your location..."
        : "📍 Use My Location";

    refreshButton.textContent = loading
        ? "Refreshing..."
        : "🔄 Refresh Weather";

    if (status) {
        message.textContent = status;
    }
}


// Render current weather and forecast
function renderLatestWeather() {
    if (!latestWeather) return;

    const current = latestWeather.current;

    cityName.textContent = latestWeather.city;

    temperature.textContent =
        `${convertTemperature(current.temperature_2m)}°${temperatureUnit}`;

    description.textContent =
        getWeatherDescription(current.weather_code);

    humidity.textContent =
        `Humidity: ${current.relative_humidity_2m}%`;

    wind.textContent =
        `Wind speed: ${current.wind_speed_10m} km/h`;

    weatherResult.hidden = false;
    forecastSection.hidden = false;
    refreshButton.hidden = false;

    updateTemperatureButtons();
    displayForecast(latestWeather.daily);
}


// Render five-day forecast
function displayForecast(daily) {
    forecastContainer.innerHTML = "";

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(`${daily.time[i]}T12:00:00`);
        const dayName = days[date.getDay()];

        const card = document.createElement("article");
        card.className = "forecast-day";

        const heading = document.createElement("h3");
        heading.textContent = dayName;

        const icon = document.createElement("p");
        icon.className = "forecast-icon";
        icon.textContent = getWeatherIcon(daily.weather_code[i]);

        const temperatures = document.createElement("p");
        temperatures.className = "forecast-temps";
        temperatures.textContent =
            `${convertTemperature(daily.temperature_2m_max[i])}°${temperatureUnit}`;

        const low = document.createElement("span");
        low.className = "forecast-low";
        low.textContent =
            `${convertTemperature(daily.temperature_2m_min[i])}°${temperatureUnit} low`;

        temperatures.appendChild(low);

        const weatherDescription = document.createElement("p");
        weatherDescription.className = "forecast-description";
        weatherDescription.textContent =
            getWeatherDescription(daily.weather_code[i]);

        card.append(
            heading,
            icon,
            temperatures,
            weatherDescription
        );

        forecastContainer.appendChild(card);
    }
}


// Celsius / Fahrenheit buttons
function updateTemperatureButtons() {
    celsiusButton.classList.toggle("active", temperatureUnit === "C");
    fahrenheitButton.classList.toggle("active", temperatureUnit === "F");

    celsiusButton.setAttribute(
        "aria-pressed",
        String(temperatureUnit === "C")
    );

    fahrenheitButton.setAttribute(
        "aria-pressed",
        String(temperatureUnit === "F")
    );
}

celsiusButton.addEventListener("click", () => {
    temperatureUnit = "C";
    renderLatestWeather();
});

fahrenheitButton.addEventListener("click", () => {
    temperatureUnit = "F";
    renderLatestWeather();
});


// Recent searches
function saveRecentCity(city) {
    recentCities = [
        city,
        ...recentCities.filter(
            item => item.toLowerCase() !== city.toLowerCase()
        )
    ].slice(0, 5);

    try {
        localStorage.setItem(
            "recentCities",
            JSON.stringify(recentCities)
        );
    } catch (error) {
        console.warn("Could not save recent searches.", error);
    }

    displayRecentCities();
}


function displayRecentCities() {
    recentCitiesContainer.innerHTML = "";
    recentSection.hidden = recentCities.length === 0;

    recentCities.forEach(city => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "recent-city-button";
        button.textContent = city;

        button.addEventListener("click", () => {
            cityInput.value = city;
            form.requestSubmit();
        });

        recentCitiesContainer.appendChild(button);
    });
}


// City search form
form.addEventListener("submit", event => {
    event.preventDefault();
    searchCity(cityInput.value);
});


// Use current location
locationButton.addEventListener("click", () => {
    if (!isLoading) {
        searchCurrentLocation();
    }
});


// Refresh the last successful search
refreshButton.addEventListener("click", () => {
    if (isLoading || !lastSearch) return;

    if (lastSearch.type === "city") {
        searchCity(lastSearch.value);
    } else {
        searchCurrentLocation();
    }
});


// Initial setup
displayRecentCities();
updateTemperatureButtons();
