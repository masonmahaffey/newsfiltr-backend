// core services of the api which include login/signup etc...
const express      = require('express');
const router       = express.Router({});
const co           = require('co');
const constants    = require('./constants');
const rp           = require('request-promise-native');
const utility      = require('../common/utilityFunctions');
const config       = require('../common/config');
var ObjectId       = require('mongodb').ObjectId;
const {Storage}    = require('@google-cloud/storage');
const storage      = new Storage();


router.use((req, res, next) => utility.setHeaders(req, res, next));
router.use((req, res, next) => utility.handlePreflight(req, res, next));
router.use((req, res, next) => utility.checkToken(req, res, next));

router.post('/testsecurity', (req, res)=> {
    console.log(req.body);
    res.json({status: 'protected'});
});

router.post('/uploadImage', async (req, res) => {
    const bucketName = 'newsfiltr';
    const filename = './yardr.png';

    const stored = await storage.bucket(bucketName).upload(filename, {
        gzip: true,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    });
    res.json(stored);
});


router.post('/getFile', async (req, res) => {
    console.log('this ran');
    const bucketName = 'newsfiltr';
    const srcFilename = 'yardr.png';  

    const file = await storage.bucket(bucketName).file(srcFilename);
    res.send(file);
});


router.post('/vote', function (req, res) {
    co(function* () {
        const {id, user_unique} = req.user;const user_id = id;
        let {article_unique, violation_id, vote} = req.body;
        vote = vote ? 1 : -1;
        

        // check if user has voted
        const checkIfUserVoted = `select * from violation_verifications where article_unique = ? and user_id = ? and  violation_id = ?`;
        let userVoted = yield db.doExecute(checkIfUserVoted, [article_unique, user_id, violation_id]);
        let userVotedrs = db.convertRowsToResultSet(userVoted);

        if(userVotedrs) {
            // user has voted, update vote
            const vote_id = userVotedrs.id;

            const updateVote = `update violation_verifications set vote = ? where id = ?`;
            yield db.doExecute(updateVote, [vote, vote_id]);

        } else {
            // user has not voted, insert
            const insertVote = `insert into violation_verifications (article_unique, violation_id, user_id, user_unique, vote) values (?,?,?,?,?)`;
            yield db.doExecute(insertVote, [article_unique, violation_id, user_id, user_unique, vote]);
        }

        res.json({msg: 'Success!'});
    });
});




