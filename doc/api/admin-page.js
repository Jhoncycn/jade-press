
'use strict'

const fs = require('fs')
const path = require('path')
const _ = require('lodash')
let pages = fs.readdirSync( path.resolve(__dirname, '../../views/admin') )
let h1reg = /h1 (.+)\n/

let obj = {
	url: '/admin/:page'
	,method: 'get'
	,name: 'admin pages'
	,desc: ''
	,lib: 'lib/common-page'
	,func: 'admin'
}

let required = ['main']

for(let i = 0, len = pages.length;i < len;i ++) {

	let fname = pages[i]
	let txt = fs.readFileSync(path.resolve(__dirname, '../../views/admin/' + fname)).toString()
	let arr = txt.match(h1reg)
	let title = arr[1]
	let name = fname.replace(/\.jade$/, '')
	let rurl = obj.url.replace(':page', name)
	let ext = {
		name: title
		,uri: rurl
	}
	if(_.indexOf(required, name) > -1) ext.required = true
	exports['/admin/' + name] = _.extend({}, obj, ext)

}


