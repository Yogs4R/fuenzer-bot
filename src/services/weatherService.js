// Weather service
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { formatBulletList } = require('../utils/formatter');

async function getCuaca(kota) {
    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return '> *ERROR API* ❌\n\nAPI key OpenWeather tidak ditemukan. Silakan hubungi administrator.';
        }
        
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)}&appid=${apiKey}&units=metric&lang=id`
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                return `> *KOTA TIDAK DITEMUKAN* ❌\n\nKota "${kota}" tidak ditemukan dalam database cuaca.\nPastikan penulisan nama kota benar.`;
            }
            return `> *ERROR CUACA* ❌\n\nGagal mengambil data cuaca. Status: ${response.status}`;
        }
        
        const data = await response.json();
        
        const header = '> *INFO CUACA HARI INI* 🌤️';
        const body = formatBulletList({
            Kota: `${data.name}, ${data.sys.country}`,
            Kondisi: data.weather[0].description,
            Suhu: `${data.main.temp}°C`,
            Terasa: `${data.main.feels_like}°C`,
            Kelembaban: `${data.main.humidity}%`,
            Tekanan: `${data.main.pressure} hPa`,
            Angin: `${data.wind.speed} m/s`
        });
        const footer = '\n\nTetap jaga kesehatan dan sesuaikan aktivitasmu dengan cuaca.';

        return `${header}\n\n${body}${footer}`;
    } catch (error) {
        console.error('Error fetching weather:', error);
        return '> *ERROR SISTEM* ❌\n\nTerjadi kesalahan saat mengambil data cuaca. Silakan coba lagi nanti.';
    }
}
module.exports = {
    getCuaca
};
