/*
tools
*/

'use strict'

const 
crypto = require('crypto')
,local = require('../app/local')
,setting = require('../app/setting')
,stylus = require('stylus')
,jade = require('jade')
,_ = require('lodash')
,path = require('path')
,fs = require('fs')

exports.loadTheme404500 = function() {

	let themeViewPath = setting.theme.path?
										setting.theme.path + '/views/'
										:
										process.cwd() + '/node_modules/' + setting.theme + '/views/'

	//404	
	try {
		let p404 = themeViewPath + '404.jade'
		let res = fs.accessSync(p404)
		setting.path404 = p404
		
	} catch(e) {
		exports.debug('theme no 404.jade')
		setting.path404 = path.resolve(__dirname, '../views/page/404.jade')
	}

	//500	
	try {
		let p500 = themeViewPath + '500.jade'
		let res = fs.accessSync(p500)
		setting.path500 = p500
		
	} catch(e) {
		exports.debug('theme no 500.jade')
		setting.path500 = path.resolve(__dirname, '../views/page/500.jade')
	}


}

exports.buildThemeRes = function(host) {
	return host + '/' + (setting.theme.staticAlias || setting.theme.name || setting.theme)
}

exports.readOnlyProxy = function(target, filename) {
	return new Proxy(target, {
		set(target, key, value) {
			throw new Error('plugin try to modify ' + filename)
			return false
		}
	})
}

exports.extendLib = function(filename, mod, plugins) {
	
	let arr1 = filename.split(path.sep)
	let len1 = arr1.length
	let fid = arr1[len1 - 2] + '/' + arr1[len1 - 1]

	let toolsExports = [
		'buildThemeRes', 'replace', 'createUrl', 'parseStylus',
		'parseJade', 'debugLog', 'debug', 'warn',
		'err', 'log', 'createQueryObj'
	]

	Object.assign(mod.publicExports, {
		tools: _.pick(exports, toolsExports)
		,local: local
		,setting: setting
		,getCats: require('../lib/cat').publics.getCats
		,getPosts: require('../lib/post').publics.getPosts
	})

	let obj = exports.readOnlyProxy(mod.publicExports, filename)

	if(plugins[fid]) {
		_.each(plugins[fid], function(func) {
			Object.assign(mod, func(obj))
		})	
	}

}

exports.replace = require('../modules/create-url').replace

exports.createUrl = require('../modules/create-url').createUrl

exports.parseStylus = function(str) {
	return new Promise(function(resolve, reject) {
		stylus.render(str, function(err, css){
			if(err) reject(err)
			else resolve(css)
		})
	})
}

exports.parseJade = function(str, locals, options) {
	return new Promise(function(resolve, reject) {
		let fn = jade.compile(str, options || {})
		let html = fn(locals)
		resolve(html)
	})
}

exports.decipher = function(_encrypted) {

	const decipher = crypto.createDecipher('md5', setting.secret)
	let encrypted = _encrypted
	let decrypted = decipher.update(encrypted, 'hex', 'utf8')
	decrypted += decipher.final('utf8')
	
	return decrypted

}

exports.debugLog = function(env) {
	return function(...args) {
		if(local.env === env) console.log('' + new Date(), ...args)
	}
}

exports.debug = exports.debugLog('dev')

exports.log = function(...args) {
	console.log('' + new Date(), ...args)
}

exports.err = function(...args) {
	console.error('' + new Date(), ...args.map(function(v) {
		return v.stack || v
	}))
}

exports.warn = function(...args) {
	console.warn('' + new Date(), ...args.map(function(v) {
		return v.stack || v
	}))
}

exports.setNoCache = function* (next) {
	if( !/^\/admin\//.test(this.path) ) this.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')
	yield next
}

exports.loginCheck = function* (next) {

	let sess = this.session
	,path = this.path
	,redirect = '/'

	if(
		!sess.user && 
		/^\/su\//.test(path)
	) {
		sess.redirect = path
		return this.redirect(redirect)
	}

	else if(!sess.user && /^\/api\//.test(this.path)) return this.body = {
		code: 1
		,errorMsg: 'please login'
	}

	yield next

}

exports.authCheck = function* (next) {

	let path = this.path

	if(
		!/^\/su\//.test(path) && 
		!/^\/api\//.test(path)
	) return yield next

	let sess = this.session
	,user = sess.user || {}

	let authed = exports.checkPath(path, user.group)

	if(!authed && /^\/su\//.test(path)) return this.redirect('/')
	else if(
		!authed &&
		/^\/api\//.test(path)
	) return this.body = {
		code: 1
		,errorMsg: 'not authorized'
	}
	else if(
		/^\/api\//.test(path) &&
		!/^\/api\/file\/add/.test(path) &&
		this.request.body.csrf !== this.session.csrf
	) return this.body = {
		code: 1
		,errorMsg: 'you are operating in another window/tab, due to security reason, please refresh'
	}
	yield next

}

exports.checkPath = function (path, group) {
	return group.access.indexOf(path) > -1
}

exports.init = function* (next) {


	let arr = this.href.split('/')
	,host = arr[0] + '//' + arr[2]
	,sess = this.session

	sess.state = sess.state || this.sessionId

	this.local = Object.assign({}, local, {
		host: host
		,state: sess.state
		,href: this.href
		,logined: false
		,path: this.path
	})

	if(!local.cdn) this.local.cdn = host
	if(!local.fileServer) this.local.fileServer = host
	

	return yield next
}

exports.accessLog = function* (next) {

	let sess = this.session || {}

	let user = sess.user || {
		name: 'anonymous'
		,email: 'anonymous'
	}

	if(setting.logOn) console.log(
		'' + new Date()
		,this.method
		,this.href
		,this.headers['x-forwarded-for'] || this.ip || this.ips
		,user.name 
		,user.email
		,JSON.stringify(this.request.body)
	)

	return yield next
}

exports.createQueryObj = function(params, pick) {
	let replace = _.pick(exports.replace, pick)
	let res = false
	_.each(params, function(value, key) {
		let k = ':' + key
		if(replace[k]) {
			if(!res) res = {}
			res[key] = value
			return false
		}
	})
	return res
}


