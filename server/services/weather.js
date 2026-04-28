const fetch = require('node-fetch');
const config = require('../config');

class WeatherService {
  constructor() {
    this.apiKey = config.WEATHER_API_KEY;
    this.city = config.WEATHER_CITY;
  }

  async getCurrentWeather(city) {
    const targetCity = city || this.city;
    if (!this.apiKey) {
      return { description: '未知', temp: '--', city: targetCity };
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(targetCity)}&appid=${this.apiKey}&units=metric&lang=zh_cn`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.cod !== 200) {
        return { description: '获取失败', temp: '--', city: targetCity };
      }

      return {
        description: data.weather[0].description,
        temp: Math.round(data.main.temp),
        city: data.name,
        humidity: data.main.humidity,
        icon: data.weather[0].icon,
      };
    } catch (err) {
      console.error('Weather API error:', err.message);
      return { description: '获取失败', temp: '--', city: targetCity };
    }
  }

  getWeatherMood(weather) {
    const desc = weather.description || '';
    if (desc.includes('雨')) return 'melancholy';
    if (desc.includes('晴')) return 'cheerful';
    if (desc.includes('雪')) return 'cozy';
    if (desc.includes('云') || desc.includes('阴')) return 'contemplative';
    if (desc.includes('雾') || desc.includes('霾')) return 'dreamy';
    return 'neutral';
  }
}

module.exports = new WeatherService();