router.post('/report-article', function (req, res) {
    co(function* () {
        const {id, user_unique} = req.user;
        const user_id = id;
        const {title,url,source,source_url,author,author_twitter, violations} = req.body;
        var article_unique = '';
        var article_id = null;

        console.log('user_id', user_id);

        // check if report has already been submitted by the user for this url
        let reportCheckRows = yield db.doExecute('select user_id from reports where article_url = ? and user_id = ?', [url, user_id]);
        const reportCheckResultSet = db.convertRowsToResultSet(reportCheckRows);
        if(reportCheckResultSet) {
            return res.json({
                msg: 'Already submitted report!'
            }); 
        }

        // check if article already exists
        article_unique = title.replace(/[^a-zA-Z ]/g, "").split(' ').join('-').toLowerCase();
        let rows = yield db.doExecute('select id, article_unique from articles where article_unique = ?', [article_unique]);
        const rs = db.convertRowsToResultSet(rows);

        if(!rs) {
            // no article so add one
            const insrtSQL = 'insert into articles (article_unique, title, url, source, source_url, author, author_twitter,time) values (?,?,?,?,?,?,?,?)';
            let {insertId} = yield db.doExecute(insrtSQL, 
                [article_unique, title, url, source, source_url, author, author_twitter, new Date().getTime()]);
            article_id = insertId;
        } else {
            // need to grab the article information here

            article_unique = rs.article_unique;
            article_id = rs.id;
        }

        // insert report
        const insrtReportSQL = 'insert into reports (article_id, article_unique, article_url, user_id, user_unique, time) values (?,?,?,?,?,?)';
        const insertReport = yield db.doExecute(insrtReportSQL, 
            [article_id, article_unique, url, user_id, user_unique, new Date().getTime()]);
        const report_id = insertReport.insertId;

    
        
        // check and see if other article facts like these article facts
        // if so, relate to the fact pointer
        // else point to self


        // find article facts pointers
        const findArticleFactsWithSame = `select id,count from article_facts where type like ? and value like ? and article_id = ? order by time limit 1`;
        const titlePointer = yield db.doExecute(findArticleFactsWithSame, ['title', title, article_id]);
        const urlPointer = yield db.doExecute(findArticleFactsWithSame, ['url', url, article_id]);
        const sourcePointer = yield db.doExecute(findArticleFactsWithSame, ['source', source, article_id]);
        const sourceUrlPointer = yield db.doExecute(findArticleFactsWithSame, ['source_url', source_url, article_id]);
        const authorPointer = yield db.doExecute(findArticleFactsWithSame, ['author', author, article_id]);
        const authorTwitterPointer = yield db.doExecute(findArticleFactsWithSame, ['author_twitter', author_twitter, article_id]);

        
        // if none exist, relate facts to themselves 

        let titlePointerInsert = checkPointerExists(titlePointer);
        let titlePointerCounter = getCounter(titlePointer);

        let urlPointerInsert = checkPointerExists(urlPointer);
        let urlPointerCounter = getCounter(urlPointer);

        let sourcePointerInsert = checkPointerExists(sourcePointer);
        let sourcePointerCounter = getCounter(sourcePointer);

        let sourceUrlPointerInsert = checkPointerExists(sourceUrlPointer);
        let sourceUrlPointerCounter = getCounter(sourceUrlPointer);

        let authorPointerInsert = checkPointerExists(authorPointer);
        let authorPointerCounter = getCounter(authorPointer);

        let authorTwitterPointerInsert = checkPointerExists(authorTwitterPointer);
        let authorTwitterPointerCounter = getCounter(authorTwitterPointer);


        if(titlePointerInsert == false) {
            titlePointerInsert = 1;
        }
        if(urlPointerInsert == false) {
            urlPointerInsert = 1;
        }
        if(sourcePointerInsert == false) {
            sourcePointerInsert = 1;
        }
        if(sourceUrlPointerInsert == false) {
            sourceUrlPointerInsert = 1;
        }
        if(authorPointerInsert == false) {
            authorPointerInsert = 1;
        }
        if(authorTwitterPointerInsert == false) {
            authorTwitterPointerInsert = 1;
        }
        
        const time = new Date().getTime();
        // insert facts
         const insrtArticleFactSQL = 'insert into article_facts (article_id, report_id, type, value, relates_to, time) values (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?)';
         let articleFactIdsRes = yield db.doExecute(insrtArticleFactSQL, [
             article_id, report_id, 'title', title, titlePointerInsert,time,
             article_id, report_id, 'url', url, urlPointerInsert,time,
             article_id, report_id, 'source', source, sourcePointerInsert,time,
             article_id, report_id, 'source_url', source_url, sourceUrlPointerInsert,time,
             article_id, report_id, 'author', author, authorPointerInsert,time,
             article_id, report_id, 'author_twitter', author_twitter, authorTwitterPointerInsert,time]);

            
        // get the article fact ids in case you need to self point
        let initialNumber = parseInt(articleFactIdsRes.insertId);
        let titleId = initialNumber;initialNumber++;
        let urlId = initialNumber;initialNumber++;
        let sourceId = initialNumber;initialNumber++;
        let sourceUrlId = initialNumber;initialNumber++;
        let authorId = initialNumber;initialNumber++;
        let authorTwitterId = initialNumber;


        
        if(titlePointerInsert == 1) {
            // update the relates_to for article facts that are self pointing
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [titleId, titleId]);
        } else {
            // increment the count for pointers
            titlePointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [titlePointerCounter, titlePointerInsert]);
        }
        if(urlPointerInsert == 1) {
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [urlId, urlId]);
        } else {
            // increment the count for pointers
            urlPointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [urlPointerCounter, urlPointerInsert]);
        }
        if(sourcePointerInsert == 1) {
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [sourceId, sourceId]);
        } else {
            // increment the count for pointers
            sourcePointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [sourcePointerCounter, sourcePointerInsert]);
        }
        if(sourceUrlPointerInsert == 1) {
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [sourceUrlId, sourceUrlId]);
        } else {
            // increment the count for pointers
            sourceUrlPointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [sourceUrlPointerCounter, sourceUrlPointerInsert]);
        }
        if(authorPointerInsert == 1) {
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [authorId, authorId]);
        } else {
            // increment the count for pointers
            authorPointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [authorPointerCounter, authorPointerInsert]);
        }
        if(authorTwitterPointerInsert == 1) {
            yield db.doExecute(`update article_facts set relates_to = ? where id = ?`, [authorTwitterId, authorTwitterId]);
        } else {
            // increment the count for pointers
            authorTwitterPointerCounter++;
            yield db.doExecute(`update article_facts set count = ? where id = ?`, [authorTwitterPointerCounter, authorTwitterPointerInsert]);
        }
 
        





       

        
        // insert violations
        const {insertViolationsSQL, violationInserts} = utility.buildViolationsInsertSQL(violations, report_id, article_id);
        const insertViolationsResponse = yield db.doExecute(insertViolationsSQL, violationInserts);

        // get list of violation ids
        let firstViolationId = insertViolationsResponse.insertId;
        let violationIds = [firstViolationId];
        violations.forEach(violation => {
            firstViolationId++;
            violationIds.push(firstViolationId);
        });
        violationIds.pop();

        // check each violation to see if others are like it in the violations table
        // if some are like it then add relationships
        // else then insert a self-pointing record in the violation relations table
        
        for(var i in violations) {
            const findViolationsLike = `select id,count from violations where type like ? and sentence LIKE ? and report_id != ? and article_id = ? order by time limit 1`;
            const similarViolationsResponse = yield db.doExecute(findViolationsLike, [violations[i].type, violations[i].sentence, report_id, article_id]);
            if(similarViolationsResponse && similarViolationsResponse.length > 0) {
                // found similar violations so add pointer record to point of reference
                // similarViolationsResponse[0].id;
                // to violation_relations

                const insertViolationRelations = `insert into violation_relations (article_id, report_id, violation_id, relates_to) values (?,?,?,?)`
                yield db.doExecute(insertViolationRelations, [article_id, report_id, violationIds[i], similarViolationsResponse[0].id]);
                
                // increment the count of similar violations on the violation relations pointer record
                
                // get the pointer record info
                const findrecordsql = `select id,count from violation_relations where relates_to = ? order by id limit 1`;
                const pointerRecord = yield db.doExecute(findrecordsql, [similarViolationsResponse[0].id]);
                let count = pointerRecord[0].count;

                // increment the pointer record count
                count++;   
                
                // update the relational pointer record
                const incrementCommonSentenceViolationsCount = `update violation_relations set count = ? where id = ?`
                yield db.doExecute(incrementCommonSentenceViolationsCount, [count, pointerRecord[0].id]);

                // update the header record
                const incrementViolationsCount = `update violations set count = ? where id = ?`
                yield db.doExecute(incrementViolationsCount, [count, similarViolationsResponse[0].id]);

            } else {
                // no similar violations found so insert pointer record
                const insertViolationRelations = `insert into violation_relations (article_id, report_id, violation_id, relates_to) values (?,?,?,?)`
                yield db.doExecute(insertViolationRelations, [article_id, report_id, violationIds[i], violationIds[i]]);
            }
        }

        // return res.json({
        //     titlePointer: titlePointer,
        //     title: title,
        //     article_id: article_id
        // });
        
        res.json({
            msg: 'Success!'
        }); 
    });
});


