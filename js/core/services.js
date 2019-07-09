// core services of the api which include login/signup etc...
const express      = require('express');
const router       = express.Router({});
const co           = require('co');
const constants    = require('./constants');
const rp           = require('request-promise-native');
const utility      = require('../common/utilityFunctions');
const config       = require('../common/config');
var ObjectId = require('mongodb').ObjectId;

router.use((req, res, next) => utility.setHeaders(req, res, next));



router.post('/register', function(req, res) {
    co(function*() {
        console.log('/register');

        const checkCaptcha = yield utility.makeRequest({
            url: 'https://www.google.com/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'secret': '6Letii0UAAAAAAXqlQk4mznKU_Fp-P5Y3HyuBTj4',
                'response': req.body.captcha
            }
        });

        var flag = false;
        if(checkCaptcha) {
            console.log('checkCaptcha', checkCaptcha);
            if(checkCaptcha.success == true) {
                console.log('success');
                flag = true;
            }
            console.log('checkCaptcha.success', checkCaptcha.success);
            console.log('checkCaptcha.success == true', checkCaptcha.success == 'true')
        }

        if(flag) {
            const sql = 'select * from users where email = ?';
            let users  = yield db.doExecute(sql,[req.body.email]);


            if (users && users.length && users.length > 0) {
                utility.sendResponseToClient(res, {
                    msg: "User already exists!"
                });
            } else {

                const sql = 'select * from users where display_name = ?';
                let uniquerow  = yield db.doExecute(sql,[req.body.displayname]);


                var foundunique = true;
                var hash = 1;
                var unique = req.body.displayname;
                if (uniquerow.length > 0) {
                    console.log('found unique');
                    while (foundunique) {
                        var uniquedisplayname;
                        if(hash == 1) {
                            uniquedisplayname = req.body.displayname.replace(/[^a-zA-Z ]/g, "").split(' ').join('-').toLowerCase();
                        } else {
                            uniquedisplayname = req.body.displayname.replace(/[^a-zA-Z ]/g, "").split(' ').join('-').toLowerCase() + '-' + hash;
                        }

                        var findusr = 'select * from users where user_unique = ?';
                        let findUserResult  = yield db.doExecute(findusr,[uniquedisplayname]);

                        if (findUserResult.length == 0) {
                            unique = uniquedisplayname;
                            foundunique = false;
                        }
                        hash++;
                    }
                } else {
                    console.log('did not find unique');
                    unique = req.body.displayname.replace(/[^a-zA-Z ]/g, "").split(' ').join('-').toLowerCase();
                }




                const passhash = yield utility.hashPassword(req.body.password);
                const verification_token = utility.generateToken();
                const forgot_password_token = utility.generateToken();
                const body = '<b>Welcome! Please click the following to verify your email: <a href=\"' + config.APP_URL + '/verify-email/' + verification_token + '\">Verify Email</a></b>';
                var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

                const insertUserSQL = 'insert into users (email, password, user_unique, display_name, time,ip, verification_token) ' +
                    'values (?,?,?,?,?,?,?);';
                const insertUser  = yield db.doExecute(insertUserSQL,
                    [req.body.email,
                     passhash,
                     unique,
                     req.body.displayname,
                     new Date().getTime(),
                     ip,
                     verification_token]);

                utility.sendEmail('Please verify your email!', body, req.body.email);
                utility.sendResponseToClient(res, {
                    msg: 'Success!'
                });
            }
        } else {
            res.json({
                msg: 'bad captcha'
            });
        }
        console.log('END --  /register');
    });
});

router.post('/verify-email', function(req, res) {
    co(function*() {

        const findusr = 'select * from users where verification_token = ?';
        let findUserResult  = yield db.doExecute(findusr,[req.body.token]);

        if(findUserResult[0]) {
            const updateusr = 'update users set verified = 1 where verification_token = ?';
            let updateUser = yield db.doExecute(updateusr,[req.body.token]);

            utility.sendResponseToClient(res,{
                verified: true,
                msg: "Success!"
            });
        } else {
            utility.sendResponseToClient(res,{
                verified: false,
                msg: "Failed!"
            });
        }
    });
});


