const cluster = require('cluster');
const redis = require('redis');
const vendor = require('../startup.api.homedepot.com/vendor');

const client = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);

client.auth(process.env.REDIS_PASSWORD, () => {
    console.log(`Redis password is valid.`);
    if(cluster.isMaster) {
        console.log(`Master ${process.pid} is adding vendors to Redis Cache...`);
        vendor.addAllVendorsToRedis();
    }
});

client.on('connect', () => console.log('Redis client connected'));

client.on('error', (err) => console.log('Redis client error: ' + err));

function set(key, value) {
    client.set(key, value, (error, result) => {
        if (error) {
            console.log('Could not SET key: ' + key + ' with value: ' + value);
            console.log(error);
            throw error;
        }
        console.log('SET result -> ' + result);
    })
}

function * get(key) {
    return new Promise(function (resolve, reject) {
        client.get(key, function (error, result) {
            if (error) {
                console.log('Could not GET key: ' + key);
                console.log(error);
                reject(error);
            }
            console.log('GET result -> ' + result);
            resolve(result);
        });
    });

}

module.exports = {set, get};