function checkPointerExists(pointer) {
    if(pointer) {
        if(pointer[0]) {
            // return [pointer[0].id, pointer[0].count];
            return pointer[0].id;
        }
    }
    return false;
}

function getCounter(pointer) {
    if(pointer) {
        if(pointer[0]) {
            return pointer[0].count;
        }
    }
    return false;
}





// <!-- REVIEWS -->
router.post('/add-review-legacy', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','articles'], {
            unique: req.body.id
        }); 
        var rs     = yield db.convertRowsToResultSet(rows);
        rs = null;

        if(rs != null) {

            var alreadySubmittedReview = false;
            rs.reviews.forEach(item => {
                if(item.user_unique == req.userdata.user_unique) {
                    alreadySubmittedReview = true;
                }
            });

            var validations = false;
            if((req.body.sensationalism > 5) && (req.body.sensationalism < 0)) {
                console.log('sensationalism');
                validations = true;
            }
            if((!req.body.accuracy > 5) && (!req.body.accuracy < 0)) {
                console.log('accuracy');
                validations = true;
            }
            if((!req.body.bias > 5) && (!req.body.bias < 0)) {
                console.log('bias');
                validations = true;
            }

            if(alreadySubmittedReview) {
                res.json({msg: 'Youve already posted a review!'})
            } else if(validations) {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            } else {

                const rows = yield db.doNoSqlExecute(['find', 'users'], {
                    token: req.body.token
                });

                // "_id": {
                //     "$oid": "5b99a94a7069da57451971f5"
                // },
                // "email": "masonmahaffey00@gmail.com",
                //     "password": "$2a$10$yI1P0JQ0cZbQtU8FvQoJF.q3CnpVkyKCwUSVutVfQuKhsFMUspBcK",
                //     "token": "7a40b8d0-b6e8-11e8-9653-bf2851fa27b0",
                //     "verification_uuid": "6d843950-b6e8-11e8-9653-bf2851fa27b0",
                //     "verified": true,
                //     "subscription": "free",
                //     "group": "standard",
                //     "country": "default",
                //     "displayname": "Mason Mahaffey",
                //     "tagline": "tagline test",
                //     "description": "<p>description test<\/p>",
                //     "user_unique": "Mason Mahaffey",
                //     "comments": []

                var userdata = rows[0];
                console.log('userdata %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
                console.log(userdata);

                userdata.reviews = [];
                userdata.votes = [];
                delete userdata.reviews;
                delete userdata.votes;
                delete userdata._id;
                delete userdata.password;
                delete userdata.token;
                delete userdata.verification_uuid;
                delete userdata.verified;
                delete userdata.subscription;
                delete userdata.group;
                delete userdata.country;
                delete userdata.comments;

                console.log('userdata %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
                console.log(userdata);

                var review = {
                    title: req.body.title,
                    body: req.body.body,
                    sensationalism: req.body.sensationalism,
                    accuracy: req.body.accuracy,
                    bias: req.body.bias,
                    user: userdata,
                    time: new Date().getTime(),
                    unique: req.body.id
                };
                rs.reviews.push(review);

                console.log('rs %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
                console.log(rs);

                const updateArticle = yield db.doNoSqlExecute(['update', 'articles'], [{
                    unique: req.body.id
                }, rs]);

                const user = yield db.doNoSqlExecute(['find','users'], {
                    token: req.body.token
                });
                const userobj     = yield db.convertRowsToResultSet(user);

                delete userobj._id;
                delete review.user;

                if(userobj.reviews) {
                    userobj.reviews.push(review);

                } else {
                    userobj.reviews = [];
                    userobj.reviews.push(review);
                }

                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, userobj]);

                res.json({
                    msg: 'Successfully added review!'
                });
            }
        } else {
            res.json({msg: 'Failed to add review!'});
        }
    });
});





