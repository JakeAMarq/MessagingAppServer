//express is the framework we're going to use to handle requests
const express = require('express')

let pool = require('../../utilities/utils').pool

var router = express.Router()

const bodyParser = require("body-parser")
//This allows parsing of the body of POST requests, that are encoded in JSON
router.use(bodyParser.json())

/**
 * @api {post} auth/activate Activate a user's account (AKA verify their email)
 * @apiName Register
 * @apiGroup Auth
 * 
 * @apiParam (query) {String} email the user's email
 * @apiParam (query) {Number} code the verification code sent to the user's email
 * 
 * @apiSuccess (Success 201) {boolean} success true when the name is inserted
 * 
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: Username exists) {String} message Username exists
 * @apiError (400: Email exists) {String} message Email exists
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 */ 
router.get('/activate', (request, response, next) => {
    if (!request.query.email || !request.query.code) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next();
    }
}, (request, response, next) => {
    let query = `SELECT Verification, MemberId FROM Members WHERE Email=$1`
    let values = [request.query.email]
    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Email not found"
                })
            } else if (result.rows[0].verification == 1) {
                response.status(400).send({
                    message: "Account already activated"
                })
            } else {
                request.query.memberid = result.rows[0].memberid;
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    let query = `SELECT Code FROM VerificationCodes WHERE MemberId=$1`
    let values = [request.query.memberid]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                // TODO: Add option to resend verification email here
                response.status(400).send({
                    message: "Code expired, get new verification code"
                })
            } else if (result.rows[0].code != request.query.code) {
                response.status(400).send({
                    message: "Incorrect verification code"
                })
            } else {
                next();
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    let query = `UPDATE Members SET Verification=1 WHERE MemberId=$1`
    let values = [request.query.memberid]

    pool.query(query, values)
        .then(result => {
            next()
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response) => {
    let query = `DELETE FROM VerificationCodes WHERE MemberId=$1`
    let values = [request.query.memberid]

    pool.query(query, values)
        .then(result => {
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.write(`<title>Account Activated</title>
                            <body>
                                <h3>Account activated</h3>
                                <p>Thanks for registering!</p>`);
            response.end();
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
})

module.exports = router