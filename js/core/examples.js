// core services of the api which include login/signup etc...
const express = require('express');
const router = express.Router({});
const co = require('co');
const constants = require('./constants');
var rp = require('request-promise');
const service = require('../common/utilityFunctions');

router.use((req, res, next) => service.setHeaders(req, res, next));


router.get('/mongoInsertExample', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['insert','notes'], [
            {user: 'joebloe1'}, {user: 'joebloe2', note: 'this is a note'}, {user: 'joebloe3'}
        ]);

        const size = (rows != null) ? rows.length:0;
        if(size === 0) {
            res.json({
                total: size,
                data: []
            });
        } else {
            res.json({
                total: size,
                data: rows
            });
        }
    });
});

router.get('/mongoFindExample', function(req, res) {
    co(function*() {
        const rows = yield db.doNoSqlExecute(['find','notes'], {
            "user": "joebloe2"
        });

        const size = (rows != null) ? rows.length : 0;
        if(size === 0) {
            res.json({
                total: size,
                data: []
            });
        } else {
            res.json({
                total: size,
                data: rows
            });
        }
    });
});

router.get('/mysqlExample', function(req, res) {
    co(function* () {
        const sql = 'select * from notes limit ?';
        var rows  = yield db.doExecute(sql,[10]);

        const size = (rows != null) ? rows.length : 0;
        if(size === 0) {
            res.json({
                query: sql,
                total: size,
                data: []
            });
        } else {
            res.json({
                query: sql,
                total: size,
                data: rows
            });
        }

    });
});

router.get('/requestExample', (req, res)=> {
    co(function* () {

        // get request with query string i.e. http://website.com/v2/sources?apiKey=37590347509
        const getResponse = yield rp({ uri: 'https://newsapi.org/v2/sources',
            qs: { apiKey: '275258a3655c449ba4907833f5baf08b'}, json: true
        });



        // post request with body payload
        // const postResponse = yield rp({ method: 'POST', uri: 'https://newsapi.org/v2/sources',
        //     body: { some: 'payload'}, json: true
        // });

        const size = (getResponse != null) ? getResponse.sources.length : 0;
        if(size === 0) {
            res.json({
                total: size,
                data: []
            });
        } else {
            res.json({
                total: size,
                data: getResponse
            });
        }

    });
});



module.exports = router;