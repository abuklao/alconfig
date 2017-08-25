// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['jquery', '/bext/pub/backbone.js', '/bext/pub/browser.js',
    '/util/etask.js', '/util/zerr.js', '/util/date.js', '/bext/pub/tabs.js',
    '/bext/vpn/pub/premium.js', '/util/storage.js', '/bext/pub/lib.js',
    '/bext/pub/util.js', '/bext/vpn/pub/ajax.js'],
    function($, be_backbone, B, etask, zerr, date, be_tabs, premium, storage,
        be_lib, be_util, ajax){
B.assert_bg('be_commercial');
var www_config = {};
var conf = window.conf;
var hist_length = 5;
var hist_age = date.ms.DAY;
var enable_timeout = date.ms.WEEK;
var refresh_timeout = date.ms.DAY;
var commercial_timeout;
var E = new (be_backbone.model.extend({
    hosts: [],
    history: {},
    _defaults: function(){
        this.on('destroy', function(){
            B.backbone.server.stop(this, 'be_commercial');
            E.uninit();
        });
        B.backbone.server.start(this, 'be_commercial');
    },
}))();
E.subscribe_if_not_allowed = function(rule){
    if (E.is_allowed(rule))
        return false;
    return E.promote_subscription(rule);
};
E.promote_subscription = function(rule){
    var host = rule.root_url;
    var country = rule.country;
    if (!country && rule.rule)
        country = rule.rule.country;
    be_lib.perr(zerr.L.INFO, {id: 'commercial_promote_subscription',
        info: {history: E.history, rule: rule}});
    if (!www_config.commercial_promo_enabled)
        return false;
    var active_tab = be_tabs.get('active.id');
    B.tabs.create({
        url: 'https://hola.org/get_commercial?url='+host+'&country='+country,
        active: true,
    });
    B.tabs.remove(active_tab);
    return true;
};
E.is_enabled = function(){
    if (!www_config.commercial_enabled)
        return false;
    return Date.now()-E.install_ts > enable_timeout;
};
E.is_tracked_rule = function(rule){
    return rule.enabled!=0;
};
E.is_commercial_user = function(){
    return premium.is_active() && premium.is_paid();
};
E.is_commercial_host = function(host){
    return E.hosts.includes(host);
};
E.excessive_usage = function(host){
    E.clean_usage(host);
    return (E.history[host]||[]).length >= hist_length;
};
E.clean_usage = function(host){
    var host_usage = this.history[host]||[];
    var ts = Date.now();
    E.history[host] = host_usage.filter(function(access){
        return ts-access.ts < hist_age;
    });
};
E.is_allowed = function(rule){
    if (!E.is_tracked_rule(rule) || !E.is_enabled() || E.is_commercial_user())
        return true;
    if (!rule || !rule.root_url)
        return true;
    var host = rule.root_url;
    if (!E.is_commercial_host(host))
        return true;
    return !E.excessive_usage(host);
};
E.track_usage = function(rule, proxy_change){
    if (!E.is_tracked_rule(rule))
        return;
    proxy_change = proxy_change || false;
    var host = rule.root_url;
    if (!E.is_commercial_host(host))
        return;
    E.clean_usage(host);
    E.history[host].unshift({
        rule: rule,
        ts: Date.now(),
        proxy_change: proxy_change,
    });
    if (E.history[host].length > hist_length)
        E.history[host].pop();
    E.save();
};
E.refresh_hosts = function(){
    return etask([function(){
        return ajax.json({
            slow: 2000,
            url: conf.url_ccgi+'/commercial_hosts.json',
        });
    }, function(hosts){
        E.hosts = hosts;
        E.save();
        return hosts;
    }]);
};
E.refresh = function(){
    return etask([function(){
        return etask.all({
            hosts: E.refresh_hosts(),
            membership: premium.refresh_membership(),
            www_config: be_util.get_www_config(),
        });
    }, function(ret){
        www_config = ret.www_config;
    }, function catch$(err){
        be_lib.perr(zerr.L.ERR, {id: 'commercial_refresh_fail',
            info: {history: E.history, err: {message: err.message, stack:
            err.stack}}});
    }, function finally$(){
        clearTimeout(commercial_timeout);
        commercial_timeout = setTimeout(function(){
            E.sp.spawn(E.refresh()); }, Math.random()*refresh_timeout);
    }]);
};
E.load = function(){
    E.hosts = storage.get_json('be_commercial_hosts')||[];
    E.history = storage.get_json('be_commercial_history')||{};
};
E.save = function(){
    storage.set_json('be_commercial_hosts', E.hosts);
    storage.set_json('be_commercial_history', E.history);
};
E.init = function(){
    E.install_ts = storage.get_int('install_ts');
    E.load();
    E.sp = etask('be_commercial', [function(){ return this.wait(); }]);
    E.sp.spawn(E.refresh());
    E.listenTo(be_tabs, 'updated', function(obj){
        if (!obj.info.url)
            return;
        if (obj.info.url.match(/^https:\/\/hola.org\/get_commercial.html/))
        {
            /* When paying using PayPal, the user may complete a purchase
             * without reaching the thank you page, or reach it before the
             * IPN is received and the membership updated */
            clearTimeout(commercial_timeout);
            commercial_timeout = setTimeout(function(){
                E.sp.spawn(E.refresh()); }, refresh_timeout);
        }
    });
};
E.uninit = function(){
    E.sp.return();
    clearTimeout(commercial_timeout);
};
return E; });
