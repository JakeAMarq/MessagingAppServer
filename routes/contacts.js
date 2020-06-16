// express is the framework we're going to use to handle requests
const express = require('express')

// Access the connection to Heroku Database
let pool = require('../utilities/utils').pool

var router = express.Router()

// This allows parsing of the body of POST requests, that are encoded in JSON
router.use(require("body-parser").json())

let pushy = require('../utilities/utils').pushy

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} chats/ Send contact request to user
 * @apiName AddContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} name the name for the chat
 * 
 * @apiSuccess (Success 201) {boolean} success true when the request is sent
 *  
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.post("/add/", (request, response, next) => {
    if (!request.body.user) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    // Validate user being added exists
    var insert;
    if (request.body.user.includes("@")) {
        insert = `SELECT MemberId 
                    FROM Members
                    WHERE Email=$1`
    } else {
        insert = `SELECT MemberId
                    FROM Members
                    WHERE Username=$1`
    }    
    let values = [request.body.user]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "User not found"
                })
            } else {
                request.body.memberid = result.rows[0].memberid
                next()
            }
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response, next) => {
    // Check if they're already connected
    let insert = `SELECT MemberID_A, Verified FROM Contacts
                    WHERE (MemberID_A=$1 AND MemberID_B=$2)
                    OR (MemberID_B=$1 AND MemberID_A=$1)`
    let values = [request.decoded.memberid, request.body.memberid]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                next()
            } else if (result.rows[0].verified == 1) {
                response.status(404).send({
                    message: "User is already in your contacts list"
                })
            } else if (result.rows[0].memberid_a == request.decoded.memberid) {
                response.status(404).send({
                    message: "You've already send this user a contact request"
                })
            } else { 
                response.status(404).send({
                    message: "User has already sent you a contact request"
                })
            }
        }).catch(err => {

        })
}, (request, response, next) => {
    // Add request to contacts 
    let insert = `INSERT INTO Contacts(MemberId_A, MemberId_B, Verified)
                  VALUES ($1, $2, 0)`
    let values = [request.decoded.memberid, request.body.memberid]
    pool.query(insert, values)
        .then(result => {
            next()
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response) => {
    // Send notification to user receiving request

})

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} chats/ Send contact request to user
 * @apiName AddContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} name the name for the chat
 * 
 * @apiSuccess (Success 201) {boolean} success true when the request is sent
 *  
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.post("/accept/", (request, response, next) => {
    if (!request.body.user) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    // Validate user exists
    var insert;
    if (request.body.user.includes("@")) {
        insert = `SELECT MemberId 
                    FROM Members
                    WHERE Email=$1`
    } else {
        insert = `SELECT MemberId
                    FROM Members
                    WHERE Username=$1`
    }    
    let values = [request.body.user]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "User not found"
                })
            } else {
                request.body.memberid = result.rows[0].memberid
                next()
            }
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response, next) => {
    // Validate request exists
    let insert = `SELECT PrimaryKey, Verified FROM Contacts
                    WHERE MemberID_A=$1 AND MemberID_B=$2`
    let values = [request.body.memberid, request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Request not found"
                })
            } else if (result.rows[0].verified == 1) {
                response.status(404).send({
                    message: "Request already accepted"
                })
            } else {
                request.body.primarykey = result.rows[0].primarykey;
                next()
            }
        }).catch(err => {

        })
}, (request, response, next) => {
    // Set verified to one for request
    let insert = `UPDATE Contacts
                    SET Verified=1
                    WHERE PrimaryKey=$1`
    let values = [request.decoded.primarykey]
    pool.query(insert, values)
        .then(result => {
            next()
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response) => {
    // Send notification to user whose request is being accepted

})

