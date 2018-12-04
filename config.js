var config = {};

config.port = process.env.WEB_PORT || 10086;

config.api = {
  check_wa_image:  'http://www.wayixia.com/index.php?mod=api&action=check-wa-image&inajax=true',
  wa_image:  'http://www.wayixia.com/index.php?mod=api&action=wa-image&inajax=true',
};

config.server = {};
config.server.name = 's1.wayixia.com';
//config.server.path = '../../../ii';
//config.server.thumb_path = '../../../ii/thumb';

config.server.path = 'D:/pictures/wayixia.com';
config.server.thumb_path = 'D:/pictures/wayixia.com/thumb';

module.exports = config;

