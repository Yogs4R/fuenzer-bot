// Weather service
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { formatBulletList } = require('../utils/formatter');
const { t } = require('../utils/i18n');

async function getCuaca(kota, lang = 'en') {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      const header = t('common.format_error_header', {}, lang);
      return `${header}\n\nOpenWeather API key is not configured.`;
    }

    const openWeatherLang = lang === 'id' ? 'id' : 'en';
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)}&appid=${apiKey}&units=metric&lang=${openWeatherLang}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        const header = t('common.format_error_header', {}, lang);
        return `${header}\n\n${t('weather.not_found', { city: kota }, lang)}`;
      }
      return `${t('common.general_error', {}, lang)} (Status: ${response.status})`;
    }

    const data = await response.json();
    const header = `> *${t('weather.report_title', {}, lang)}* 🌤️`;
    const body = formatBulletList({
      [t('weather.city', {}, lang)]: `${data.name}, ${data.sys.country}`,
      [t('weather.condition', {}, lang)]: data.weather[0]?.description || '-',
      [t('weather.temperature', {}, lang)]: `${data.main.temp}°C`,
      [t('weather.humidity', {}, lang)]: `${data.main.humidity}%`,
      [t('weather.wind', {}, lang)]: `${data.wind.speed} m/s`
    });

    return `${header}\n\n${body}`;
  } catch (error) {
    console.error('Error fetching weather:', error);
    return `${t('common.general_error', {}, lang)}: ${error.message}`;
  }
}

module.exports = {
  getCuaca
};
