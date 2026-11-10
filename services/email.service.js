
const nodemailer = require('nodemailer');

const email = process.env.CARVIO_EMAIL;
const appPassword = process.env.CARVIO_EMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: email,
    pass: appPassword,
  },
});

const sendFeedbackEmail = async ({
  name,
  phone,
  category,
  message,
}) => {
  if (!email || !appPassword) {
    throw new Error('CARVIO email credentials are missing in .env');
  }

  return transporter.sendMail({
    from: `"CARVIO Support" <${email}>`,
    to: email,
    subject: `CARVIO Support Feedback: ${category}`,
    text: [
      'New feedback received from CARVIO website',
      '',
      `Name: ${name}`,
      `Mobile: ${phone}`,
      `Category: ${category}`,
      '',
      'Message:',
      message,
    ].join('\n'),
  });
};

module.exports = { sendFeedbackEmail };
