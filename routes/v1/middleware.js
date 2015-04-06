'use strict';
/* globals module, require */

var passport = require.main.require('passport'),
	user = require.main.require('./src/user'),
	topics = require.main.require('./src/topics'),
	errorHandler = require('../../lib/errorHandler'),

	Middleware = {};

Middleware.requireUser = function(req, res, next) {
	passport.authenticate('bearer', { session: false }, function(err, user) {
		if (err) { return next(err); }
		if (!user) { return errorHandler.respond(401, res); }

		// If the token received was a master token, a _uid must also be present for all calls
		if (user.hasOwnProperty('uid')) {
			req.login(user, function(err) {
				if (err) { return errorHandler.respond(500, res); }

				req.uid = user.uid;
				next();
			});
		} else if (user.hasOwnProperty('master') && user.master === true) {
			if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
				user.uid = req.body._uid || req.query._uid;
				delete user.master;

				req.login(user, function(err) {
					if (err) { return errorHandler.respond(500, res); }

					req.uid = user.uid;
					next();
				});
			} else {
				res.status(400).json(errorHandler.generate(
					400, 'params-missing',
					'Required parameters were missing from this API call, please see the "params" property',
					['_uid']
				));
			}
		} else {
			return errorHandler.respond(500, res);
		}
	})(req, res, next);
};

Middleware.requireAdmin = function(req, res, next) {
	if (!req.user) {
		return errorHandler.respond(401, res);
	}

	user.isAdministrator(req.user.uid, function(err, isAdmin) {
		if (err || !isAdmin) {
			return errorHandler.respond(401, res);
		}

		next();
	});
};

Middleware.exposeUid = function(req, res, next) {
	// This middleware differs from the one found in core as it sends back a 404 if the passed in userslug does not exist.
	// Core sometimes does different things if a user isn't found, but in the write-api, we can broadly send a 404.
	if (req.params.hasOwnProperty('userslug')) {
		user.getUidByUserslug(req.params.userslug, function(err, uid) {
			if (err) {
				return errorHandler.respond(500, res);
			} else if (uid === null) {
				// If exposed uid is null, then that *specifically* means that the passed in userslug is garbage
				return errorHandler.respond(404, res);
			}

			res.locals.uid = uid;
			next();
		})
	} else {
		next();
	}
};

Middleware.validateTid = function(req, res, next) {
	if (req.params.hasOwnProperty('tid')) {
		topics.exists(req.params.tid, function(err, exists) {
			if (err) {
				errorHandler.respond(500, res);
			} else if (!exists) {
				errorHandler.respond(404, res);
			} else {
				next();
			}
		});
	} else {
		errorHandler.respond(404, res);
	}
};

module.exports = Middleware;