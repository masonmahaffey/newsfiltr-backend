const co                = require('co');
const bcrypt            = require('bcrypt-nodejs');
const uuidv1            = require('uuid/v1');
const nodemailer        = require('nodemailer');
const config            = require('./config');
const request           = require('request');
const transporter = nodemailer.createTransport({
    service: config.EMAIL_SERVICE,
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD
    }
});

function setHeaders (req, res, next) {
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");



    if(process.env.ACTIVE_DEVELOPMENT) {
        res.header('Access-Control-Allow-Origin', '*');
        return next();
    } else {
        let allowedOrigins = ['https://ordermanagementui-qa.apps-np.homedepot.com', 'https://ordermanagementui-ad.apps-np.homedepot.com'
            , 'https://ordermanagementui.apps.homedepot.com', 'https://ordermanagementui.apps-za.homedepot.com', 'https://ordermanagementui.apps-zb.homedepot.com', 'http://localhost:6001'];
        let origin = req.headers.origin;
        if(allowedOrigins.indexOf(origin) > -1){
            res.header('Access-Control-Allow-Origin', origin);
            return next();
        }
        console.log('BAD ORIGIN: ' + origin);
        res.status(400);
        res.send('Bad Origin.');
    }
}


function handlePreflight(req,res,next) {
    if ('OPTIONS' == req.method) {
        res.status(204).send('preflight');
    }
    else {
        return next();
    }
}

function* hashPassword(password, saltRounds = 10) {
    console.log('hashing password')
    return new Promise(function(resolve) {
        try {
            var salt = bcrypt.genSaltSync(saltRounds);
            var hash = bcrypt.hashSync(password, salt);
            console.log('hashed password');
            resolve(hash);
        } catch(exc) {
            console.log(exc);
            resolve(null);
        }

    });
}


function* checkPassword(password,hash) {
    return new Promise(function(resolve) {
        var result = bcrypt.compareSync(password, hash);
        resolve(result);
    });
}

function generateToken(password,hash) {
    return uuidv1();
}

function sendResponseToClient(res, rows){
    console.log('generating response to send to the client');
    const size = (rows != null) ? rows.length:0;
    if(size === 0) {
        res.json([]);
    } else {
        res.json(rows);
    }
}


function sendEmail(subject, body, email){
    const mailOptions = {
        from: config.APP_NAME + ' <' + config.SUPPORT_EMAIL + '>', // sender address
        to: email,
        subject: subject,
        html: body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('sent email');
    });
}

function* makeRequest(payload) {
    return new Promise(function(resolve) {
        request(payload,
            function (error, response, body) {
                console.log('body', body);
                console.log('body.success', body.success);
                console.log(typeof body);
                body = JSON.parse(body);
                resolve(body);
            });
    });
}



function checkToken(req,res, next) {
    co(function* () {
        if(req.body.token) {
            let findUsr = 'select * from users where token = ?';
            let rows = yield db.doExecute(findUsr, [req.body.token]);
            let rs = db.convertRowsToResultSet(rows);
            req.user = rs;

            if (rs) {
                return next();
            } else {
                console.log('Your token has timed out');
                res.status(312).json('Your token has timed out.');
            }
        } else {
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

            // const attempts = yield db.doNoSqlExecute(['find', 'attempts'], {
            //     ip: ip
            // });

            // if(attempts.length == 0) {
            //     const time = new Date().getTime();
            //     const insertAttempt = yield db.doNoSqlExecute(['insert','attempts'], [{
            //         ip: ip,
            //         time: time,
            //         count: 0
            //     }]);
            // } else {
            //     const newCount = attempts[0].count + 1;
            //     const updateAttempts = yield db.doNoSqlExecute(['update', 'attempts'], [{
            //         ip: ip,
            //     },{
            //         count: newCount
            //     }]);
            // }
            res.status(404).json('Your ip has been logged. Fuck off.');
        }
    });
}


function getTopHeadlines() {
    console.log('this ran 01')

    co(function*() {
        const articleuniques = yield db.doNoSqlExecute(['projection', 'articles'],[{
            "unique": 1,
            "_id": 0
        }]);

        console.log('articleuniques', articleuniques);

        for(var i in articleuniques) {
            let unique = articleuniques[i].unique;
            const votes = yield db.doNoSqlExecute(['find', 'votes'], {
                unique: unique
            });

            var sensationalism = 0;
            var bias = 0;
            var accuracy = 0;

            if(votes.length != 0) {
                console.log('this ran 030=======================================================')
                votes.forEach(vote => {
                    console.log('sensationalism ============', vote.sensationalism);
                    sensationalism += vote.sensationalism;
                    bias += vote.bias;
                    accuracy += vote.accuracy;
                });

                sensationalism /= votes.length;
                bias /= votes.length;
                accuracy /= votes.length;

                sensationalism += sensationalism;
                bias += bias;
                accuracy += accuracy;

                sensationalism = 10 - sensationalism;
                bias = 10 - bias;
                accuracy = 10 - accuracy;

                const updateAttempts = yield db.doNoSqlExecute(['update', 'articles'], [{
                    unique: unique,
                },{
                    sensationalism: sensationalism,
                    bias: bias,
                    accuracy: accuracy
                }]);
            }



        }
    });
}

function buildViolationsInsertSQL(violations, report_id, article_id) {

    let sql = 'insert into violations (report_id, article_id, type, sentence, reason, time) values ';
    let inserts = [];
    violations.forEach((violation, index) => {
        inserts.push(report_id);
        inserts.push(article_id);
        inserts.push(violation.type);
        inserts.push(violation.sentence);
        inserts.push(violation.reason);
        inserts.push(new Date().getTime());

        if(index == violations.length - 1) {
            sql += '(?,?,?,?,?,?)'
        } else {
            sql += '(?,?,?,?,?,?),'
        }
        console.log('index!', typeof index);
    });

    return {insertViolationsSQL: sql, violationInserts: inserts};
}


module.exports = {
    setHeaders: setHeaders,
    hashPassword: hashPassword,
    checkPassword: checkPassword,
    generateToken: generateToken,
    sendResponseToClient: sendResponseToClient,
    sendEmail: sendEmail,
    checkToken: checkToken,
    handlePreflight: handlePreflight,
    makeRequest: makeRequest,
    getTopHeadlines: getTopHeadlines,
    buildViolationsInsertSQL: buildViolationsInsertSQL
};