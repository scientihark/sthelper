﻿var nt = require('./lib/nt');
var fs = require('fs');
var path = require('path');
var crcHash = require("crc-hash");
var argv = require('optimist').argv;
var clc = require('cli-color');
var FileToHash=0;
var SOURCE_FILES=[]

function readFilesFromDir(dir){
	var list = fs.readdirSync(dir)
    list.forEach(function(filename) {
        file = dir + '/' + filename
        var stat = fs.statSync(file)
        if (stat && stat.isDirectory()) {
            readFilesFromDir(file)
        }else {
            var fileobj={
                path:file,
                size:stat.size,
                name:filename
            }
            FileToHash++;
            SOURCE_FILES.push(fileobj)
            get_file_crc(fileobj)
        }
    })

}
var TORRENT=null,TARGET=null;
function readSourceDir(source,torrent,target){
	console.log('reading source dir')
	TORRENT=torrent;
	TARGET=target;
	readFilesFromDir(source)
}

function get_file_crc(fileObj){
	var rs = fs.createReadStream(fileObj.path);
    var hash = crcHash.createHash("crc32");
    rs.on('data', hash.update.bind(hash));
    rs.on('end', function () {
    	FileToHash--;
        fileObj.hash=hash.digest('hex').toUpperCase();
        readTargetTorrent()
    });
    rs.on('error', function (e) {
        FileToHash--;
        fileObj.hash='error reading';
        readTargetTorrent()
    });
}
function readTargetTorrent(){
	if(FileToHash>0){
		return;
	}

	nt.read(TORRENT, function(err, torrent) {
	  if (err) throw err;
	    var meta=torrent.metadata,
	  		info=meta.info,
	  		pieces_raw=info.pieces,
	  		files = info.files || [{ path: [info.name], length: info.length,hash:info.hash }],
	  		total=0,matched=0;
	  	
	  	for(var i =0;i< files.length;i++){
	  		var file=files[i],
	  			hash=file.hash,
	  			size=file.length;
	  		total++;
	  		for(var j =0;j<SOURCE_FILES.length;j++){
	  			var ofile=SOURCE_FILES[j];
	  			if(ofile.hash==hash&&ofile.size==size){
	  				file.matched=ofile;
	  				matched++;
	  				break;
	  			}
	  		}
	  	}
	  	console.log('Total '+total+' Matched '+matched)
	  	console.log('总计 '+total+' 个文件 匹配到 '+matched+' 个')

	  	for(var i in files){
	  		var file=files[i];
	  		if(file.matched){
	  			if(TARGET.indexOf('\\')==-1){
	  				var linkpath=TARGET+info.name+'\\'+file.path.join('\\');
	  			}else{
	  				var linkpath=TARGET+'/'+info.name+'/'+file.path.join('/').replace(/\\/g,'/');
	  			}
	  			
	  			console.log(linkpath);
	  			mkdirs(linkpath);
	  			fs.linkSync(file.matched.path, linkpath)
	  		}
	  	}
	  	console.log('Done Linking!');
	  	console.log('完成链接!');
	});
}
function mkdirs(dirpath) {
	var list=[],
		dirlist=dirpath.split('/');
		dirlist.pop();
	for(var i =0;i< dirlist.length;i++){
		var dir=[];
		for(var j =0;j<=i;j++){
			dir.push(dirlist[j]);
		}
		dir=dir.join('/');
		try{
			fs.mkdirSync(dir)
		}catch(e){}
	}
}
function mktorrent(torrent,dir){
	nt.makeWrite(torrent, 'http://announce.test', dir,['.'],
		function(err, torrent) {
			if (err) throw err;
			console.log('Finished writing torrent!');
			console.log('种子制作完成!');
			setTimeout(function(){
				process.exit();
			},2000)
	});
}

if(argv&&argv._&&argv._[0]=='make'){
	var source=argv._[1],
		torrent=argv._[2]||'out.torrent';

	if(!source){
		console.log("can't find "+source);
		return;
	}
	mktorrent(torrent,source)
}else if(argv&&argv._&&argv._[0]=='link'){
	var source=argv._[1],
		torrent=argv._[2],
		target=argv._[3]||'output';
	readSourceDir(source,torrent,target)
}else{
	//print help info
	console.log("\nsnowpt torrent helper.\n");
	console.log("Usage:");
	console.log("");
	console.log("make torrent: sthelper "+clc.blueBright("make")+clc.yellowBright("[source_dir]")+clc.yellowBright("[torrent]"));
	console.log("link torrent: sthelper "+clc.blueBright("link")+clc.yellowBright("[source_dir]")+clc.yellowBright("[target_dir]")+clc.yellowBright("[map_torrent]"));
	console.log("");
	console.log("");
	return 0;
}


