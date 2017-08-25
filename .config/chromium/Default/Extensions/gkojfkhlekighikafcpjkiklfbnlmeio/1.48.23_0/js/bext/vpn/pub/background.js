// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
(function(){
/* XXX arik BACKWARD: rm this file. old extensions used it to load but new
 * extensions use be_rmt directly */
/* XXX arik: rm popup.update_rules, before doing it need to fix ccgi.js so it
 * will not send update_rules message to the extension. currently we call
 * popup.update_rules() from pkg/bext/vpn/chrome/js/background.js - need to rm
 * it from there and implement RMT message handler */
/* XXX arik: grep all usage of window.* and try to rm all */
window.popup = {
    update_rules: function(){ return window.RMT.update_rules(false); }};
/* XXX arik BACKWARD: extensions < 1.1.326 used bg_rmt to detect that
 * background.js was loaded succesfuly. new extensions use RMT instead */
window.bg_rmt = {};
var conf = window.conf;

function load_rmt(){
    require.config({baseUrl: conf.url_bext, waitSeconds: 30,
	urlArgs: 'rand='+Math.random()});
    require(['be_ver'], function(be_ver){
	require.config({baseUrl: conf.url_bext, waitSeconds: 30,
	    urlArgs: 'ver='+be_ver.ver});
        require(['config'], function(be_config){
	    require(['/bext/pub/rmt.js'], function(be_rmt){
		window.RMT = be_rmt;
		window.RMT.init();
	    });
	});
    });
}

function require_onload(){
    require.onError = function(err){
	console.error('rmt_require_err %s %s %o', err.message,
	    err.requireModules, err);
	throw err;
    };
    require.undef('be_tabs');
    require.undef('be_browser');
    require.undef('be_util');
    require.undef('be_ext');
    require.undef('zerr');
    require.undef('etask');
    load_rmt();
}
require_onload();

})();
