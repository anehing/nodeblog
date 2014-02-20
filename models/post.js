var mongodb = require('mongodb').Db,
	markdown = require('markdown').markdown;
var settings = require('../settings');


function Post(name,head, title, post,tags) {
	this.name = name;
	this.title = title;
	this.post = post;
	this.tags = tags;
	this.head = head;
}

module.exports = Post;

	//存储一篇文章及其相关信息
Post.prototype.save = function(callback) {
	var date = new Date();
	//存储各种时间格式，方便以后扩展
	var time = {
		date: date,
		year : date.getFullYear(),
		month : date.getFullYear() + "-" + (date.getMonth() + 1),
		day : date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate(),
		minute : date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + 
		date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) 
	}
	//要存入数据库的文档
	var post = {
		name: this.name,
		head: this.head,
		time: time,
		tags: this.tags,
		title: this.title,
		post: this.post,
		comments: [],
		reprint_info: {},
		pv: 0
	};
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
			return callback(err);
		}
		//读取 posts 集合
		db.collection('posts', function (err, collection) {
			if (err) {
				db.close();
				return callback(err);
			}
			//将文档插入 posts 集合
			collection.insert(post, {
				safe: true
			}, function (err) {
				db.close();
				if (err) {
					return callback(err);//失败！返回 err
				}
				callback(null);//返回 err 为 null
			});
		});
	});
};

