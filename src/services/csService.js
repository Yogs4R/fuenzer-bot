const axios = require('axios');

async function sendToSheet(type, userId, message) {
    try {
        const gasUrl = process.env.GAS_WEBAPP_URL;
        if (!gasUrl) {
            console.error('GAS_WEBAPP_URL is not defined in environment variables.');
            return false;
        }

        const payload = JSON.stringify({
            type: type,
            userId: userId,
            message: message
        });

        const res = await axios.post(gasUrl, payload, {
            headers: {
                'Content-Type': 'text/plain'
            }
        });

        return true;
    } catch (error) {
        if (error.response) {
            console.error('❌ Response GAS:', error.response.data); 
        } else {
            console.error('❌ Error internal Node.js:', error.message); 
        }
        return false;
    }
}

async function updateStatusAnswered(userId) {
    try {
        const gasUrl = process.env.GAS_WEBAPP_URL;
        if (!gasUrl) return false;

        // Send request for updating status to "ANSWERED"
        const payload = JSON.stringify({
            action: "UPDATE_STATUS",
            userId: userId
        });

        await axios.post(gasUrl, payload, {
            headers: { 'Content-Type': 'text/plain' }
        });

        return true;
    } catch (error) {
        console.error('❌ Failed to update status to GAS:', error.message);
        return false;
    }
}

module.exports = {
    sendToSheet,
    updateStatusAnswered
};