<!-- REVIEWS -->
router.post('/add-review', function(req, res) {
    co(function*() {
        const userrows = yield db.doNoSqlExecute(['find', 'users'], {
            token: req.body.token
        });
        var userdata = userrows[0];

        const rows = yield db.doNoSqlExecute(['find','reviews'], {
            user_unique: userdata.user_unique,
            unique: req.body.id
        });
        const rs     = db.convertRowsToResultSet(rows);

        var alreadySubmittedReview = false;
        if(rs) {
            alreadySubmittedReview = true;
        }

        if(true) {

            var validations = false;
            if((req.body.sensationalism > 5) && (req.body.sensationalism < 0)) {
                console.log('sensationalism');
                validations = true;
            }
            if((!req.body.accuracy > 5) && (!req.body.accuracy < 0)) {
                console.log('accuracy');
                validations = true;
            }
            if((!req.body.bias > 5) && (!req.body.bias < 0)) {
                console.log('bias');
                validations = true;
            }

            if(alreadySubmittedReview) {
                res.json({msg: 'Youve already posted a review!'})
            } else if(validations) {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            } else {

                userdata.reviews = [];
                userdata.votes = [];
                userdata.email = null;
                delete userdata.reviews;
                delete userdata.votes;
                delete userdata._id;
                delete userdata.password;
                delete userdata.token;
                delete userdata.verification_uuid;
                delete userdata.verified;
                delete userdata.subscription;
                delete userdata.group;
                delete userdata.country;
                delete userdata.comments;
                delete userdata.email;

                var review = {
                    title: req.body.title,
                    body: req.body.body,
                    sensationalism: req.body.sensationalism,
                    accuracy: req.body.accuracy,
                    bias: req.body.bias,
                    user: userdata,
                    user_unique: userdata.user_unique,
                    time: new Date().getTime(),
                    unique: req.body.id,
                    voteCount: 0
                };

                const insertReviews = yield db.doNoSqlExecute(['insert','reviews'], [review]);
                const user = yield db.doNoSqlExecute(['find','users'], {
                    token: req.body.token
                });
                const userobj     = yield db.convertRowsToResultSet(user);

                delete userobj._id;
                delete review.user;

                if(userobj.reviews) {
                    userobj.reviews.push(review);

                } else {
                    userobj.reviews = [];
                    userobj.reviews.push(review);
                }

                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, userobj]);

                res.json({
                    msg: 'Successfully added review!'
                });
            }
        } else {
            res.json({msg: 'Failed to add review!'});
        }
    });
});






