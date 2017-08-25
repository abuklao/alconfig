// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['jquery', 'underscore', 'backbone', '/bext/pub/backbone.js',
    '/protocol/pub/countries.js', '/util/etask.js', '/bext/pub/ext.js',
    '/bext/pub/util.js', '/util/zerr.js', '/bext/vpn/pub/rule.js',
    '/bext/pub/tabs.js', '/bext/pub/browser.js', '/bext/vpn/pub/util.js',
    '/svc/pub/util.js', '/bext/pub/lib.js',
    '/util/user_agent.js', '/util/version_util.js'],
    function($, _, Backbone, be_backbone, pcountries, etask, be_ext, be_util,
    zerr, be_rule, be_tabs, B, be_vpn_util, svc_util, be_lib,
    user_agent, version_util){
B.assert_bg('be_icon');
var E = new be_backbone.task_model();
var chrome = window.chrome, conf = window.conf, assign = Object.assign;

function uninit(){
    if (!E.get('inited'))
        return;
    E.sp.return();
    E.set('inited', false);
}

E.init = function(){
    if (E.get('inited'))
	return;
    E.set('inited', true);
    E.sp = etask('be_icon', [function(){ return this.wait(); }]);
    E.on('destroy', function(){ uninit(); });
    E.on('recover', function(){});
    E.listenTo(be_ext, 'change:r.ext.enabled change:ext.slave', refresh_all);
    E.listenTo(be_ext, 'change:r.vpn.on', refresh_active);
    E.listenTo(be_rule, 'change:stamp', refresh_active);
    if (!chrome)
    {
        E.listenTo(be_tabs, 'change:active.url change:active.id',
            refresh_active);
    }
    else
    {
        E.listenTo(be_tabs, 'change:active.id', refresh_active);
        E.listenTo(be_tabs, 'updated', function(o){
            // chrome resets icon when tab status changes, so we set it back,
            // also need to update icon when url changes
            if (!o.info.url && !o.info.status)
                return;
            E.refresh({tab: o.tab});
        });
        E.listenTo(be_tabs, 'completed', function(o){
            // due to bug in chrome, 'tabs.onUpdated' event is not fired when a
            // newly replaced tab is completed, 'webNavigation.onCompleted'
            // doesn't have this problem
            E.refresh({tabId: o.tabId});
        });
    }
    refresh_all();
};

function refresh_active(){ E.refresh({retry: 1}); }

function refresh_all(){
    if (!chrome)
        return E.refresh(null);
    refresh(null); // change global settings
    // per tab settings
    B.tabs.query({}, function(tabs){
        tabs.forEach(function(tab){ refresh(tab); }); });
}

function tab_opt(tab, opt){ return assign(opt, tab ? {tabId: tab.id} : {}); }

function set_icon_cb(retry){
    return function(){
        if (!B.runtime.last_error)
            return;
        var err = B.runtime.last_error.message||B.runtime.last_error;
        zerr('set_icon_err: ', err);
        if (!_.isNumber(retry))
            return;
        if (retry>0)
            return E.refresh({retry: retry-1});
        be_lib.perr_err({id: 'set_icon_err', rate_limit: {count: 1},
            err: err});
    };
}

function refresh(tab, retry){
    var cb = set_icon_cb(retry);
    var gray = {19: 'bext/vpn/pub/img/icon19_gray.png',
        38: 'bext/vpn/pub/img/icon38_gray.png'};
    var ok = {19: 'bext/vpn/pub/img/icon19.png',
        38: 'bext/vpn/pub/img/icon38.png'};
    var blank = {19: 'bext/vpn/pub/img/icon19_blank.png',
        38: 'bext/vpn/pub/img/icon38_blank.png'};
    if (version_util.cmp(be_util.version(), '1.13.544')<0)
    {
        gray = {19: 'img/icon19_gray.png', 38: 'img/icon38_gray.png'};
        ok = {19: 'img/icon19.png', 38: 'img/icon38.png'};
        blank = {19: 'img/icon19_blank.png', 38: 'img/icon38_blank.png'};
    }
    var slave = be_ext.get('ext.slave');
    if (!be_ext.get('r.ext.enabled') || slave)
    {
	B.browser_action.set_icon(tab_opt(tab, {path: slave ? blank : gray}),
            cb);
	B.browser_action.set_badge_text(tab_opt(tab,
            {text: slave ? '' : 'off'}));
	B.browser_action.set_badge_background_color(tab_opt(tab,
            {color: '#FF8800'}));
	return;
    }
    B.browser_action.set_badge_text(tab_opt(tab, {text: ''}));
    var url = tab&&tab.url||'', rule = be_rule.get_rules(url)[0];
    if (!be_ext.get('r.vpn.on') || !rule || !rule.enabled || !rule.country)
    {
	B.browser_action.set_icon(tab_opt(tab, {path: ok}), cb);
	if (rule && !rule.country)
	{
	    be_lib.perr_err({id: 'icon_no_country_err', info: {url: url,
		rule: rule}, rate_limit: {count: 1}});
	}
        return;
    }
    // XXX arik: show tooltip when site is unblocked
    var img = rule.country.toLowerCase()+'.png?'+be_ext.qs_ver_str();
    var b = user_agent.guess_browser();
    var path = {19: 'svc/pub/img/flag/19/'+img,
        38: 'svc/pub/img/flag/32/'+img};
    if (version_util.cmp(be_util.version(), '1.13.953')<0)
        path = {19: 'img/flag/19/'+img, 38: 'img/flag/32/'+img};
    var q = [];
    return etask({name: '_refresh', cancel: true}, [function(){
        if (b.browser!='firefox' || +(b.version||0)<39 ||
            version_util.cmp(be_util.version(), '1.9.29')<0)
        {
            _.each(path, function(v, k){
                path[k] = conf.url_bext+'/'+v;
            });
            return this.goto('exit');
        }
        var sp = this;
        _.each(path, function(v, k){
            var _sp;
            sp.spawn((_sp=etask({cancel: true}, [function(){
                return be_util.fetch_bin({url: v});
            }])));
            _sp.data = {url: v, k: k};
            q.push(_sp);
        });
        return etask.all(q);
    }, function(arr){
        _.each(arr, function(v, k){
            if (v.res && v.res.data)
                path[q[k].data.k] = v.res.data;
        });
    }, function exit(){
        B.browser_action.set_icon(tab_opt(tab, {path: path}), cb);
    }]);
}

E.refresh = function(o){ E.trigger('refresh', o); };
E.on('refresh', function(o){
    if (!E.get('inited'))
        return;
    return E.sp.spawn({name: 'refresh', cancel: true}, etask([function(){
        return o && o.tab ? o.tab : o && o.tabId ? be_tabs.get_tab(o.tabId) :
            be_tabs.active();
    }, function(tab){
        if (!tab)
            return;
        return refresh(tab, o&&o.retry);
    }, function catch$(err){ be_lib.err('be_icon_refresh_err', '', err); }]));
});

return E; });
