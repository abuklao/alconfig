// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
// XXX colin: clean unused require
define(['jquery', 'underscore', 'backbone', '/bext/pub/backbone.js',
    '/util/etask.js', '/bext/pub/tabs.js', '/bext/pub/ext.js',
    '/bext/pub/browser.js', '/bext/pub/lib.js', '/util/zerr.js',
    '/util/url.js'],
    function($, _, Backbone, be_backbone, etask, be_tabs, be_ext, B, be_lib,
    zerr, zurl){
B.assert_bg('be_tab_perr');
var E = new (be_backbone.model.extend({
    _defaults: function(){ this.on('destroy', function(){ E.uninit(); }); },
}))();
var cb_wrapper = zerr.catch_unhandled_exception;

function google_host(hostname){
    var host_split = hostname.split('.').reverse();
    return host_split[1]=='google' || host_split[2]=='google';
}

function enabled_google_rule(){
    if (!be_vpn.be_rules || !be_vpn.be_rules.rules)
        return;
    return _.some(be_vpn.be_rules.rules, function(rule){
        return google_host(rule.name); });
}

function google_captcha_send_perr(_url){
    if (!E.inited)
        return;
    var url = zurl.parse(_url), id;
    if (!google_host(url.hostname))
        return;
    if (/\/sorry\/IndexRedirect$/.test(url.pathname))
        id = 'google_cap_indexredirect';
    if (/\/websearch\/answer\/86640$/.test(url.pathname))
        id = 'google_cap_support';
    if (id && enabled_google_rule())
        id = id+'_enabled_google_rule';
    if (id)
    {
        be_lib.perr_err({
            id: id+(be_vpn.be_mode.get('svc.detected') ? '_svc' : ''),
            rate_limit: {count: 1}, info: {url: _url}});
    }
}

var on_tab_created = cb_wrapper(function(o){
    var tab = o.tab;
    if (!tab.url)
	return;
    google_captcha_send_perr(tab.url);
});

var on_tab_updated = cb_wrapper(function(o){
    var info = o.info;
    if (!info || !info.url)
	return;
    google_captcha_send_perr(info.url);
});

var on_tab_replaced = cb_wrapper(function(o){
    var added = o.added;
    B.tabs.get(added, function(tab){
	if (!tab || !tab.url)
	    return;
        google_captcha_send_perr(tab.url);
    });
});

// XXX colin: copied from be_tab_unblocker
function update_state(){
    var is_enabled = be_ext.get('r.ext.enabled');
    if (is_enabled==E.is_enabled)
        return;
    E.is_enabled = is_enabled;
    E.stopListening(be_tabs);
    if (!E.is_enabled)
        return;
    E.listenTo(be_tabs, 'created', on_tab_created);
    E.listenTo(be_tabs, 'updated', on_tab_updated);
    E.listenTo(be_tabs, 'replaced', on_tab_replaced);
}

E.uninit = function(){
    if (!E.inited)
	return;
    E.sp.return();
    E.inited = 0;
    E.stopListening();
    be_vpn = null;
};

var be_vpn;
E.init = function(_be_vpn){
    if (E.inited)
	return;
    be_vpn = _be_vpn;
    E.sp = etask('be_tab_perr', [function(){ return this.wait(); }]);
    E.inited = 1;
    E.listen_to(be_ext, 'change:r.ext.enabled', update_state);
};

return E; });