router.post('/edit-review-legacy', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','articles'], {
            unique: req.body.id
        });
        var rs     =  rows[0];
        rs = null;

        if(rs != null) {
            var indexofreview = 0;
            rs.reviews.forEach((item,index) => {
                if(item.user.user_unique == req.userdata.user_unique) {
                    indexofreview = index;
                    alreadySubmittedReview = true;
                }

            });
            var validations = true;
            if((req.body.sensationalism > 10) && (req.body.sensationalism < 0)) {
                console.log('sensationalism');
                validations = false;
            }
            if((!req.body.accuracy > 10) && (!req.body.accuracy < 0)) {
                console.log('accuracy');
                validations = false;
            }
            if((!req.body.bias > 10) && (!req.body.bias < 0)) {
                console.log('bias');
                validations = false;

            }
            if(validations) {
                rs.reviews[indexofreview].title = req.body.title;
                rs.reviews[indexofreview].body = req.body.body;
                rs.reviews[indexofreview].sensationalism = req.body.sensationalism;
                rs.reviews[indexofreview].accuracy = req.body.accuracy;
                rs.reviews[indexofreview].bias = req.body.bias;

                const review = rs.reviews[indexofreview];


                console.log(review.unique);

                const updateArticle = yield db.doNoSqlExecute(['update', 'articles'], [{
                    unique: req.body.id
                }, rs]);
                const userrows = yield db.doNoSqlExecute(['find','users'], {
                    token: req.body.token
                });

                const user     = yield db.convertRowsToResultSet(userrows);
                var reviews = [];
                user.reviews.forEach(data => {
                    if(data.unique == req.body.id) {
                        data = review;
                    }
                    reviews.push(data);
                });
                user.reviews = reviews;

                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, user]);

                res.json({
                    msg: 'Successfully edited review!'
                });
            } else {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            }
        } else {
            res.json({msg: 'Failed to add review!'});
        }
    });
});








router.post('/edit-review', function(req, res) {
    co(function*() {
        const userrows = yield db.doNoSqlExecute(['find', 'users'], {
            token: req.body.token
        });
        var userdata = userrows[0];

        const rows = yield db.doNoSqlExecute(['find','reviews'], {
            user_unique: userdata.user_unique,
            unique: req.body.id
        });
        var rs     =  rows[0];

        if(rs != null) {

            var validations = true;
            if((req.body.sensationalism > 10) && (req.body.sensationalism < 0)) {
                console.log('sensationalism');
                validations = false;
            }
            if((!req.body.accuracy > 10) && (!req.body.accuracy < 0)) {
                console.log('accuracy');
                validations = false;
            }
            if((!req.body.bias > 10) && (!req.body.bias < 0)) {
                console.log('bias');
                validations = false;
            }
            if(validations) {
                rs.title = req.body.title;
                rs.body = req.body.body;
                rs.sensationalism = req.body.sensationalism;
                rs.accuracy = req.body.accuracy;
                rs.bias = req.body.bias;
                const review = rs;

                const updateArticle = yield db.doNoSqlExecute(['update', 'reviews'], [{
                    unique: req.body.id,
                    user_unique: userdata.user_unique
                }, rs]);

                const userrows = yield db.doNoSqlExecute(['find','users'], {
                    token: req.body.token
                });

                const user     = yield db.convertRowsToResultSet(userrows);
                var reviews = [];
                user.reviews.forEach(data => {
                    if(data.unique == req.body.id) {
                        data = review;
                    }
                    reviews.push(data);
                });
                user.reviews = reviews;

                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, user]);

                res.json({
                    msg: 'Successfully edited review!'
                });
            } else {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            }
        } else {
            res.json({msg: 'Failed to add review!'});
        }
    });
});

router.post('/report-review', function(req, res) {
    co(function*() {
        const userrows = yield db.doNoSqlExecute(['find', 'users'], {
            token: req.body.token
        });
        var userdata = userrows[0];

        const rows = yield db.doNoSqlExecute(['find','reviews'], {
            _id: ObjectId(req.body.review)
        });
        var rs     =  rows[0];

        if(rs != null) {

            const userrows = yield db.doNoSqlExecute(['find', 'reported'], {
                user: userdata._id
            });

            if (userrows.length == 0) {
                const insertReported = yield db.doNoSqlExecute(['insert','reported'], [{
                    type: 'review',
                    data: rs,
                    user: userdata._id,
                    spam: req.body.spam,
                    trolling: req.body.trolling
                }]);

                res.json({
                    msg: 'Successfully reported review!'
                });
            } else {
                res.json({
                    msg: 'Already reported review!'
                });
            }
        } else {
            res.json({msg: 'Failed to report review!'});
        }
    });
});


router.post('/update-profile-picture', function(req, res) {
    co(function*() {
        const userrows = yield db.doNoSqlExecute(['find', 'users'], {
            token: req.body.token
        });
        var userdata = userrows[0];
        if(userdata != null) {

            const updateProfilePicture = yield db.doNoSqlExecute(['update','users'], [{
                token: req.body.token
            }, {
               profile_picture: req.body.imageUrl
            }]);

            res.json({
                msg: 'Successfully updated profile picture!'
            });
        } else {
            res.json({msg: 'Failed to update profile picture!'});
        }
    });
});



