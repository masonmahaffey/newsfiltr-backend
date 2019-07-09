/*
	These are all of the connection details for MySQL and for MongoDB
	to be accessed by the database initializer and config for setting
	up connections.
 */
module.exports = {
  	host           : process.env.SQL_HOST                || '35.231.37.76',
  	user           : process.env.SQL_USER                || 'default_usr',
  	password       : process.env.SQL_PASSWORD            || 'default_password_with_no_permissions',
  	database       : process.env.SQL_DATABASE            || 'newsfiltr'
};
