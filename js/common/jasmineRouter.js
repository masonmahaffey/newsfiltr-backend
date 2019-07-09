//tests.js
const express = require('express');
const testrt = express.Router();
const executeJasmine = require('../../../tests/jasmineRunner');
const fs = require('fs');
const xml2js = require('xml2js');

// middleware that is specific to this router
testrt.use(function timeLog (req, res, next) {
	next();
});

testrt.get('/jasmine', function (req, res) {
    // execute all specs
    executeJasmine.then((passed) => {
        // code that gets executed only AFTER jasmine finishes execution
        if (passed) {
            console.log('All specs have passed');
            // parse test result from results XML file into JSON and return to user via HTTP
            let parser = new xml2js.Parser({explicitArray: false, mergeAttrs: true});
            fs.readFile(__dirname + '/junitresults.xml', function (err, data) {
                if (err) {
                    res.send("Failed to read test results XML");
                } else {
                    parser.parseString(data, function (err, result) {
                        if (err) {
                            res.send("Failed to parse test results XML")
                        } else {
                            console.log(JSON.stringify(result));
                            res.json(result);
                        }
                    });
                }
            });
        } else {
            res.send('At least one spec has failed');
        }
    }, (reason) => {
        res.send('At least one spec has failed: ' + reason);
    }).catch((reason) => {
        res.send('Jasmine failed: ' + reason);
    });
});

module.exports = testrt;