<!-- VOTES -->
router.post('/vote', function(req, res) {
    co(function*() {
        console.log('ENTERING /vote');

        // check user, if vote does not exist add
        // if vote of same type exists update
        // if vote of different type exists remove, add

        var rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });
        var rs   = db.convertRowsToResultSet(rows);

        var alreadySubmittedVote = false;
        var foundVoteIndex = 0;
        rs.votes.forEach((item, index) => {
            if(item.unique == req.body.id) {
                alreadySubmittedVote = true;
                foundVoteIndex = index;
            }
        });

        var validations = false;
        if((req.body.sensationalism > 5) || (req.body.sensationalism < 0)) {
            console.log('sensationalism');
            validations = true;
        }
        if((req.body.accuracy > 5) || (req.body.accuracy < 0)) {
            console.log('accuracy');
            validations = true;
        }
        if((req.body.bias > 5) || (req.body.bias < 0)) {
            console.log('bias');
            validations = true;
        }

        if(alreadySubmittedVote && !validations) {
            console.log('ENTERING ALREADY SUBMITTED VOTE');

            var voteAmount = 0;


            if(req.body.cancelVote) {
                if(req.body.isUpvote) {
                    voteAmount--;
                } else {
                    voteAmount++;
                }
            } else{

                if(!rs.votes[foundVoteIndex].lastVote && rs.votes[foundVoteIndex].isUpvote && !req.body.isUpvote) {
                    voteAmount = -2;
                }
                else if(!rs.votes[foundVoteIndex].lastVote && !rs.votes[foundVoteIndex].isUpvote && req.body.isUpvote) {
                    voteAmount = 2;
                } else {
                    if(req.body.isUpvote) {
                        voteAmount = 1;
                    } else {
                        voteAmount = -1;
                    }
                }
            }

            // Update the user votes to contain the new vote state
            rs.votes[foundVoteIndex].isUpvote = req.body.isUpvote;
            rs.votes[foundVoteIndex].sensationalism = req.body.sensationalism;
            rs.votes[foundVoteIndex].accuracy = req.body.accuracy;
            rs.votes[foundVoteIndex].bias = req.body.bias;
            rs.votes[foundVoteIndex].isFakeNews = req.body.isUpvote;
            rs.votes[foundVoteIndex].time = new Date().getTime();
            rs.votes[foundVoteIndex].cancelVote = req.body.cancelVote;
            rs.votes[foundVoteIndex].lastVote = req.body.cancelVote;

            // delete the id from the user to prevent update user error
            delete rs._id;

            console.log('0');
            var articlerows = yield db.doNoSqlExecute(['find','articles'], {
                unique: req.body.id
            });
            var article = db.convertRowsToResultSet(articlerows);
            console.log('1');

            if(article) {
                delete article._id;

                var voteCount = article.voteCount;
                voteCount = voteCount + voteAmount;
                console.log('COUNTING', voteCount);
                article.voteCount = voteCount;
                const updateArticle = yield db.doNoSqlExecute(['update', 'articles'], [{
                    unique: req.body.id
                }, article]);
            }

            delete rs.votes[foundVoteIndex]._id;
            console.log('2');

            // update the vote to reflect the state of the vote in the local user object
            const updateVote = yield db.doNoSqlExecute(['update', 'votes'], [{
                unique: req.body.id
            }, rs.votes[foundVoteIndex]]);
            console.log('3');


            // update the user to reflect the state of the local user object
            const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                token: req.body.token
            }, rs]);
            console.log('4');


            console.log('EXITING ALREADY SUBMITTED VOTE')
            res.json({msg: 'Success!'});

        } else if(validations) {
            res.json({msg: 'Fuck off you asshole, we have your ip now. You will be reported to the authorities.'});
        } else {
            console.log('ENTERING ADD VOTE')
            // ACTION: ADD VOTE
            // find the corresponding user to gather all his/her information



            // clean up and remove data you don't want the frontend to receive from the user object
            var userdata = rs;
            const userpointer = Object.assign({}, userdata);

            userdata.reviews = [];
            userdata.votes = [];
            delete userdata.reviews;
            delete userdata.votes;
            delete userdata._id;
            delete userdata.password;
            delete userdata.token;
            delete userdata.verification_uuid;
            delete userdata.verified;
            delete userdata.subscription;
            delete userdata.group;
            delete userdata.country;
            delete userdata.comments;

            //create the vote object containing all of the necessary vote information
            var vote = {
                isUpvote: req.body.isUpvote,
                sensationalism: req.body.sensationalism,
                accuracy: req.body.accuracy,
                bias: req.body.bias,
                isFakeNews: req.body.isFakeNews,
                user: userdata,
                time: new Date().getTime(),
                unique: req.body.id,
                cancelVote: false,
                lastVote: false
            };


            // insert the vote
            const insertVote = yield db.doNoSqlExecute(['insert', 'votes'], [vote]);

            var user = userpointer;
            // deletes the id in order to not cause confusion when updating the user object
            delete user._id;
            delete vote.user;


            // adds the vote to the user object
            user.votes.push(vote);


            // updates the user with the new user object containing the new vote
            const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                token: req.body.token
            }, user]);

            var voteAmount;
            if(req.body.isUpvote) {
                voteAmount = 1;
            } else {
                voteAmount = -1;
            }

            var articlerows = yield db.doNoSqlExecute(['find','articles'], {
                unique: req.body.id
            });

            var article = db.convertRowsToResultSet(articlerows);

            if(article) {
                delete article._id;

                var voteCount = article.voteCount;
                voteCount = voteCount + voteAmount;
                article.voteCount = voteCount;

                const updateArticle = yield db.doNoSqlExecute(['update', 'articles'], [{
                    unique: req.body.id
                }, article]);
            }

            console.log('EXITING ADD VOTE')
            res.json({
                msg: 'Success!'
            });
        }
    });
});




