//express is the framework we're going to use to handle requests
const express = require('express')

//We use this create the SHA256 hash
const crypto = require('crypto')

//Access the connection to Heroku Database
let pool = require('../utilities/utils').pool

let getHash = require('../utilities/utils').getHash

let sendEmail = require('../utilities/utils').sendEmail

let validPassword = require('../utilities/utils').validPassword

var router = express.Router()

const bodyParser = require("body-parser")
//This allows parsing of the body of POST requests, that are encoded in JSON
router.use(bodyParser.json())

/**
 * @api {post} auth/changepassword Request to change a user's password
 * @apiName ChangePassword
 * @apiGroup Auth
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiParam {String} currentpassword the user's current password
 * @apiParam {String} newpassword the user's new password
 * 
 * @apiSuccess (Success 201) {boolean} success true when the password is changed
 * 
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: Same password) {String} message New password cannot be the same as current password
 * @apiError (400: Invalid password) {String} message New password does not match required criteria 
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 */ 
router.patch('/changepassword/', (request, response, next) => {
    if (!request.body.currentpassword || !request.body.newpassword) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (request.body.currentpassword === request.body.newpassword) {
        response.status(400).send({
            message: "New password cannot be the same as current password"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    if (validPassword(request.body.newpassword)) {
        next()
    } else {
        response.status(400).send({
            message: "New password does not match required criteria"
        })
    }
}, (request, response, next) => {
    let query = "SELECT Password, Salt FROM Members WHERE MemberId=$1"
    let values = [request.decoded.memberid]
    pool.query(query, values)
        .then(result => { 
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: 'User not found' 
                })
            }
            let salt = result.rows[0].salt
            //Retrieve our copy of the password
            let ourSaltedHash = result.rows[0].password 

            //Combined their password with our salt, then hash
            let theirSaltedHash = getHash(request.body.currentpassword, salt)

            //Did our salted hash match their salted hash?
            if (ourSaltedHash === theirSaltedHash ) {
                //credentials match
                next()
            } else {
                //credentials dod not match
                response.status(400).send({
                    message: 'Incorrect password' 
                })
            }
        })
        .catch((err) => {
            response.status(400).send({
                message: err.detail
            })
        })
}, (request, response) => {
    let salt = crypto.randomBytes(32).toString("hex")
    let salted_hash = getHash(request.body.newpassword, salt)
    let query = `UPDATE Members
                    SET Password=$1, Salt=$2
                    WHERE MemberId=$3`
    let values = [salted_hash, salt, request.decoded.memberid]
    pool.query(query, values)
        .then(
            response.status(200).send({
                success: true
            })
        )
        .catch(err => {
            response.status(400).send({
                message: err.detail
            })
        })
})

module.exports = router