//读取文章及其相关信息
Post.getAll = function(name, callback) {
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
			return callback(err);
		}
		//读取 posts 集合
		db.collection('posts', function(err, collection) {
			if (err) {
				db.close();
				return callback(err);
			}
			var query = {};
			if (name) {
				query.name = name;
			}
			//根据 query 对象查询文章
			collection.find(query).sort({
				time: -1
			}).toArray(function (err, docs) {
				db.close();
				if (err) {
					return callback(err);//失败！返回 err
				}
				//解析 markdown 为 html
				docs.forEach(function (doc) {
					doc.post = markdown.toHTML(doc.post);
				});
				callback(null, docs);//成功！以数组形式返回查询的结果
			});
		});
	});
};
Post.getOne = function(name,day,title,callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);
		}
		//读取posts集合
		db.collection('posts',function(err,collection){
			if(err){
				db.close();
				return callback(err);
			}
			//根据用户名，发表日期及文章进行查询
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
				},
				function(err,doc){
					if(err){
						db.close();
						return callback(err);
					}
					if(!doc){
						db.close();
						return callback("文章已不存在");
					}
					collection.update({
						"name": name,
						"time.day": day,
						"title": title
						},{
							$inc: {"pv":1}
						},function(err){
							db.close();
							if(err){
								return callback(err);
							}
					});
					//解析markdown为html
					doc.post = markdown.toHTML(doc.post);
					if(doc.comments.length){
						doc.comments.forEach(function (comment) {
							comment.content = markdown.toHTML(comment.content);
						});
					}
					callback(null,doc);//返回查询的一篇文章
			});
		});
	});
};
//返回原始发表的内容（markdown格式）
Post.edit = function(name,day,title,callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);
		}
		//读取posts集合
		db.collection('posts',function(err,collection){
			if(err){
				db.close();
				return callback(err);
			}
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
			},function(err,doc){
				db.close();
				if(err){
					return callback(err);
				}
				if(!doc){
					return callback("文章不存在")
				}
				callback(null,doc);//返回查询的一篇文章（markdown 格式）
			});
		});	
	}); 
};
//更新一篇文章及其相关信息
Post.update = function(name, day, oldtitle,newtitle, post,tag1,tag2,tag3, callback) {
	//打开数据库
	console.log(newtitle);
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
			return callback(err);
		}
		//读取 posts 集合
		db.collection('posts', function (err, collection) {
			if (err) {
				db.close();
				return callback(err);
			}
			//更新文章内容
			var tags=new Array(tag1,tag2,tag3); 
			collection.update({
				"name": name,
				"time.day": day,
				"title": oldtitle
			}, {
				$set: {"post": post,"title": newtitle,"tags": tags}
			}, function (err) {
				db.close();
				if (err) {
					return callback(err);
				}
				callback(null);
			});
		});
	});
};
//删除一篇文章
Post.remove = function(name, day, title, callback) {
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if (err) {
			return callback(err);
		}
		//读取 posts 集合
		db.collection('posts', function (err, collection) {
			if (err) {
				db.close();
				return callback(err);
			}
			//查询要删除的文档
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
				},function(err,doc){
					if (err) {
						db.close();
						return callback(err);
					}
					//如果有 reprint_from，即该文章是转载来的，先保存下来 reprint_from
					var reprint_from = "";
					if (doc.reprint_info.reprint_from) {
						reprint_from = doc.reprint_info.reprint_from;
					}
					if(reprint_from!=""){
						//更新原文章所在文档的 reprint_to
						collection.update({
							"name": reprint_from.name,
							"time.day": reprint_from.day,
							"title": reprint_from.title
							},{ $pull: {"reprint_info.reprint_to":{"name": name,"day": day,"title": title} }
							},function(err){
								if(err){
									db.close();
									return callback(err);
								}
							}
						);
					}
					//根据用户名、日期和标题查找并删除一篇文章
					collection.remove({
						"name": name,
						"time.day": day,
						"title": title
					}, {
						w: 1
					}, function (err) {
						db.close();
						if (err) {
							return callback(err);
						}
						callback(null);
					});
				}
			);
		});
	});
};
Post.getTen = function(name,page,callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);
		}
		//读取posts集合
		db.collection('posts',function(err,collection){
			if(err){
				db.close();
				return callback(err);
			}
			var query = {};
			if(name){
				query.name = name;
			}
			//使用 count 返回特定查询的文档数 total
			collection.count(query,function(err,total){
				//根据 query 对象查询，并跳过前 (page-1)*10 个结果，返回之后的 10 个结果
				collection.find(query,{
					skip: (page - 1)*10,
					limit: 10
				}).sort({
						time: -1
				}).toArray(function(err,docs){
					db.close();
					if(err){
						return callback(err);
					}
					if(docs){
						docs.forEach(function(doc){
							 doc.post = markdown.toHTML(doc.post);	
						});
						callback(null,docs,total);
					}else{
						callback("用户暂未发表文章");
					}
				});
			});
		});
	});
};
Post.getArchive = function(callback){
	//打开数据库
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);
		}
		//读取posts集合
		db.collection('posts',function(err,collection){
			if(err){
				db.close();
				return callback(err);
			}
			//返回只包含 name、time、title 属性的文档组成的存档数组
			collection.find({},{
				"name": 1,
				"time": 1,
				"title": 1
			}).sort({
				time: -1
			}).toArray(function(err,docs){
				db.close();
				if(err){
					return callback(err);
				}
				callback(null,docs);
			});
		});
	});
};
//返回所有标签
Post.getTags = function(callback) {
  mongodb.connect(settings.url, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.collection('posts', function (err, collection) {
      if (err) {
        db.close();
        return callback(err);
      }
      //distinct 用来找出给定键的所有不同值
      collection.distinct("tags", function (err, docs) {
        db.close();
        if (err) {
          return callback(err);
        }
        callback(null, docs);
      });
    });
  });
};
//返回含有特定标签的所有文章
Post.getTag = function(tag, callback) {
  mongodb.connect(settings.url, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.collection('posts', function (err, collection) {
      if (err) {
        db.close();
        return callback(err);
      }
      //查询所有 tags 数组内包含 tag 的文档
      //并返回只含有 name、time、title 组成的数组
      collection.find({
        "tags": tag
      }, {
        "name": 1,
        "time": 1,
        "title": 1
      }).sort({
        time: -1
      }).toArray(function (err, docs) {
        db.close();
        if (err) {
          return callback(err);
        }
        callback(null, docs);
      });
    });
  });
};
//返回通过标题关键字查询的所有文章信息
Post.search = function(keyword, callback) {
  mongodb.connect(settings.url, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.collection('posts', function (err, collection) {
      if (err) {
        db.close();
        return callback(err);
      }
      var pattern = new RegExp("^.*" + keyword + ".*$", "i");
      collection.find({
        "title": pattern
      }, {
        "name": 1,
        "time": 1,
        "title": 1
      }).sort({
        time: -1
      }).toArray(function (err, docs) {
        db.close();
        if (err) {
         return callback(err);
        }
        callback(null, docs);
      });
    });
  });
};
//转载一篇文章
Post.reprint = function(reprint_from,reprint_to,callback){
	mongodb.connect(settings.url, function (err, db) {
		if(err){
			return callback(err);
		}
		db.collection('posts',function(err,collection){
			if(err){
				db.close();
				return callback(err);
			}
			//找到要转载的原文档
			collection.findOne({
				"name": reprint_from.name,
				"time.day": reprint_from.day,
				"title": reprint_from.title
				},function(err,doc){
					if(err){
						db.close();
						return callback(err);
					}
					var date = new Date();
					var time = {
						date: date,
						year : date.getFullYear(),
						month : date.getFullYear() + "-" + (date.getMonth() + 1),
						day : date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate(),
						minute : date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + 
						date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes())
					}
					delete doc._id;//注意要删掉原来的 _id
					doc.name = reprint_to.name;
					doc.head = reprint_to.head;
					doc.time = time;
					doc.title = (doc.title.search(/[转载]/) > -1) ? doc.title : "[转载]" + doc.title;
					doc.comments = [];
					doc.reprint_info = {"reprint_from": reprint_from};
					doc.pv = 0;
					//更新被转载的原文档的 reprint_info 内的 reprint_to
					collection.update({
						"name": reprint_from.name,
						"time.day": reprint_from.day,
						"title": reprint_from.title
						},{
							$push:{"reprint_info.reprint_to": {"name": doc.name,"day": time.day,"title": doc.title}}
						},function(err){
							if(err){
								db.close();
								return callback(err);
							}
						}
					);
					//将转载生成的副本修改后存入数据库，并返回存储后的文档
					 collection.insert(doc,{safe: true},function(err,post){
						 db.close();
						 if(err){
							 return callback(err);
						 }
						 console.log(post);
						 console.log('---');
						 console.log(post[0]);
						 callback(err,post[0]);
						 
					 });
			});
		});
	});
};