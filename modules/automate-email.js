

const nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: '465',
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.ZOHO_EMAIL_USER , // generated ethereal user
    pass: process.env.ZOHO_EMAIL_PASS, // generated ethereal password
  },
});


const SendEmail = (to, content, subject) => {
  return new Promise((resolve, reject) => {
    if (!content) return reject(new Error('fail because mail content was empty'));
      const options =  {
        from: process.env.ZOHO_EMAIL_USER,
        to,
        subject,
        text: "", 
        html: content, // html body
      };
      return transporter.sendMail(options, (error, info) => {
        if (error) return reject(error);
        return resolve(info);
      });
    });
};



module.exports ={
    SendEmail,
}