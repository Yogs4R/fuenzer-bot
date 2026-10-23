// Religion service (sholat schedule)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { formatBulletList } = require('../utils/formatter');
const { t } = require('../utils/i18n');

async function getSholat(kota, lang = 'en') {
  try {
    const searchResponse = await fetch(
      `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(kota)}`
    );

    if (!searchResponse.ok) {
      return `${t('common.general_error', {}, lang)} (Status: ${searchResponse.status})`;
    }

    const searchData = await searchResponse.json();

    if (!searchData.data || searchData.data.length === 0) {
      const header = t('common.format_error_header', {}, lang);
      return `${header}\n\n${t('religion.city_not_found', { city: kota }, lang)}`;
    }

    const searchKeyword = kota.toUpperCase();
    const exactMatchCity = searchData.data.find(
      (item) =>
        item.lokasi === searchKeyword ||
        item.lokasi === `KOTA ${searchKeyword}` ||
        item.lokasi === `KAB. ${searchKeyword}`
    );
    const selectedCity = exactMatchCity || searchData.data[0];
    const cityId = selectedCity.id;
    const cityName = selectedCity.lokasi;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const scheduleResponse = await fetch(
      `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${year}/${month}/${day}`
    );

    if (!scheduleResponse.ok) {
      return `${t('common.general_error', {}, lang)} (Status: ${scheduleResponse.status})`;
    }

    const scheduleData = await scheduleResponse.json();

    if (!scheduleData.data || !scheduleData.data.jadwal) {
      return t('common.general_error', {}, lang);
    }

    const jadwal = scheduleData.data.jadwal;
    const header = `> *${t('religion.timetable_title', {}, lang)}* 🕌`;
    const body = formatBulletList({
      [lang === 'en' ? 'City' : 'Kota']: cityName,
      [lang === 'en' ? 'Date' : 'Tanggal']: jadwal.tanggal,
      Imsak: jadwal.imsak,
      [t('religion.fajr', {}, lang)]: jadwal.subuh,
      [t('religion.dhuhr', {}, lang)]: jadwal.dzuhur,
      [t('religion.asr', {}, lang)]: jadwal.ashar,
      [t('religion.maghrib', {}, lang)]: jadwal.maghrib,
      [t('religion.isha', {}, lang)]: jadwal.isya
    });

    return `${header}\n\n${body}`;
  } catch (error) {
    console.error('Error fetching prayer schedule:', error);
    return `${t('common.general_error', {}, lang)}: ${error.message}`;
  }
}

module.exports = {
  getSholat
};