<!-- REVIEW VOTING -->
router.post('/review-vote', function(req, res) {
    co(function*() {
        console.log('ENTERING /vote');

        // check user, if vote does not exist add
        // if vote of same type exists update
        // if vote of different type exists remove, add

        var rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });
        var rs   = db.convertRowsToResultSet(rows);

        var alreadySubmittedVote = false;
        var foundVoteIndex = 0;
        rs.review_votes.forEach((item, index) => {
            if(item.review_id.toString() == req.body.review_id) {
                alreadySubmittedVote = true;
                foundVoteIndex = index;
            }
        });

        var validations = false;
        if((req.body.vote < -1) || (req.body.vote > 1)) {
            validations = true;
        }

        if(alreadySubmittedVote && !validations) {
            console.log('ENTERING ALREADY SUBMITTED VOTE');

            var voteAmount = 0;
            if(rs.review_votes[foundVoteIndex].vote == -1 && req.body.vote == 1) {
                voteAmount = 2;
            } else if(rs.review_votes[foundVoteIndex].vote == -1 && req.body.vote == -1) {
                voteAmount = 0;
            }  else if(rs.review_votes[foundVoteIndex].vote == -1 && req.body.vote == 0) {
                voteAmount = 1;
            } else if(rs.review_votes[foundVoteIndex].vote == 1 && req.body.vote == -1) {
                voteAmount = -2;
            } else if(rs.review_votes[foundVoteIndex].vote == 1 && req.body.vote == 1) {
                voteAmount = 0;
            }  else if(rs.review_votes[foundVoteIndex].vote == 1 && req.body.vote == 0) {
                voteAmount = -1;
            } else if(rs.review_votes[foundVoteIndex].vote == 0 && req.body.vote == 1) {
                voteAmount = 1;
            } else if(rs.review_votes[foundVoteIndex].vote == 0 && req.body.vote == -1) {
                voteAmount = -1;
            } 

            // Update the user votes to contain the new vote state
            rs.review_votes[foundVoteIndex].vote = req.body.vote;

            // delete the id from the user to prevent update user error
            delete rs._id;

            var reviewrows = yield db.doNoSqlExecute(['find','reviews'], {
                _id: ObjectId(req.body.review_id)
            });
            var review = db.convertRowsToResultSet(reviewrows);
            delete review._id;
            var voteCount = review.voteCount;
            voteCount = voteCount + voteAmount;
            review.voteCount = voteCount;
            const updateReview = yield db.doNoSqlExecute(['update', 'reviews'], [{
                _id: ObjectId(req.body.review_id)
            }, review]);


            // update the user to reflect the state of the local user object
            const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                token: req.body.token
            }, rs]);

            console.log('EXITING ALREADY SUBMITTED VOTE')
            res.json({msg: 'Success!'});

        } else if(validations) {
            res.json({msg: 'Fuck off you asshole, we have your ip now. You will be reported to the authorities.'});
        } else {
            console.log('ENTERING ADD VOTE')
            // ACTION: ADD VOTE
            // find the corresponding user to gather all his/her information

            // clean up and remove data you don't want the frontend to receive from the user object
            var user = rs;

            console.log('0');
            console.log(req.body.review_id);

            var reviewrows = yield db.doNoSqlExecute(['find','reviews'], {'_id': ObjectId(req.body.review_id)});
            var review = db.convertRowsToResultSet(reviewrows);
            console.log('1');


            //create the vote object containing all of the necessary vote information
            var vote = {
                review_id: review._id,
                vote: req.body.vote,
                unique: req.body.id,
                time: new Date().getTime()
            };

            // deletes the id in order to not cause confusion when updating the user object
            delete user._id;


            // adds the vote to the user object
            user.review_votes.push(vote);


            // updates the user with the new user object containing the new vote
            const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                token: req.body.token
            }, user]);


            if(review) {
                delete review._id;

                var voteCount = review.voteCount;
                voteCount = voteCount + req.body.vote;
                review.voteCount = voteCount;

                const updateReview = yield db.doNoSqlExecute(['update', 'reviews'], [{'_id': ObjectId(req.body.review_id)}, review]);
            }

            console.log('EXITING ADD VOTE')
            res.json({
                msg: 'Success!'
            });
        }
    });
});