router.post('/forgot-password', function (req, res) {
    co(function* () {
        const forgot_password_token = utility.generateToken();

        const updateSql = 'update users set forgot_password_token = ? where email = ?';
        let updateForgotPasswordToken = yield db.doExecute(updateSql, [forgot_password_token, req.body.email]);

        const body = '<b>Please click the following to reset your password: <a href=\"' + config.APP_URL + '/reset-password/' + forgot_password_token + '\">Reset Password</a></b>';
        utility.sendEmail('Password Reset', body, req.body.email);
        utility.sendResponseToClient(res, {
            msg: "Success!"
        });
    });
});

router.post('/set-password', function (req, res) {
    co(function* () {
        const findUsr = 'select email from users where forgot_password_token = ?';
        let users = yield db.doExecute(findUsr, [req.body.forgot_password_token]);
        let user = db.convertRowsToResultSet(users);

        console.log('user--------', users);

        if (user) {
            const hash = yield utility.hashPassword(req.body.password);
            const updateUsr = 'update users set password = ?, forgot_password_token = ? where forgot_password_token = ?';
            let updateusr = yield db.doExecute(updateUsr, [hash, null, req.body.forgot_password_token]);

            const body = "<b>Your password has been successfully changed! If this wasn't you, please contact support.</b>";
            utility.sendEmail('Password Changed!', body, user.email);
            utility.sendResponseToClient(res, {
                confirmed: true,
                msg: "Success!"
            });
        } else {
            utility.sendResponseToClient(res, {
                confirmed: false,
                msg: "Failed!"
            });
        }

    });
});

router.post('/login', function (req, res) {
    co(function* () {
        const findUsr = 'select * from users where email = ?';
        let rows = yield db.doExecute(findUsr, [req.body.email]);

        const rs = db.convertRowsToResultSet(rows);
        const result = yield utility.checkPassword(req.body.password, rs.password);

        if (result && rs.verified == 1) {
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

            const token = utility.generateToken();

            const updateUsrSql = 'update users set token = ?, ip = ? where email = ?';
            let updateUsr = yield db.doExecute(updateUsrSql, [token, ip, req.body.email]);

            utility.sendResponseToClient(res, {
                login: result,
                token: token,
                msg: "Success!"
            });
        } else {
            utility.sendResponseToClient(res, {
                login: result,
                token: null,
                msg: "Password is incorrect or please make sure you've verified your email!"
            });
        }
    });
});

router.post('/get-user', function (req, res) {
    co(function* () {

        let findUsr = 'select display_name, description, tagline, profile_picture, views, followers, upvotes from users where user_unique = ?';
        const rows = yield db.doExecute(findUsr, [req.body.user_unique]);

        let findReviews = 'select * from reviews where user_unique = ?';
        const reviews = yield db.doExecute(findReviews, [req.body.user_unique]);

        let rs = db.convertRowsToResultSet(rows);
        rs.reviews = null;
        rs.reviews = reviews;


        if (rs) {
            utility.sendResponseToClient(res, {
                login: true,
                msg: "Success!",
                data: rs
            });
        } else {
            utility.sendResponseToClient(res, {
                login: false,
                msg: "Token is invalid!",
                data: null
            });
        }
    });
});


router.post('/authenticate', function (req, res) {
    co(function* () {
        let findUsr = 'select * from users where token = ?';
        let rows = yield db.doExecute(findUsr, [req.body.token]);
        let rs = db.convertRowsToResultSet(rows);

        if (rs) {
            utility.sendResponseToClient(res, {
                login: true,
                msg: "Success!",
                data: rs
            });
        } else {
            utility.sendResponseToClient(res, {
                login: false,
                msg: "Failed!",
                data: null
            });
        }
    });
});


