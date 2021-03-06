/*
	These are config variables for all of the utility functions
 */
module.exports = {
    EMAIL_SERVICE   : process.env.EMAIL_SERVICE           || 'gmail',
    EMAIL_USER      : process.env.EMAIL_USER              || 'your_email',
    EMAIL_PASSWORD  : process.env.EMAIL_PASSWORD          || 'your_password',
    APP_NAME        : process.env.APP_NAME                || 'newsfiltr.com',
    APP_URL         : process.env.APP_NAME                || 'http://localhost:4200',
    SUPPORT_EMAIL   : process.env.SUPPORT_EMAIL           || 'mason@newsfiltr.com'
};