router.post('/edit-user', function(req, res) {
    co(function*() {

        const rows = yield db.doExecute(`select * from users where token = ?`,[req.body.token]);
        var user = db.convertRowsToResultSet(rows);

        if(user != null) {

            var validations = true;
            if(req.body.displayname.length > 40) {
                validations = false;
            }
            if(req.body.tagline.length > 80) {
                validations = false;
            }
            if(req.body.description.length < 3) {
                validations = false; 
            }
            if(validations) {
                yield db.doExecute(`update users set display_name = ?, tagline = ?, description = ? where token = ?`,
                [req.body.displayname, req.body.tagline, req.body.description, req.body.token]);

                res.json({
                    msg: 'Successfully edited user!'
                });
            } else {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            }
        } else {
            res.json({msg: 'Failed to edit user!'});
        }
    });
});






router.post('/change-password', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });
        var user = yield db.convertRowsToResultSet(rows);
        const result = yield utility.checkPassword(req.body.currentpassword, user.password);

        if(user != null && result) {
            var validations = true;
            if(req.body.password.length > 1200) {
                validations = false;
            }
            if(validations) {
                const hash = yield utility.hashPassword(req.body.password);
                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, {
                    password: hash
                }]);

                res.json({
                    msg: 'Successfully changed password!'
                });
            } else {
                res.json({msg: 'Fuck off you asshole, we have your ip now.'});
            }
        } else if(!result){
            res.json({msg: 'bad password'});
        } else {
            res.json({msg: 'Failed to change password!'});
        }
    });
});



router.post('/cancel-subscription', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });

        var user = yield db.convertRowsToResultSet(rows);
        if(user != null) {
            const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                token: req.body.token
            }, {
                subscription: 'free'
            }]);
            // need to add stripe stuff here to update
            res.json({
                msg: 'Successfully canceled subscription!'
            });
        }
         else {
            res.json({msg: 'Failed to cancel!'});
        }
    });
});


// settings --> change password
// settings --> make profile private, email notifications
// settings --> change subscription

router.post('/follow-user', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });
        var user = yield db.convertRowsToResultSet(rows);
        if(user != null) {
            if(user.following.includes(req.body.user_unique)) {
                res.json({msg: 'Already following!'});
            } else {
                user.following.push(req.body.user_unique);
                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, user]);
                res.json({
                    msg: 'Successfully edited user!'
                });
            }
        } else {
            res.json({msg: 'Failed to edit user!'});
        }
    });
});

router.post('/unfollow-user', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','users'], {
            token: req.body.token
        });
        var user = yield db.convertRowsToResultSet(rows);
        if(user != null) {
            if(user.following.includes(req.body.user_unique)) {
                var index = user.following.indexOf(req.body.user_unique);
                delete user.following[index];
                const updateUser = yield db.doNoSqlExecute(['update', 'users'], [{
                    token: req.body.token
                }, user]);
                res.json({msg: 'Success!'});
            } else {
                res.json({
                    msg: 'Not following the user!'
                });
            }
        } else {
            res.json({msg: 'Failed to edit user!'});
        }
    });
});





router.post('/test-security', (req, res)=> {
    res.json({status: 'protected'});
});




router.post('/getStats', (req, res)=>{
    co(function*(){
        const phqrigaldfj = req.body.phqrigaldfj || null;
        if(phqrigaldfj == constants.phqrigaldfj) {
            const users = yield db.getStats('users');
            const reviews = yield db.getStats('reviews');
            const articles = yield db.getStats('articles');
            const votes = yield db.getStats('votes');

            const userrows = yield db.doNoSqlExecute(['projection', 'users'],[{
                "email": 1,
                "verified": 1,
                "subscription": 1,
                "country": 1,
                "displayname": 1,
                "time": 1,
                "_id": 0
            }]);

            res.json({
                users: {
                    size: users.size,
                    count: users.count
                },
                reviews: {
                    size: reviews.size,
                    count: reviews.count
                },
                articles: {
                    size: articles.size,
                    count: articles.count
                },
                votes: {
                    size: votes.size,
                    count: votes.count
                },
                userrows: userrows
            });
        } else {
            res.status(404).json();
        }
    });
});







// need to add settings routes like update user and upgrade/downgrade subscription


module.exports = router;