router.post('/forgot-password', function (req, res) {
    co(function* () {
        const findUsr = 'select email from users where email = ?';
        let users = yield db.doExecute(findUsr, [req.body.email]);

        if (users.length == 0) {
            utility.sendResponseToClient(res, {
                msg: 'No user found with this email!'
            });
        } else {
            const token = utility.generateToken();
            const body = '<b>Please click the following to reset your password: <a href=\"' + config.APP_URL + '/forgot-password/' + token + '\">Verify Email</a></b>';

            const updateUsr = 'update users set forgot_password_token = ? where email = ?';
            let updateusr = yield db.doExecute(updateUsr, [token, req.body.email]);

            utility.sendEmail('You requested to reset your password!', body, req.body.email);
            utility.sendResponseToClient(res, {
                msg: 'Password reset sent!'
            });
        }
    });
});

router.post('/confirm-password', function (req, res) {
    co(function* () {
        const findUsr = 'select email from users where forgot_password_token = ?';
        let users = yield db.doExecute(findUsr, [req.body.token]);
        let user = db.convertRowsToResultSet(users);

        if (user) {

            const hash = yield utility.hashPassword(req.body.password);
            const updateUsr = 'update users set password = ?, forgot_password_token = ? where forgot_password_token = ?';
            let updateusr = yield db.doExecute(updateUsr, [hash, null, req.body.token]);

            const body = '<b>Your password has been successfully changed! If this wasnt you, please contact support.</b>';
            utility.sendEmail('Password Changed!', body, user.email);
            utility.sendResponseToClient(res, {
                confirmed: true,
                msg: "Success!"
            });
        } else {
            utility.sendResponseToClient(res, {
                confirmed: false,
                msg: "Failed!"
            });
        }
    });
});

router.get('/get-stats', (req, res) => { co(function*() {
    const stats = yield db.doExecute(`select count(*) as rows from articles where status = 'fake' UNION select TABLE_ROWS as rows from information_schema.TABLES where table_name = 'articles' UNION select TABLE_ROWS as rows from information_schema.TABLES where table_name = 'reports' UNION select TABLE_ROWS as rows from information_schema.TABLES where table_name = 'violations'`, []);
    res.json(stats);
})});


