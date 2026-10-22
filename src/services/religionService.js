// Religion service (sholat schedule)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { formatBulletList } = require('../utils/formatter');

async function getSholat(kota) {
    try {
        // Step 1: Cari ID kota
        const searchResponse = await fetch(
            `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(kota)}`
        );
        
        if (!searchResponse.ok) {
            return `> *ERROR KONEKSI* ❌\n\nGagal mencari kota. Status: ${searchResponse.status}`;
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.data || searchData.data.length === 0) {
            return `> *KOTA TIDAK DITEMUKAN* ❌\n\nKota "${kota}" tidak ditemukan dalam database jadwal sholat.\nPastikan penulisan nama kota benar.`;
        }

        const searchKeyword = kota.toUpperCase();
        const exactMatchCity = searchData.data.find((item) => (
            item.lokasi === searchKeyword ||
            item.lokasi === `KOTA ${searchKeyword}` ||
            item.lokasi === `KAB. ${searchKeyword}`
        ));
        const selectedCity = exactMatchCity || searchData.data[0];
        const cityId = selectedCity.id;
        const cityName = selectedCity.lokasi;
        
        // Step 2: Dapatkan jadwal untuk hari ini
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        
        const scheduleResponse = await fetch(
            `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${year}/${month}/${day}`
        );
        
        if (!scheduleResponse.ok) {
            return `> *ERROR JADWAL* ❌\n\nGagal mengambil jadwal sholat. Status: ${scheduleResponse.status}`;
        }
        
        const scheduleData = await scheduleResponse.json();
        
        if (!scheduleData.data || !scheduleData.data.jadwal) {
            return '> *ERROR DATA* ❌\n\nData jadwal sholat tidak valid. Silakan coba lagi nanti.';
        }
        
        const jadwal = scheduleData.data.jadwal;
        const header = '> *JADWAL SHOLAT HARI INI* 🕌';
        const body = formatBulletList({
            Kota: cityName,
            Tanggal: jadwal.tanggal,
            Imsak: jadwal.imsak,
            Subuh: jadwal.subuh,
            Dzuhur: jadwal.dzuhur,
            Ashar: jadwal.ashar,
            Maghrib: jadwal.maghrib,
            Isya: jadwal.isya
        });
        const footer = '\n\nSemoga ibadahmu lancar dan tepat waktu.';

        return `${header}\n\n${body}${footer}`;
    } catch (error) {
        console.error('Error fetching prayer schedule:', error);
        return '> *ERROR SISTEM* ❌\n\nTerjadi kesalahan saat mengambil jadwal sholat. Silakan coba lagi nanti.';
    }
}

module.exports = {
    getSholat
};
