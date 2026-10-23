import nodemailer from 'nodemailer';
import Config from './Config.js';



const MailTranspoter = nodemailer.createTransport({
  host: Config.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user:  Config.SMTP_USER,
    pass: Config.SMTP_PASSWORD,
  },
});

MailTranspoter.verify()
  .then(() => {
    console.log('Email transporter is ready to send emails');
  })
  .catch((err) => {
    console.log('Email transporter verification failed:', err);
  });

export default MailTranspoter;