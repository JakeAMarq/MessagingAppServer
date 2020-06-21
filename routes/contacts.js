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
 * @api {post} contacts/add/ Send contact request to user
 * @apiName AddContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the user being sent the contact request
 * 
 * @apiSuccess (Success 201) {boolean} success true when the request is sent
 * @apiSuccess (Success 201) {String} added the username/email (depending on whether a username or email was
 *                                      passed in the request body) of the user being sent the contact request
 *  
 * @apiError (404: User not found) {String} message User not found
 * @apiError (404: Already contacts) {String} message User is already in your contacts list
 * @apiError (404: Request already sent) {String} message You've already send this user a contact request
 * @apiError (404: Request received) {String} message User has already sent you a contact request
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: SQL Error) {String} message The reported SQL error details
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
    response.status(201).send({
        success: true,
        added: request.body.user
    })
})

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {patch} contacts/accept/ Accept a user's contact request
 * @apiName AcceptContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the user whose request is being accepted
 * 
 * @apiSuccess (Success 200) {boolean} success true when the request is accepted
 * @apiSuccess (Success 200) {String} accepted the username/email (depending on whether a username or email was
 *                                      passed in the body) of the contact that was deleted
 * 
 * @apiError (404: User not found) {String} message User not found
 * @apiError (404: Contact request not found) {String} message Contact request not found
 * @apiError (404: Contact request already accepted) {String} message Contact request already accepted
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.patch("/accept/", (request, response, next) => {
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
                    message: "Contact request not found"
                })
            } else if (result.rows[0].verified == 1) {
                response.status(404).send({
                    message: "Contact request already accepted"
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
    response.status(200).send({
        success: true,
        accepted: request.body.user
    })
})

/**
 * @api {post} contacts/delete/ Delete a user from contacts
 * @apiName DeleteContact
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user the username or email of the contact being deleted
 * 
 * @apiSuccess (Success 200) {boolean} success true when the contact is deleted
 * @apiSuccess (Success 200) {String} deleted the username/email (depending on whether a username or email was
 *                                      passed in the body) of the contact that was deleted
 *  
 * @apiError (404: User not found) {String} message User not found
 * @apiError (404: User not in contacts) {String} message User is not in contacts
 * @apiError (400: Missing Parameters) {String} message Missing required information
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.delete("/delete/", (request, response, next) => {
    if (!request.body.user) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    // Validate user exists
    var query;
    if (request.body.user.includes("@")) {
        query = `SELECT MemberId 
                    FROM Members
                    WHERE Email=$1`
    } else {
        query = `SELECT MemberId
                    FROM Members
                    WHERE Username=$1`
    }    
    let values = [request.body.user]
    pool.query(query, values)
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
                    OR (MemberID_B=$1 AND MemberID_A=$2)`
    let values = [request.body.memberid, request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "User is not in contacts"
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
            response.status(200).send({
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

/**
 * @api {get} contacts/ Get contacts list
 * @apiName GetContacts
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiSuccess {Number} rowCount The number of contacts returned
 * @apiSuccess {Object[]} rows List of contacts
 * @apiSuccess {String} rows.firstname The first name of the contact
 * @apiSuccess {String} rows.lastname The last name of the contact
 * @apiSuccess {String} rows.username The username of the contact
 * @apiSuccess {String} rows.email The email of the contact
 *  
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.get("/", (request, response) => {
    let insert = `SELECT firstname, lastname, username, email
                    FROM Members, Contacts
                    WHERE (Contacts.MemberId_A=Members.MemberId
                        AND Contacts.MemberId_B=$1 AND Verified=1) 
                        OR (Contacts.MemberId_B=Members.MemberId
                        AND Contacts.MemberId_A=$1 AND Verified=1)`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.status(200).send({
                rowCount: result.rowCount,
                rows: result.rows
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})

/**
 * @api {get} contacts/incoming/ Get incoming contact requests
 * @apiName GetIncomingContactRequests
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiSuccess {Number} rowCount The number of contacts returned
 * @apiSuccess {Object[]} rows List of contacts
 * @apiSuccess {String} rows.firstname The first name of the contact
 * @apiSuccess {String} rows.lastname The last name of the contact
 * @apiSuccess {String} rows.username The username of the contact
 * @apiSuccess {String} rows.email The email of the contact
 *  
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.get("/incoming/", (request, response) => {
    let insert = `SELECT firstname, lastname, username, email
                    FROM Members, Contacts
                    WHERE Contacts.MemberId_A=Members.MemberId
                        AND Contacts.MemberId_B=$1 AND Verified=0`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.status(200).send({
                rowCount: result.rowCount,
                rows: result.rows
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})

/**
 * @api {get} contacts/outgoing/ Get outgoing contact requests
 * @apiName GetOutgoingContactRequests
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiSuccess {Number} rowCount The number of contacts returned
 * @apiSuccess {Object[]} rows List of contacts
 * @apiSuccess {String} rows.firstname The first name of the contact
 * @apiSuccess {String} rows.lastname The last name of the contact
 * @apiSuccess {String} rows.username The username of the contact
 * @apiSuccess {String} rows.email The email of the contact
 *  
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.get("/outgoing/", (request, response) => {
    let insert = `SELECT firstname, lastname, username, email
                    FROM Members, Contacts
                    WHERE Contacts.MemberId_B=Members.MemberId
                        AND Contacts.MemberId_A=$1 AND Verified=0`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.status(200).send({
                rowCount: result.rowCount,
                rows: result.rows
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})

/**
 * @api {get} contacts/search/new/ Search users that aren't in your contacts
 * @apiName SearchNewContacts
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user The username/email/name of user being searched for 
 * 
 * @apiSuccess {Number} rowCount The number of users returned
 * @apiSuccess {Object[]} rows List of users
 * @apiSuccess {String} rows.firstname The first name of the user
 * @apiSuccess {String} rows.lastname The last name of the user
 * @apiSuccess {String} rows.username The username of the user
 * @apiSuccess {String} rows.email The email of the user
 *  
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.get("/search/new/", (request, response, next) => {
    console.log(request.body);
    if (!request.body.user) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    // Getting current contacts so we can exclude them from search results
    let insert = `SELECT MemberId
                    FROM Members, Contacts
                    WHERE (Contacts.MemberId_A=Members.MemberId
                        AND Contacts.MemberId_B=$1) 
                        OR (Contacts.MemberId_B=Members.MemberId
                        AND Contacts.MemberId_A=$1)`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            request.body.rowCount = result.rowCount;
            request.body.rows = result.rows;
            next();
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response) => {
    let insert = `SELECT firstname, lastname, username, email
                    FROM Members
                    WHERE MemberId!=$1`;
    // excluding current contacts from search results
    for(let i = 0; i < request.body.rowCount; i++) {
        insert += `
                    AND MemberId!=${request.body.rows[i].memberid}`
    }
    insert += `
                    AND (UserName LIKE '%${request.body.user}%'
                    OR Email LIKE '%${request.body.user}%'
                    OR FirstName LIKE '%${request.body.user}%'
                    OR LastName LIKE '%${request.body.user}%')`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.status(200).send({
                rowCount: result.rowCount,
                rows: result.rows
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})

/**
 * @api {get} contacts/search/existing/ Search list of current contacts
 * @apiName SearchExistingContacts
 * @apiGroup Contacts
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} user The username/email/name of user being searched for 
 * 
 * @apiSuccess {Number} rowCount The number of users returned
 * @apiSuccess {Object[]} rows List of users
 * @apiSuccess {String} rows.firstname The first name of the user
 * @apiSuccess {String} rows.lastname The last name of the user
 * @apiSuccess {String} rows.username The username of the user
 * @apiSuccess {String} rows.email The email of the user
 *  
 * @apiError (400: SQL Error) {String} message The reported SQL error details
 *  
 * @apiUse JSONError
 */ 
router.get("/search/existing/", (request, response, next) => {
    if (!request.body.user) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response) => {
    // Getting current contacts so we can exclude them from search results
    let insert = `SELECT firstname, lastname, username, email
                    FROM Members, Contacts
                    WHERE ((Contacts.MemberId_A=Members.MemberId
                        AND Contacts.MemberId_B=$1 AND Verified=1) 
                        OR (Contacts.MemberId_B=Members.MemberId
                        AND Contacts.MemberId_A=$1 AND Verified=1))
                    AND (UserName LIKE '%${request.body.user}%'
                        OR Email LIKE '%${request.body.user}%'
                        OR FirstName LIKE '%${request.body.user}%'
                        OR LastName LIKE '%${request.body.user}%')`
    let values = [request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.status(200).send({
                rowCount: result.rowCount,
                rows: result.rows
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
})

module.exports = router
