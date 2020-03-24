/** \file wa.js
 * \authr Q
 * \biref wa image  
 * 
 */
var config = require('./config');
var http = require("http");
var fs = require('fs');
var request = require('request');
var imageinfo = require('imageinfo');
var image_magick = require('imagemagick');
var gm = require('gm').subClass({ imageMagick: true });
var url = require('url');
var querystring = require('querystring');
//var mergeimage = require('./mergeimage')
var num = 0;
var orignal_headers = {
  "Content-Type": "text/html; charset=utf-8", 
  "Access-Control-Allow-Origin": "http://www.wayixia.com",
  "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",  
  "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
  "Access-Control-Allow-Credentials": true 
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
 });
}


function parse_cookies (req) {
  var list = {},
  rc = req.headers.cookie;

  rc && rc.split(';').forEach(function( cookie ) {
    var parts = cookie.split('=');
    list[parts.shift().trim()] = unescape(parts.join('='));
  });

  return list;
}


function echo(res, data) {
  console.log("[echo] ->" + data);
  var headers = orignal_headers;
  headers['Content-Length'] = data.length;
  res.writeHead(200, headers);
  res.write(data, 'utf8');
  res.end();
}

function echo_json(res, header, data, extra) {
  var object = {};
  object.header = header|| 0;
  object.data   = data || null;
  object.extra  = extra || null;
  // buffer ����
  var str = new Buffer(JSON.stringify(object));
  echo(res, str);
}

function save_thumb(src, dest, src_width, src_height, dest_width) {
  // resize and remove EXIF profile data
  var width = dest_width;
  var height = (width * src_height) / src_width;
  console.log( src + "\n" + dest );
  image_magick.resize({
    srcPath: src,
    dstPath: dest,
    width:   dest_width
  }, function(err, stdout, stderr){
    if(err) 
      console.log( err );
    console.log('[image-resize] resized '+ src +'->'+ dest +' to fit within '+dest_width+'px');
  });
}

function image_cachefile( filename ) 
{
  return config.server.path + "/cache/" + filename;
}

function get_remote_image(img, callback) {
  var options = {
    url : img.src, 
    headers : {
      "Cookie"  : img.cookie,
      "Referer" : img.referer,
      "User-Agent" : img.agent, //req.headers['user-agent'],  
    },
    encoding: null,  // use binary data 
  };
  
  var cache_file = image_cachefile( img.filename )
  //var thumb_file_name = config.server.thumb_path + "/cache/" + img.filename;
  //var stream = fs.createWriteStream(file_name);
  console.log("[get-remote] start get remote image "+ cache_file +"..."); 
  var r = request(options, function(err, res, body) {
    console.log("[get-remote] end " );
    if(!err && res.statusCode == 200) {
      var info = imageinfo(body);
      //console.log(info);
      if(!info) { 
        callback.onerror(err, res);
        fs.unlink( cache_file );
      } else {
        info.file_size = body.length;
        callback.onsuccess( cache_file, info );
        //save_thumb(file_name, thumb_file_name, info.width, info.height, 192);
      }
    } else {
      callback.onerror(err, res);
    } 
  }).pipe( fs.createWriteStream( cache_file ) ); 
}

function wa_image(img, api_cookie, callback) {
  var object = {};
  object = img;
  var senddata = 'postdata='+encodeURIComponent(encodeURIComponent(JSON.stringify(object)));
  var options = {
    url : config.api.wa_image,
    method : "POST",
    headers: {
      "content-type" : "application/x-www-form-urlencoded",
      "Cookie" : api_cookie,
      "User-Agent" : "wayixia node server",
    },
    body : senddata, 
  };
  
  console.log("[wa-image] start " + JSON.stringify( img ) + "...");
  request(options,  function(err, res, body) {
    console.log("[wa-image] end " + body );
    try {
      if(!err && res.statusCode == 200) {
        var r = JSON.parse(decodeURIComponent(body));
        callback.onsuccess(r); 
      } else {
        throw false;
      }
    } catch(e) {
      callback.onerror(err, res);
    }
  });    
}


function check_wa_image(img, api_cookie, callback) {
  var object = img;
  var senddata = 'postdata='+encodeURIComponent(encodeURIComponent(JSON.stringify(object)));
  var options = {
    url : config.api.check_wa_image,
    method : "POST",
    headers: {
      "content-type" : "application/x-www-form-urlencoded",
      "Cookie" : api_cookie,
      "User-Agent" : "wayixia node server",
    },
    body : senddata, 
  };
  console.log("[check-image] start " + JSON.stringify( img ) );
  /** Send request */
  request(options,  function(err, res, body) {
    try {
      if(!err && res.statusCode == 200) {
        console.log("[check-image] result -> "+body);
        var r = JSON.parse(decodeURIComponent(body));
        if(r.header !=0) {
          // web server api failed
          callback.onfailed(r);
        } else {
          if(r.data.res_id <= 0) {
            callback.onwa();
          } else {
            callback.onsuccess();
          }
        }
      } else {
        throw false;
      }
    } catch(e) {
      callback.onerror(err, res);
    }
  });    
}

