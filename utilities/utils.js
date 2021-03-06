//Get the connection to Heroku Database
let pool = require('./sql_conn.js');

//We use this create the SHA256 hash
const crypto = require("crypto");

const nodemailer = require("nodemailer")

function sendEmail(to, subj, message) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            // TODO: Make a throwaway gmail, switch the account and pw over
            user: process.env.GMAIL_USERNAME,
            pass: process.env.GMAIL_PASSWORD
        }
    });

    var mailOptions = {
        from: process.env.GMAIL_USERNAME,
        to: to,
        subject: subj,
        text: message
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.log("Error sending emai:" + error);
    });
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