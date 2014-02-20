var mongodb = require('mongodb').Db;
var crypto = require('crypto');
var settings = require('../settings');
function User(user){
	this.name = user.name;
	this.password = user.password;
	this.email = user.email;
};
module.exports = User;

//储存用户信息
User.prototype.save = function(callback){
	var md5 = crypto.createHash('md5'),
		email_MD5 = md5.update(this.email.toLowerCase()).digest('hex'),
		head = "http://www.gravatar.com/avatar/" + email_MD5 + "?s=80";
	//要存入数据库的用户文档
	var user = {
		name: this.name,
		password: this.password,
		email: this.email,
		head: head
	};
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);//错误，返回err信息
		}
		//读取users集合
		db.collection('users',function(err,collection){
			if(err){
				db.close();
				return callback(err);//错误，返回err信息
			}
			//将用户数据插入users集合
			collection.insert(user,{
				safe: true
				},
				function(err,user){
					db.close();
					if(err){
						return callback(err);//错误，返回err信息
					}
					callback(null,user[0]);//成功！err为null,并返回存储后的用户文档
			});
		});
	});
};
//读取用户信息
User.get = function(name,callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
		      return callback(err);//错误，返回 err 信息
		}
		  //读取 users 集合
		db.collection('users', function (err, collection) {
			if (err) {
				db.close();
				return callback(err);//错误，返回 err 信息
			}
			//查找用户名（name键）值为 name 一个文档
			collection.findOne({name: name}, function (err, user) {
				db.close();
				if (err) {
					return callback(err);//失败！返回 err 信息
				}
				callback(null, user);//成功！返回查询的用户信息
			});
		});	 
	});
};
User.findAll=function(callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
			return callback(err);//错误，返回 err 信息
		}
		db.collection('users',function(err,user_collection){	
			if (err) {
				 db.close();
				 return callback(err);//错误，返回 err 信息
			}
			user_collection.find().toArray(function(err,results){
				db.close();
				if(err){
					return callback(err);
				}
				return callback(null,results);
			}); 
		});
	});	
};