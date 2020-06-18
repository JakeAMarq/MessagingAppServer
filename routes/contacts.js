// express is the framework we're going to use to handle requests
const express = require('express')

// Access the connection to Heroku Database
let pool = require('../utilities/utils').pool

var router = express.Router()

// This allows parsing of the body of POST requests, that are encoded in JSON
router.use(require("body-parser").json())

let pushy = require('../utilities/utils').pushy

// TODO: Endpoints: GetContact, GetIncomingContactRequests, GetSentContactRequests

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} chats/add/ Send contact request to user
 * @apiName AddContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the user being sent the contact request
 * 
 * @apiSuccess (Success 201) {boolean} success true when the request is sent
 * @apiSucces (Success 201) {String} added the username/email (depending on whether a username or email was
 *                                      passed in the request body) of the user being sent the contact request
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
    response.send({
        success: true,
        added: request.body.user
    })
})

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} chats/accept/
 * @apiName AcceptContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the user whose request is being accepted
 * 
 * @apiSuccess (Success 201) {boolean} success true when the request is accepted
 * @apiSucces (Success 201) {String} accepted the username/email (depending on whether a username or email was
 *                                      passed in the body) of the contact that was deleted
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
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response, next) => {
    // Set verified to one for request
    let insert = `UPDATE Contacts
                    SET Verified=1
                    WHERE PrimaryKey=$1`
    let values = [request.body.primarykey]
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
    response.send({
        success: true,
        accepted: request.body.user
    })
})

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} chats/delete/
 * @apiName DeleteContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the contact being deleted
 * 
 * @apiSuccess (Success 201) {boolean} success true when the contact is deleted
 * @apiSucces (Success 201) {String} deleted the username/email (depending on whether a username or email was
 *                                      passed in the body) of the contact that was deleted
 *  
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.post("/delete/", (request, response, next) => {
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
                // Save user's memberid for future use
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
    // Validate the two users are contacts
    let insert = `SELECT PrimaryKey FROM Contacts
                    WHERE (MemberID_A=$1 AND MemberID_B=$2)
                    OR (MemberID_B=$1 AND MemberID_A=$1)`
    let values = [request.body.memberid, request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "User is already not in contacts"
                })
            } else {
                request.body.primarykey = result.rows[0].primarykey;
                next()
            }
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response, next) => {
    // Delete contact
    let insert = `DELETE FROM Contacts
                    WHERE PrimaryKey=$1`
    let values = [request.body.primarykey]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true,
                deleted: request.body.user
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})
