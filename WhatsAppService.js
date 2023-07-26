import axios from 'axios'

const YOUR_WHATSAPP_API_ENDPOINT = 'YOUR_WHATSAPP_API_ENDPOINT'
const YOUR_WHATSAPP_PHONE_NUMBER = 'YOUR_WHATSAPP_PHONE_NUMBER'

export const sendWhatsAppVerificationCode = async (phoneNumber, verificationId) => {
    try {
        const message = `Your verification code is: ${verificationId}`
        const data = {
            phone: phoneNumber,
            message,
        }

        // Make a POST request to your WhatsApp Business API endpoint
        await axios.post(YOUR_WHATSAPP_API_ENDPOINT, data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_WHATSAPP_API_TOKEN`,
            },
        })

        console.log('Verification code sent via WhatsApp.')
    } catch (error) {
        console.error('Error sending WhatsApp message:', error)
    }
}
