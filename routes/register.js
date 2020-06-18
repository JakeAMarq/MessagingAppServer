//express is the framework we're going to use to handle requests
const express = require('express')

//We use this create the SHA256 hash
const crypto = require("crypto")

//Access the connection to Heroku Database
let pool = require('../utilities/utils').pool

let getHash = require('../utilities/utils').getHash

let sendEmail = require('../utilities/utils').sendEmail

let validName = require('../utilities/utils').validName
let validUsername = require('../utilities/utils').validUsername
let validPassword = require('../utilities/utils').validPassword

var router = express.Router()

const bodyParser = require("body-parser")
//This allows parsing of the body of POST requests, that are encoded in JSON
router.use(bodyParser.json())

// TODO: Email verification
// TODO: Forgot password
// TODO: Improve validation

/**
 * @api {post} auth/register Request to register a user
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
router.post('/register/', (request, response, next) => {
    if (!request.body.first || !request.body.last || !request.body.username || !request.body.email || !request.body.password) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    if (validName(request.body.first)) {
        next()
    } else {
        response.status(400).send({
            message: "Invalid first name"
        })
    }
}, (request, response, next) => {
    if (validName(request.body.last)) {
        next()
    } else {
        response.status(400).send({
            message: "Invalid last name"
        })
    }
}, (request, response, next) => {
    if (validUsername(request.body.username)) {
        next()
    } else {
        response.status(400).send({
            message: "Invalid username"
        })
    }
}, (request, response, next) => {
    if (request.body.email.includes("@")) {
        next()
    } else {
        response.status(400).send({
            message: "Invalid email"
        })
    }
}, (request, response, next) => {
    if (validPassword(request.body.password)) {
        next()
    } else {
        response.status(400).send({
            message: "Invalid password"
        })
    }
}, (request, response) => {
    response.type("application/json")

    //Retrieve data from query params
    var first = request.body.first
    var last = request.body.last
    var username = request.body.username  
    var email = request.body.email
    var password = request.body.password

    //We're storing salted hashes to make our application more secure
    //If you're interested as to what that is, and why we should use it
    //watch this youtube video: https://www.youtube.com/watch?v=8ZtInClXe1Q
    let salt = crypto.randomBytes(32).toString("hex")
    let salted_hash = getHash(password, salt)

    //We're using placeholders ($1, $2, $3) in the SQL query string to avoid SQL Injection
    //If you want to read more: https://stackoverflow.com/a/8265319
    let query = "INSERT INTO MEMBERS(FirstName, LastName, Username, Email, Password, Salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING Email"
    let values = [first, last, username, email, salted_hash, salt]
    pool.query(query, values)
        .then(result => {
            //We successfully added the user, let the user know
            response.status(201).send({
                success: true,
                email: result.rows[0].email
            })
            sendEmail("uwnetid@uw.edu", email, "Welcome!", "<strong>Welcome to our app!</strong>");
        })
        .catch((err) => {
            if (err.constraint == "members_username_key") {
                response.status(400).send({
                    message: "Username exists"
                })
            } else if (err.constraint == "members_email_key") {
                response.status(400).send({
                    message: "Email exists"
                })
            } else {
                response.status(400).send({
                    message: err.detail
                })
            }
        })
})

module.exports = router