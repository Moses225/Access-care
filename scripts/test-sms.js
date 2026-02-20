require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

async function sendTestSMS() {
  try {
    const message = await client.messages.create({
      body: 'Test from AccessCare! Your Twilio integration is working! 🎉',
      from: twilioPhone,
      to: '+15139736057', // Replace with YOUR phone number
    });
    
    console.log('✅ SMS sent successfully!');
    console.log('Message SID:', message.sid);
  } catch (error) {
    console.error('❌ SMS failed:', error.message);
  }
}

sendTestSMS();