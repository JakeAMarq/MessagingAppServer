//express is the framework we're going to use to handle requests
const express = require('express');

//We use this create the SHA256 hash
const crypto = require('crypto');

//Access the connection to Heroku Database
let pool = require('../../utilities/utils').pool;

let sendEmail = require('../../utilities/utils').sendEmail;

let getHash = require('../../utilities/utils').getHash;

let validPassword = require('../../utilities/utils').validPassword;

var router = express.Router();

const bodyParser = require("body-parser");
//This allows parsing of the body of POST requests, that are encoded in JSON
router.use(bodyParser.json());

/**
 * @api {post} auth/sendforgotpasswordcode Send a verification code to a user's email for a password reset
 * @apiName Register
 * @apiGroup Auth
 * 
 * @apiParam {String} first a users first name
 * @apiParam {String} last a users last name
 * @apiParam {String} email a users email *required unique
 * @apiParam {String} password a users password
 * 
 * @apiSuccess (Success 201) {boolean} success true when the name is inserted
 * @apiSuccess (Success 201) {String} email the email of the user inserted 
 * 
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: Username exists) {String} message Username exists
 * @apiError (400: Email exists) {String} message Email exists
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 */ 
router.post('/forgotpassword/sendcode', (request, response, next) => {
    if (!request.query.email) {
        response.status(400).send({
            message: "Missing required information"
        });
    } else {
        next();
    }
}, (request, response, next) => {
    let query = `SELECT MemberId FROM Members WHERE Email=$1`;
    let values = [request.query.email];

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Email not found"
                });
            } else {
                request.query.memberid = result.rows[0].memberid;
                next();
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        });
}, (request, response, next) => {
    const min = 100000;
    const max = 1000000;

    let code = Math.floor(Math.random() * (max - min)) + min;
    sendEmail(request.query.email, 
                "Reset password", 
                `Here is your verification code: ${code}`)

    let query = `INSERT INTO VerificationCodes(Code, MemberID)
                    VALUES ($1, $2)`
    let values = [code, request.query.memberid]
    pool.query(query, values)
        .then(result => {
            response.status(200).send({
                success: true
            })
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
});

/**
 * @api {post} auth/sendforgotpasswordcode Send a verification code to a user's email for a password reset
 * @apiName Register
 * @apiGroup Auth
 * 
 * @apiParam (body) {String} email a users email *required unique
 * @apiParam (body) {String} newpassword a users password
 * @apiParam (body) {Number} code the verification code sent to the user's email
 * 
 * @apiSuccess (Success 201) {boolean} success true when the name is inserted
 * @apiSuccess (Success 201) {String} email the email of the user inserted 
 * 
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 */ 
router.patch('/forgotpassword/reset', (request, response, next) => {
    if (!request.body.email || !request.body.newpassword || !request.body.code) {
        response.status(400).send({
            message: "Missing required information"
        });
    } else {
        next();
    }
}, (request, response, next) => {
    let query = `SELECT MemberId FROM Members WHERE Email=$1`
    let values = [request.body.email]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Email not found"
                });
            } else {
                request.body.memberid = result.rows[0].memberid;
                next();
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        });
}, (request, response, next) => {
    if (validPassword(request.body.newpassword)) {
        next()
    } else {
        response.status(400).send({
            message: "New password does not match required criteria"
        })
    }
}, (request, response) => {
    let salt = crypto.randomBytes(32).toString("hex")
    let salted_hash = getHash(request.body.newpassword, salt)
    let query = `UPDATE Members
                    SET Password=$1, Salt=$2
                    WHERE MemberId=$3`
    let values = [salted_hash, salt, request.body.memberid]
    pool.query(query, values)
        .then(
            response.status(200).send({
                success: true
            })
        )
        .catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
})

module.exports = router;