function http_process(req, response, data_from_agent) {
  //console.log( data_from_agent ) 
  //console.log(decodeURIComponent(data_from_agent));
  var object = JSON.parse(decodeURIComponent(data_from_agent));
  var wayixia_api_cookie = req.headers.cookie;
  var image_cookie = object.img.cookie;
  var options = {
    src : object.img.srcUrl,
    url : object.img.pageUrl, 
    title: object.img.title,
    album_id: object.img.album_id
  };
  if( /^data:/i.test(options.src) ) {
    echo_json(response, -1, null, null);
    return;
  }
  // check wa image
  check_wa_image( options, wayixia_api_cookie, {
    onfailed: function(r) { 
      //console.log("[check-image] check_wa_image onfailed" + JSON.stringify(r)); 
      echo_json(response, r.header, r.data, r.extra);
    }
    , onerror : function(err, res) { 
      //console.log("[check-image] check_wa_image onerror" + err); 
      echo_json(response, 0, "", ""); 
    }
    , onsuccess : function() { 
      //console.log("[check-image] check_wa_image success"); 
      echo_json(response, 0, "", ""); 
    }
    , onwa: function() {
      var file_name = uuid();
      var remote_options = {
        src : object.img.srcUrl,
        cookie: image_cookie,
        referer: object.img.referer||object.img.pageUrl,
        agent: req.headers['user-agent'],
        filename: file_name,
      };
      // start get image 
      get_remote_image( remote_options, {
        onsuccess: function( cache_file, info ) {
          /*
            type: 'image',
            format: 'JPG',
            mimeType: 'image/jpeg',
            width: 450,
            height: 561 }
          */
          //console.log('[get-remote] get remote image ok!'); 
          var wa_image_options = {
            server : config.server.name,
            res_id : 0,
            img : {
              src: object.img.srcUrl,
              title: object.img.title,
              album_id: object.img.album_id,
              from_url: object.img.pageUrl,
              file_name: file_name,
              file_type: info.format || '',
              file_width: info.width || object.img.width,
              file_height: info.height || object.img.height,
              file_size: info.file_size,  
            }
          };  
                  
          wa_image(wa_image_options, wayixia_api_cookie, {
            onsuccess: function( r ) {
              //console.log("[wa-image]wa image ok! with code: " + r.header);
              /** Move image by date folder */
              if( r.header == 0 ) {
                var new_dir = config.server.path + "/" + r.data.create_time;
                var new_file = new_dir + "/" + file_name;
                if( !fs.existsSync( new_dir ) ) {
                  fs.mkdirSync( new_dir );
                }

                fs.rename( cache_file, new_file, function( err ) { 
                  if( err ) {
                    console.log("[move-cache] failed " + err );
                  } else {
                    var new_thumb_dir = new_dir + "/thumb";
                    var thumb_file_name = new_thumb_dir + "/" + file_name;
                    if( !fs.existsSync( new_thumb_dir ) ) {
                      fs.mkdirSync( new_thumb_dir );
                    }
                    save_thumb( new_file, thumb_file_name, info.width, info.height, 230);
                    echo_json(response, r.header, r.data, r.extra);      
                  }
                });
              } else {
                echo_json(response, r.header, r.data, r.extra);      
              }
            },
            onerror: function(err, res) {
              //console.log("[wa-image] wa image failed ->" + res.statusCode);
              echo_json(response, -1, null, null);
            }
          });
        },
        onerror: function(err, res) {
          //console.log(res.statusCode);
          echo_json(response, -1, null, null);
        }
      }); // end get remote image
    } 
  }); // end check wa image
}

var Q = {
  dispatch: function(req, res) {
    var env = url.parse(req.url);
    switch(env.pathname) {
    case '/getimage':
      this.getimage(req, res);
      break;
    case '/merge':
      this.merge( req, res );
      break;
    case '/payresult':
      this.payresult( req, res );
      break;
    default:
      echo(res, env.pathname + " is no supported");
    }
  },

  getimage: function(req, res) {
    var postdata = '';
    req.setEncoding('utf8');
    req.addListener('data', function(chunk) {
      //console.log('get image process ondata');
      postdata += chunk.toString();
    });

    req.addListener('end', function() {
      try {
        //console.log('get image ' + req.headers.cookie);
        var qs = querystring.parse(postdata); 
        http_process(req, res, qs.postdata);
      } catch(e) {
        console.log(e);
        echo(res, e.message);
      }
    });
  },

  merge: function( req, res ) {
    echo( res, "mergeimage" );
    var postdata = '';
    req.setEncoding('utf8');
    req.addListener('data', function(chunk) {
      //console.log('get image process ondata');
      postdata += chunk.toString();
    });

    req.addListener('end', function() {
      try {
        //console.log('get image ' + req.headers.cookie);
        var qs = querystring.parse(postdata); 
        echo ( res, qs.postdata );
        //mergeimage.merge( qs.postdata );
      } catch(e) {
        console.log(e);
        echo(res, e.message);
      }
    });
 },

  payresult: function( req, res ) {
   var ourl = url.parse(req.url);
   const pathname = ourl.pathname;
   //ourl.search
   //var r = pathname.match( /\/[^\/]+/g );
   var ws = this.wss[ourl.query];
   if( ws ) {
     ws.send("1");
     echo_json(res, 0, null, null);
   } else {
     ws.send("0");
     echo_json(res, -1, null, null);
   }
  },

  addwss: function( k, ws ) {
    if( this.wss[k] )
    {
      this.wss[k].close();
    }

    this.wss[k] = ws;
  },

  removewss: function( k ) {
    if( this.wss[k] )
    {
      this.wss[k].close();
    }
    delete this.wss[k];
  },
  wss : {},
};




var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ noServer: true }); 
wss.on("connection", function(ws, request) {
  
  var ourl = url.parse(request.url);
  const pathname = ourl.pathname;
  console.log( ourl ); 
	ws.send("Welcome to " + ourl.query );
  Q.addwss( ourl.query, ws ); 
});


var server = http.createServer(function(req, res) {   
  Q.dispatch( req, res );
}).on( 'connection', function( socket ) {
  socket.setNoDelay( true );
}).on( 'upgrade', function( request, socket, head ) {
  const pathname = url.parse(request.url).pathname;
  if( pathname  === "/payment" ) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});




// Start Listen
server.listen( config.port );


console.log('Server is listening to http://localhost/ on port ' + config.port );

