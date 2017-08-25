// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
// XXX arik/mark: review together backbone usage
define(['jquery', 'underscore', '/util/etask.js', '/bext/pub/backbone.js',
    '/bext/pub/browser.js', '/util/zerr.js', '/svc/pub/util.js',
    '/util/date.js', '/util/storage.js', '/bext/pub/util.js',
    '/util/url.js', '/bext/pub/ext.js', '/util/escape.js',
    '/bext/vpn/pub/ajax.js'],
    function($, _, etask, be_backbone, B, zerr, svc_util, date,
    storage, be_util, zurl, be_ext, zescape, ajax){
B.assert_bg('be_tabs');
var be_rules;
var chrome = window.chrome;
var E = new (be_backbone.model.extend({
    _defaults: function(){ this.on('destroy', function(){ E.uninit(); }); },
}))();

function active_cb(){
    etask({name: 'active_cb', cancel: true}, [function(){
	return E.get_tab(E.get('active.real.id'));
    }, function(tab){
	if (tab && chrome)
	{
	    // don't change tab if new tab is developer tools
	    if ((tab.url||'').startsWith(
		'chrome-devtools://devtools/bundled/devtools.html'))
	    {
		return;
	    }
	}
        E.set({'active.id': tab ? tab.id : undefined,
            'active.url': tab ? tab.url : '',
            'active.status': tab ? tab.status : '',
            'active.incognito': tab ? tab.incognito : false,
        });
    }, function catch$(err){
        zerr('be_tabs_active_cb_err: '+err);
    }]);
}

function is_active(id){ return id==E.get('active.real.id'); }

var tab_trace = {};
function page_trace(details, msg, clear){
    if (!details)
        return;
    var is_main = chrome ? !details.frameId && (!details.type ||
        details.type=='main_frame') : details.is_main;
    if (!is_main)
        return;
    var tab_id = details.tabId;
    if (clear)
        page_trace_del(tab_id);
    var trace = tab_trace[tab_id] = tab_trace[tab_id]||[];
    var ts = details.timeStamp;
    var from_start = trace[0] ? ts-trace[0].ts : 0;
    var prev = trace.length ? trace[trace.length-1] : null;
    if (prev)
        prev.duration = ts-prev.ts;
    var status = details.statusCode||(prev&&prev.status)||'0';
    trace.push({ts: ts, real_ts: Date.now(), from_start: from_start, msg: msg,
        status: status});
}

function page_trace_del(tab_id){
    delete tab_trace[tab_id];
}

E.get_trace = function(tab_id){
    var trace = tab_trace[tab_id];
    if (!trace || !trace.length)
        return trace;
    trace[trace.length-1].duration = Date.now()-trace[trace.length-1].real_ts;
    return trace;
};

function on_created(tab){
    set_url(tab.id, tab.url);
    E.trigger('created', {tab: tab});
}

function on_updated(id, info, tab){
    if (!info.url && !info.status) // other changes aren't interesting
	return;
    set_url(id, info.url);
    if (is_active(id))
        E.sp.spawn(active_cb());
    E.trigger('updated', {id: id, info: info, tab: tab});
}

function on_activated(info){ E.set('active.real.id', info.tabId); }

function on_removed(id, info){
    del_tab(id);
    track_redirect_del(id);
    page_trace_del(id);
    E.trigger('removed', {id: id, info: info});
}

function on_replaced(added, removed){
    del_tab(removed);
    track_redirect_del(removed);
    page_trace_del(removed);
    if (is_active(removed))
        E.set('active.real.id', added);
    E.trigger('replaced', {added: added, removed: removed});
}

// alexeym: handler for network/DNS errors
// XXX alexeym: need to check these errors
var chrome_error_list = ['ACCESS_DENIED', 'BLOCKED_BY_ADMINISTRATOR',
    'CONNECTION_REFUSED', 'CONNECTION_FAILED', 'NAME_NOT_RESOLVED',
    'ADDRESS_UNREACHABLE', 'CERT_ERROR_IN_SSL_RENEGOTIATION',
    'NAME_RESOLUTION_FAILED', 'NETWORK_ACCESS_DENIED',
    'SSL_HANDSHAKE_NOT_COMPLETED', 'SSL_SERVER_CERT_CHANGED',
    'CERT_COMMON_NAME_INVALID', 'CERT_AUTHORITY_INVALID',
    'CERT_CONTAINS_ERRORS', 'CERT_INVALID', 'INVALID_RESPONSE',
    'EMPTY_RESPONSE', 'INSECURE_RESPONSE', 'DNS_MALFORMED_RESPONSE',
    'DNS_SERVER_FAILED', 'DNS_SEARCH_EMPTY'];
function on_error_occured(info){
    if (info.frameId!=0)
        return;
    var err = info.error||'';
    err = err.split('::ERR_')[1];
    if (chrome && (!err || !chrome_error_list.includes(err)))
        return;
    info.http_status_code = 0;
    E.trigger('error_occured', {id: info.tabId, info: info});
}

function to_form_data(o){
    var data = new FormData();
    for (var k in o)
        data.append(k, o[k]);
    return data;
}

function send_beacon(url, data){
    data.send_type = 'POST';
    var req = new XMLHttpRequest();
    req.open('POST', url);
    req.send(to_form_data(data));
}

var vstat = {};
function vstat_init(){
    var err_count = 0;
    E.sp.spawn(vstat.sp=etask({cancel: true}, [function loop(){
        return etask.sleep(30*date.ms.MIN);
    }, function(){
        if (!vstat.stats)
            return this.goto('loop');
        var qs = {ver: (window.RMT||{}).ver||be_util.version(),
            browser: chrome ? 'chrome' : 'firefox'};
        var url = 'http://perr-vstat.h-cdn.com/vstat.json?'+zescape.qs(qs);
        var _sp = ajax.json({timeout: 20000, method: 'POST', url: url,
            data: {stats: vstat.stats}, no_throw: true});
        delete vstat.stats;
        return _sp;
    }, function(e){
        if (this.error || e.err || e.error)
        {
            err_count++;
            if (this.error)
            {
                // XXX colin: add perr
                //be_lib.perr_err({id: 'be_vstat_send_err', err: this.error});
            }
            if (err_count>30)
                return;
        }
        return this.goto('loop');
    }, function finally$(){
        delete vstat.sp;
    }]));
}

function vstat_uninit(){
    if (vstat.sp)
        vstat.sp.return();
    vstat = {};
}

function update_vstat_hdr(){
    var vstat_hdr = (be_ext.get('bext_config')||{}).vstat_hdr;
    if (vstat_hdr==E.vstat_hdr)
        return;
    E.vstat_hdr = vstat_hdr;
    vstat_uninit();
    if (E.vstat_hdr)
        vstat_init();
}

function vstat_hdr(tab_url, url, hdrs, status, from_cache, completed){
    // XXX colin: use nodify_res
    // XXX colin: add support for cached content 304
    var content_type, content_length, transfer_encoding;
    if (!tab_url || !hdrs || !url || from_cache)
        return;
    for (var i=0; i<hdrs.length; i++)
    {
        var h = hdrs[i];
        var name = h.name.toLowerCase();
        if (name=='content-type')
            content_type = h.value;
        else if (name=='content-length')
            content_length = h.value;
        else if (name=='transfer-encoding')
            transfer_encoding = h.value;
        if ((content_length || transfer_encoding=='chunked') && content_type)
            break;
    }
    if (!/video\/.*/.test(content_type||''))
        return;
    var root_url = get_root_url(tab_url);
    if (!vstat.stats)
        vstat.stats = {};
    var vs = vstat.stats[root_url] = vstat.stats[root_url]||{ln_h: 0, ln_b: 0,
        ch: 0, ev: 0, ct: content_type, st: {}};
    if (!root_url)
    {
        vs.url = url;
        vs.tab_url = tab_url;
    }
    if (!isNaN(content_length))
        vs['ln_'+(completed ? 'b' : 'h')] += +content_length;
    else if (transfer_encoding=='chunked' && !completed)
        vs.ch++;
    if (!completed)
        vs.ev++;
    vs.st[status] = vs.st[status]||0;
    vs.st[status]++;
}

function on_body_received(details){
    if (E.vstat_hdr)
    {
        vstat_hdr(E.get_url(details.tabId), details.url,
            details.responseHeaders, details.statusCode, details.fromCache, 1);
    }
}

// alexeym: handler for 'normal' error states (404, 502, etc)
var status_rx = /^HTTP\/[^\s]+\s(\d\d\d)\s/;
function on_headers_received(details){
    if (!details)
        return;
    var is_main = chrome ? !details.frameId && details.type=='main_frame' :
        details.is_main;
    if (E.vstat_hdr)
    {
        vstat_hdr(E.get_url(details.tabId), details.url,
            details.responseHeaders, details.statusCode, details.fromCache);
    }
    if (!is_main)
        return;
    var status = details.statusCode;
    if (status===undefined)
    {
        status = details.statusLine;
        if (typeof status!='string')
            return;
        status = status.match(status_rx);
        status = status && status[1] ? status[1] : null;
        if (status===null)
            return; // XXX alexeym: never should happen, need to add perr
    }
    else
        status += '';
    details.statusCode = status;
    page_trace(details, 'on_headers_received');
    if (status=='301' || status=='302')
    {
        track_redirect({id: details.tabId, url: details.url, info: details});
        return;
    }
    if (!{4: 1, 5: 1}[status[0]])
        return;
    E.trigger('error_occured', {id: details.tabId, info:
        {http_status_code: status, type: details.type}});
}

var cache_clean = ['*://*/*wor*/*i*/1*.js'];
function on_headers_received_cache(details){
    // redirect (?ts=...) `cache_clean` requests only from unblocked pages
    var tab_url = nav_tabs[details.tabId];
    if (!be_rules||!tab_url)
        return;
    var root_url = get_root_url(tab_url);
    var rule = _.findWhere(be_rules.get_rules().unblocker_rules, {enabled:
        true, link: root_url});
    if (!rule)
        return;
    return {redirectUrl: zescape.uri(details.url, {ts: +rule.ts})};
}

function on_focused(id){
    if (id===B.windows.WINDOW_ID_NONE)
        return;
    E.set('active.window.id', id);
    B.tabs.query({active: true, windowId: id}, function(tabs){
        if (tabs.length)
            E.set('active.real.id', tabs[0].id);
    });
}
/**
 * Map of all tabs (including pre-rendered). Format: tab_id: url.
 */
var nav_tabs = {};
function on_before_navigate(info){
    // ignore iframes
    if (!info.frameId)
        nav_tabs[info.tabId] = info.url;
    page_trace(info, 'before_navigate', true);
    if (!info.frameId && is_active(info.tabId)) // main frame of active
        active_cb();
}

function on_completed(info){
    page_trace(info, 'completed');
    if (is_active(info.tabId))
        active_cb();
    E.trigger('completed', info);
}

function on_committed(details){
    page_trace(details, 'committed');
    E.trigger('committed', {id: details.tabId, info: details});
    if (!details.frameId && details.tabId && details.url)
    {
        var qualifiers = details.transitionQualifiers;
        if (qualifiers && qualifiers.includes('client_redirect'))
        {
            track_redirect({id: details.tabId, url: details.url,
                info: details});
        }
        // clear history on manual user action (input, click)
        else if (!qualifiers.includes('server_redirect'))
            delete tabs_redirect[details.tabId];
        last_committed[details.tabId] = get_root_url(details.url);
    }
    // XXX arik/shachar: enable and use be_tabs.on('reload') to verify proxy if
    // reloading a tab with rule enabled
    if (false && details.transitionType=='reload')
        E.trigger('reload', details);
}

function get_root_url(url){
    url = zurl.parse(url);
    if (!url.hostname || !url.protocol)
        return;
    url = url.protocol+'//'+url.hostname+'/';
    return svc_util.get_root_url(url);
}

var tabs_redirect = {}, last_committed = {};
function track_redirect(tab){
    if (!chrome || !tab || tab.id===undefined || !tab.url)
        return;
    var list = tabs_redirect[tab.id];
    if (!list)
        list = tabs_redirect[tab.id] = {};
    var last_url = last_committed[tab.id];
    var from_url = get_root_url(tab.url);
    var to_url;
    var headers = tab.info && tab.info.responseHeaders;
    if (headers)
    {
        _.each(headers, function(header){
            if (header.name.toLowerCase()=='location')
                to_url = header.value;
        });
        to_url = to_url ? get_root_url(to_url) : undefined;
    }
    if (!to_url && tab.info && tab.info.transitionQualifiers)
    {
        to_url = get_root_url(tab.url);
        from_url = last_url;
    }
    if (!from_url || !to_url || from_url==to_url)
        return;
    var now = Date.now();
    list[to_url] = {from: from_url, ts: now};
    setTimeout(function(){
        var url = list[to_url];
        if (url && url.ts==now)
            delete list[to_url];
    }, 120*date.ms.SEC);
}

function get_redirect_sequence(tab_id, url, ts_limit, limit){
    var urls = [];
    var list = tabs_redirect[tab_id];
    if (!list)
        return urls;
    limit = limit||4;
    var parent_url;
    while (parent_url = list[url])
    {
        if (parent_url.ts<=ts_limit)
            break;
        urls.unshift(parent_url.from);
        url = parent_url.from;
    }
    return urls.splice(0, limit);
}

function track_redirect_del(tab_id){
    if (tab_id===undefined)
        return;
    delete last_committed[tab_id];
    delete tabs_redirect[tab_id];
}

E.get_redirect_list = function(tab_id){
    var time_limit = Date.now()-(120*date.ms.SEC);
    var active_url = E.get('active.url');
    active_url = active_url && get_root_url(active_url);
    return get_redirect_sequence(tab_id, active_url, time_limit);
};

E.init = function(){
    if (E.inited)
        return;
    E.sp = etask('be_tabs', [function(){ return this.wait(); }]);
    E.listen_to(be_ext, 'change:r.ext.enabled', update_state);
    E.listen_to(be_ext, 'change:bext_config', update_vstat_hdr);
    E.urls = {};
    B.tabs.query({}, function(tabs){
        if (!tabs)
            return;
        for (var i=0; i<tabs.length; i++)
            set_url(tabs[i].id, tabs[i].url);
    });
    B.windows.get_last_focused({}, function(win){
        if (win)
            on_focused(win.id);
    });
    B.tabs.on_created.add_listener(on_created);
    B.tabs.on_updated.add_listener(on_updated);
    B.tabs.on_activated.add_listener(on_activated);
    B.tabs.on_removed.add_listener(on_removed);
    B.tabs.on_replaced.add_listener(on_replaced);
    B.windows.on_focus_changed.add_listener(on_focused);
    set_navigation_listeners();
    E.on_init('change:active.real.id', active_cb);
    B.backbone.server.start(E, (B.is_rmt ? 'r.' : '')+'be_tabs');
    E.inited = true;
};

E.set_rules = function(_be_rules){
    if (be_rules)
        return;
    be_rules = _be_rules;
    // clean in-memory requests cache to have ability to handle all files and
    // redirect some of them
    be_rules.on('before_rule_set', function(){
        handler_behavior_changed();
    });
};

E.uninit = function(){
    if (!E.inited)
        return;
    E.sp.return();
    B.backbone.server.stop((B.is_rmt ? 'r.' : '')+'be_tabs');
    B.tabs.on_created.del_listener(on_created);
    B.tabs.on_updated.del_listener(on_updated);
    B.tabs.on_activated.del_listener(on_activated);
    B.tabs.on_removed.del_listener(on_removed);
    B.tabs.on_replaced.del_listener(on_replaced);
    B.windows.on_focus_changed.del_listener(on_focused);
    del_navigation_listeners();
    E.stopListening(be_ext);
    E.inited = false;
    E.urls = undefined;
};

function set_navigation_listeners(){
    if (E.nav_listening)
        return;
    E.nav_listening = true;
    // XXX bahaa: implement for firefox
    if (B.have['web_navigation.on_before_navigate'])
        B.web_navigation.on_before_navigate.add_listener(on_before_navigate);
    if (B.have['web_navigation.on_completed'])
        B.web_navigation.on_completed.add_listener(on_completed);
    if (B.have['web_navigation.on_error_occured'])
        B.web_navigation.on_error_occured.add_listener(on_error_occured);
    if (B.have['web_navigation.on_committed'])
        B.web_navigation.on_committed.add_listener(on_committed);
    if (B.have['web_request.on_headers_received'])
    {
        B.web_request.on_headers_received.add_listener(on_headers_received,
            {urls: ['<all_urls>']}, ['responseHeaders']);
        B.web_request.on_headers_received.add_listener(
            on_headers_received_cache, {urls: cache_clean},
            ['blocking', 'responseHeaders']);
    }
    if (B.have['web_request.on_body_received'])
    {
        B.web_request.on_body_received.add_listener(on_body_received,
            {urls: ['<all_urls>']}, ['responseHeaders']);
    }
}

function handler_behavior_changed(){
    if (B.have['web_request.handler_behavior_changed'])
        B.web_request.handler_behavior_changed();
}

function del_navigation_listeners(){
    if (!E.nav_listening)
        return;
    E.nav_listening = false;
    if (B.have['web_navigation.on_before_navigate'])
        B.web_navigation.on_before_navigate.del_listener(on_before_navigate);
    if (B.have['web_navigation.on_completed'])
        B.web_navigation.on_completed.del_listener(on_completed);
    if (B.have['web_navigation.on_committed'])
        B.web_navigation.on_committed.del_listener(on_committed);
    if (B.have['web_navigation.on_error_occured'])
        B.web_navigation.on_error_occured.del_listener(on_error_occured);
    if (B.have['web_request.on_headers_received'])
    {
        B.web_request.on_headers_received.del_listener(on_headers_received);
        B.web_request.on_headers_received.del_listener(
            on_headers_received_cache);
    }
    if (B.have['web_request.on_body_received'])
        B.web_request.on_body_received.del_listener(on_body_received);
}

E.get_tab = function(tab_id){
    if (!tab_id)
	return null;
    return etask.cb_apply(B.tabs, '.get', [tab_id]);
};

function del_tab(id){
    delete nav_tabs[id];
    if (!E.urls[id])
        return;
    delete E.urls[id];
    E.trigger('url_updated', id);
}

function set_url(id, url){
    if (!url || url==E.urls[id])
        return;
    E.urls[id] = url;
    E.trigger('url_updated', id, url);
}

function update_state(){
    var is_enabled = be_ext.get('r.ext.enabled');
    if (E.is_enabled==is_enabled)
        return;
    E.is_enabled = is_enabled;
    del_navigation_listeners();
    if (!E.is_enabled)
        return;
    set_navigation_listeners();
}

E.get_url = function(tab_id){ return E.urls && E.urls[tab_id]; };

E.active = function(){ return E.get_tab(E.get('active.id')); };

return E; });
