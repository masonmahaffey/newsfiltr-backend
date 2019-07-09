const cluster         = require('cluster');
const express         = require('express');
var bodyParser        = require('body-parser');
const app             = express();
const port            = process.env.PORT || 3001;
const util            = require('./common/utilityFunctions');

global.db             = require('./database/database');
// global.redis          = require('./database/redis'); // <--- only if using redis with project

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

if(!process.env.ACTIVE_DEVELOPMENT) {
    if(cluster.isMaster) {
        const numWorkers = 2;

        console.log(`Master ${process.pid} setting up ${numWorkers} workers...`);

        for(let i = 0; i < numWorkers; i++) {
            cluster.fork();
        }

        cluster.on('online', function(worker) {
            console.log('Worker ' + worker.process.pid + ' is online');
        });

        cluster.on('exit', function(worker, code, signal) {
            console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            console.log('Starting a new worker');
            cluster.fork();
        });
    } else {
        app.listen(port, function(){
            console.log('Process ' + process.pid + ' is listening to all incoming requests on port: ' + port);
        });
    }
} else {
    app.listen(port, function(){
        console.log('Process ' + process.pid + ' is listening to all incoming requests on port: ' + port);
    });
}

//load unprotected routes
const core = require('./core/services');
app.use('/api', core);


//load protected routes
const protected = require('./core/protected-services');
app.use('/api-pr', protected);

// util.getTopHeadlines();
// setInterval(()=> {
//     util.getTopHeadlines();
// }, 30000);























