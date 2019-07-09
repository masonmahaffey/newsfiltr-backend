const mysqldb = require('mysql');
const dbconfig = require('./config.js');
const MongoClient = require('mongodb').MongoClient;
const co = require('co');
const fs = require('fs');

/**
 * Creates a db connection pool
 **/
const dbpool = mysqldb.createPool({
    connectionLimit: 10,
    host: dbconfig.host,
    user: dbconfig.user,
    password: dbconfig.password,
    database: dbconfig.database,
    ssl      : {
        ca   : fs.readFileSync('ssl/server-ca.pem'), // should be enough for AWS
        key  : fs.readFileSync('ssl/client-key.pem'), // required for google mysql cloud db
        cert : fs.readFileSync('ssl/client-cert.pem'), // required for google mysql cloud db
    }
});
const maxrows = 10000;

// get a connection to a mongoDB database
function* noSqlGetConnection() {
    console.log("Getting mongo connection...");
    return new Promise(function(resolve){
        MongoClient.connect(dbconfig.mongoUrl, { useNewUrlParser: true }, function (err, client) {
            if(err) {
                console.log("ERROR: Cannot get a mongodb connection: ", err);
                resolve(err);
            } else {
                resolve({client: client, db: client.db('upvoterr')});
            }
        });
    });
}

// provided a connection, connect to MongoDB and run a query
function* doNoSqlExecute(executeType, executeData) {
    return new Promise(function(resolve){
        co(function*(){
            const conn = yield noSqlGetConnection();
            if(executeType[0] == 'insert') {
                console.log('2')
                conn.db.collection(executeType[1]).insertMany(executeData, function (err, res) {
                    if(err) throw err;
                    console.log("inserted 3 documents into a collection");
                    closeNoSqlConnection(conn);
                    resolve(res.ops);
                });
            } else if(executeType[0] == 'find') {
                conn.db.collection(executeType[1]).find(executeData).toArray(function (err, res) {
                    if(err) throw err;
                    console.log("found documents in a collection");
                    closeNoSqlConnection(conn);
                    console.log('nope', res);
                    resolve(res);
                });
            } else if (executeType[0] == 'update') {
                conn.db.collection(executeType[1]).updateOne(executeData[0], { $set: executeData[1] }, function(err, res) {
                    if(err) throw err;
                    closeNoSqlConnection(conn);
                    console.log("updated documents in a collection");
                    resolve(res);
                });
            } else if(executeType[0] == 'delete') {
                conn.db.collection(executeType[1]).deleteOne(executeData[0], function(err, res) {
                    if(err) throw err;
                    closeNoSqlConnection(conn);
                    console.log("updated documents in a collection");
                    resolve(res);
                });
            } else if(executeType[0] == 'projection') {
                conn.db.collection(executeType[1]).find({}).project(executeData[0]).toArray(function (err, res) {
                    if(err) throw err;
                    closeNoSqlConnection(conn);
                    resolve(res);
                });

            }
        });
    });
}


module.exports.getStats = function* getStats(collection) {
    return new Promise(function(resolve){
        co(function*(){
            const conn = yield noSqlGetConnection();
            resolve(conn.db.collection(collection).stats({
                scale: 1024
            }));
        });
    });
}

function closeNoSqlConnection(conn) {
    conn.client.close();
}

/**
 * Returns a db connection
 **/
module.exports.getConnection = function* getConnection() {
    console.log("Getting mysql connection...");
    return new Promise(function (resolve, reject) {
        dbpool.getConnection(function (err, connection) {
            // UNABLE TO GET CONNECTION - CALLBACK WITH ERROR
            if (err) {
                console.log("ERROR: Cannot get a connection: ", err);
                resolve(err);
            } else {
                resolve(connection);
            }
        });
    });
}


/**
 * Calls the database and returns the results
 **/
module.exports.doExecute = function* doExecute(sql,values) {
    console.log("Preforming mysql execute...");
    return new Promise(function (resolve, reject) {
        co(function*(){
            var connection = yield db.getConnection();
            connection.query({sql: sql, values: values || []}, function (err, result, fields) {
                if (err) {
                    // Something went wrong - handle the data and release the connection
                    console.log("ERROR: Unable to execute the SQL: ", err);
                    doRelease(connection);
                    resolve(err);
                } else {
                    // Success, release connection and format rows
                    doRelease(connection);
                    resolve(result);
                }
            });
        })
    });
}

module.exports.doCommit = function* doCommit(connection) {
    return new Promise(function (resolve, reject) {
        connection.commit(function (err) {
            if (err) {
                console.log("ERROR: Unable to COMMIT transaction: ", err);
            }
            doRelease(connection);
            resolve(null);
        });
    });
}

module.exports.doRollback = function* doRollback(connection) {
    return new Promise(function (resolve, reject) {
        connection.rollback(function (err) {
            if (err) {
                console.log("ERROR: Unable to ROLLBACK transaction: ", err);
            }
            doRelease(connection);
            resolve(null);
        });
    });
}

/**
 * close the connection from the database
 **/
function doRelease(connection) {
    console.log("Closing mysql connection...");
    return new Promise(function (resolve, reject) {
        connection.release(function (err) {
            if (err) {
                console.log("ERROR: Unable to RELEASE the connection: ", err);
            }
            resolve(null);
        });
    });

}

function formatRows(rows) {
    if(rows) {
        if(rows.length == 1) {
            return rows[0];
        } else if(rows.length > 1) {
            return rows;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function convertRowsToResultSet(rows) {
    if(rows && rows.length) {
        if(rows.length == 1) {
            return rows[0];
        } else if(rows.length > 1) {
            return rows;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function doClose(connection, resultSet) {
    console.log("Closing the ibmdb resultSet...");
    resultSet.close(function (err) {
        if (err) {
            console.error(err.message);
        }
        doRelease(connection);
    });
}

module.exports.doRelease = doRelease;
module.exports.formatRows = formatRows;
module.exports.doClose = doClose;
module.exports.convertRowsToResultSet = convertRowsToResultSet;
module.exports.noSqlGetConnection = noSqlGetConnection;
module.exports.doNoSqlExecute = doNoSqlExecute;
module.exports.closeNoSqlConnection = closeNoSqlConnection;
