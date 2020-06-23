//Get the connection to Heroku Database
let pool = require('./sql_conn.js');

//We use this create the SHA256 hash
const crypto = require("crypto");

const nodemailer = require("nodemailer")

async function sendEmail(to, subj, message) {
    //research nodemailer for sending email from node.
    // https://nodemailer.com/about/
    // https://www.w3schools.com/nodejs/nodejs_email.asp
    //create a burner gmail account 
    //make sure you add the password to the environmental variables
    //similar to the DATABASE_URL and PHISH_DOT_NET_KEY (later section of the lab)

    let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
        }
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: '"Messaging App" <verifyemail@messagingapp.com>', // sender address
        to: to, // list of receivers
        subject: subj, // Subject line
        text: message, // plain text body
        html: `<b>${message}</b>` // html body
    });

    //fake sending an email for now. Post a message to logs. 
    console.log('Email sent: ' + message);
}  

/**
 * Method to get a salted hash.
 * We put this in its own method to keep consistency
 * @param {string} pw the password to hash
 * @param {string} salt the salt to use when hashing
 */
function getHash(pw, salt) {
    return crypto.createHash("sha256").update(pw + salt).digest("hex");
} 

function containsUppercaseLetters(str) {
    var code, i, len;
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if ((code > 64 && code < 91)) { // upper alpha (A-Z)
        return true;
      }
    }
    return false;
}

function containsNumbers(str) {
    var code, i, len;
    for (i = 0, len = str.length; i < len; i++) {
        code = str.charCodeAt(i);
        if (code > 47 && code < 58) { // numeric (0-9)
            return true;
        }
    }
    return false;
}

function isAlphaNumeric(str) {
    var code, i, len;
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
          !(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123)) { // lower alpha (a-z)
        return false;
      }
    }
    return true;
  };

function containsSpecialCharacters(str) {
    let specialChars = '!@#$%^&*()-_=+[{]};:\'",<.>/?`~\\|';
    for (let i = 0; i < str.length; i++) {
        if (specialChars.indexOf(str.charAt(i)) != -1) {
            return true;
        }
    }
    return false;
}

function validName(str) {
    return isAlphaNumeric(str) && !containsNumbers(str) && str.length >= 1 && str.length <= 20;
}

function validUsername(str) {
    return isAlphaNumeric(str) && str.length >= 1 && str.length <= 30;
}

function validPassword(str) {
    return containsUppercaseLetters(str) && 
            containsNumbers(str) && 
            containsSpecialCharacters(str) && 
            str.length >= 8 && str.length <= 50;
}

function validRegistration(first, last, username, email, password) {
    return validName(first) && 
            validName(last) &&
            validUsername(username) &&
            validPassword(password);
}

module.exports = { 
    pool, sendEmail, getHash, validName, validUsername, validPassword
};