router.post('/get-article', function(req,res) {
    const token = req.body.token || null;
    co(function*() {


        // get the most endorsed article facts 
        const getArticleFacts = "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1) UNION" +
        "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1) UNION " +
        "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1) UNION " +
        "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1) UNION " +
        "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1) UNION " +
        "(select * from article_facts where type = ? and article_id in (select id from articles where article_unique = ?) order by count desc, votes desc limit 1)";
        
        let articleFactRows = yield db.doExecute(getArticleFacts, [
            'title', req.body.id,
            'url', req.body.id,
            'source', req.body.id,
            'source_url', req.body.id,
            'author', req.body.id,
            'author_twitter', req.body.id
        ]);
        let articleFacts = db.convertRowsToResultSet(articleFactRows);

        let articleRows = yield db.doExecute('select * from articles where article_unique = ?', [req.body.id]);
        let article = db.convertRowsToResultSet(articleRows);
        article.articleFacts = articleFacts;

        
        // set the most endorsed article facts as the official article
        article.title = articleFacts[0].value;
        article.url = articleFacts[1].value;
        article.source = articleFacts[2].value;
        article.source_url = articleFacts[3].value;
        article.author = articleFacts[4].value;
        article.author_twitter = articleFacts[5].value;

        // below sql finds the common reports
        // select * from violations where id in (select DISTINCT relates_to from violation_relations where article_id in (select id from articles where article_unique = 'trump-needles-new-presidential-candidate-warren-on-native-american-claims'));
        
        // left join user votes if token exists
        let user = null;
        if(token) {
            let userRows = yield db.doExecute(`select * from users where token = ?`, [token]);
            user = db.convertRowsToResultSet(userRows)
        }

        let reports;
        if(user) {
            console.log(user.id);
            reports = yield db.doExecute(`select users.profile_picture, users.tagline, users.display_name, reports.id, reports.time, reports.user_unique, violations.type, violations.id as violationid, violations.sentence, violations.reason, violation_verifications.vote from reports left join violations on violations.report_id = reports.id left join users on users.id = reports.user_id left join violation_verifications on violations.id = violation_verifications.violation_id where violation_verifications.user_id = ? and reports.article_unique = ? or reports.article_unique = ?`, 
            [user.id, req.body.id, req.body.id]);
        } else {
            reports = yield db.doExecute('select users.profile_picture, users.tagline, users.display_name, reports.id, reports.time, reports.user_unique, violations.type, violations.id as violationid, violations.sentence, violations.reason from reports left join violations on violations.report_id = reports.id left join users on users.id = reports.user_id where reports.article_unique = ?', [req.body.id]);
        }
        

        let reportsIndex = [];
        let finalizedReports = []; 

        reports.forEach(report => {
            let user_vote = report.vote ? report.vote: null;
 
            if(!reportsIndex.includes(report.id)) {
                reportsIndex.push(report.id);
                report.violations = [{type: report.type, sentence: report.sentence, reason: report.reason, index: 1, id: report.violationid, vote: user_vote}];
                delete report.type;
                delete report.sentence;
                finalizedReports.push(report);
            } else {
                finalizedReports[reportsIndex.indexOf(report.id)].violations.push({
                    type: report.type, 
                    sentence: report.sentence,
                    reason: report.reason,
                    index: finalizedReports[reportsIndex.indexOf(report.id)].violations.length + 1,
                    id: report.violationid,
                    vote: user_vote
                }); 
            }
        });

        let display_names = [];
        let finalized_reports = [];
        reports.forEach(report => {
            if(!display_names.includes(report.display_name)) {
                finalized_reports.push(report);
                display_names.push(report.display_name);
            }
        });
        
        article.reports = finalized_reports;

        let sentences = yield db.doExecute(`select * from violations where id in (select DISTINCT relates_to from violation_relations where article_id in (select id from articles where article_unique = ?))`, [req.body.id]);
        article.sentences = sentences;
        res.json(article);
    });
});

router.get('/reports', function(req,res) {
    co(function*() {
        let {all, politics, world, science, business, sports, entertainment} = req.query;
        all = (all == 'true');
        politics = (politics == 'true');
        world = (world == 'true');
        science = (science == 'true');
        business = (business == 'true');
        sports = (sports == 'true');
        entertainment = (entertainment == 'true');

        let query;
        if(all) {
            query = `select * from articles order by time desc limit 150`
        } else {

            let querystring = `(`;
            let criteria = [];
            if(politics) { criteria.push(`'politics'`) } 
            if(world) { criteria.push(`'world'`) }
            if(science) { criteria.push(`'science'`) }
            if(business) { criteria.push(`'business'`) }
            if(sports) { criteria.push(`'sports'`) }
            if(entertainment) { criteria.push(`'entertainment'`) }

            criteria.forEach((critera, index) => {
                querystring += criteria
                if(index == criteria.length - 1) {
                    querystring += ')'
                } else {
                    querystring += ','
                }
            });

            query = `select * from articles where category in ` + querystring + ` order by time desc limit 150`;
        }

        let rows = yield db.doExecute(query, []);        
        res.json(rows);
    });
});

router.get('/health', (req, res)=> {
    res.json({status: 'running'});
});

router.post('/test', (req, res)=> {
    const sentences = [
        {type: "Misleading Information", sentence: `demographers and researchers typically use the early 1980s`},
        {type: "Bias", sentence: `. Although millennial characteristics vary by region, depending on social and economic conditions, the `},
        {type: "Bias", sentence: `Baldwin is asking if Trump's tweet "constitutes a threat" to his family's safety.`},
        {type: "Bias", sentence: `In the past, Trump has also suggested that NBC station licenses should be challenged, without any evident follow-up.`},
    ];
    res.json(sentences); 
});

module.exports = router;