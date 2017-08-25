// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['jquery', 'underscore', '/bext/pub/backbone.js', '/util/etask.js',
    '/util/zerr.js', '/bext/pub/util.js', '/bext/pub/lib.js',
    '/bext/pub/browser.js', '/bext/vpn/pub/svc.js', '/bext/vpn/pub/mode.js',
    '/util/storage.js'],
    function($, _, be_backbone, etask, zerr, be_util, be_lib, B, be_svc,
    be_mode, storage){
B.assert_bg('be_ccgi');
var conf = window.conf, zconf = window.zon_config;
var E = new be_backbone.model();

E.init = function(be_ext){
    if (E.inited)
        return;
    E.inited = true;
    E.init_ts = Date.now();
    E.sp = etask('be_ccgi', [function(){ return this.wait(); }]);
    E.be_ext = be_ext;
    E.be_mode = be_mode;
    E.listening = false;
    E.listen_to(be_ext, 'change:ext.slave', function(){
        var slave = be_ext.get('ext.slave');
        if (slave==false)
            start_listen();
        else if (slave==true)
            stop_listen();
    });
    E.on('destroy', uninit);
};

function uninit(){
    E.sp.return();
    stop_listen();
}

function start_listen(){
    if (E.listening)
        return;
    B.be.ccgi.add_listener(ccgi_ipc_handler);
    E.listening = true;
}

function stop_listen(){
    if (!E.listening)
        return;
    B.be.ccgi.del_listener(ccgi_ipc_handler);
    E.listening = false;
}

function ccgi_resp(msg, resp_cb){
    // XXX bahaa/arik: rm defer once we are sure we can call B api inside a B
    // listner
    _.defer(B.be.ccgi.send, msg, resp_cb);
    return true;
}

/* must return true if you want to reply on message */
function ccgi_ipc_handler(msg, resp_cb, sender){
    if (msg._type && msg._type!='ccgi')
        return;
    var RMT = window.RMT;
    switch (msg.id)
    {
    case 'callback':
        E.sp.spawn(etask({cancel: true}, [function(){
            if (E.hola_ff!==undefined || !B.have['be.getenv'])
                return this.goto('ret');
            return etask.cb_apply(B.be, '.getenv', ['HOLA_FF']);
        }, function(r){
            E.hola_ff = !!r;
        }, function ret(){
            msg.data = {
                init_ts: E.init_ts,
                install_ts: storage.get_int('install_ts'),
                connected: E.be_ext.get('enabled'),
                disable: !E.be_ext.get('enabled'),
                uuid: E.be_ext.get('uuid'),
                session_key: E.be_ext.get('session_key')||0,
                session_key_cid: E.be_mode.get('svc.session_key_cid')||0,
                ver: be_util.version(),
                plugin: E.be_mode.get('mode')=='dll',
                mode: E.be_mode.get('mode'),
                mode_duration: Date.now() - E.be_mode.get('ts'),
                pending: E.be_mode.get('pending'),
                type: conf.type,
                cid: E.be_mode.get('svc.cid'),
                browser: E.be_ext.get('browser'),
                release: zconf._RELEASE,
                rmt_ver: E.be_ext.get('rmt_ver'),
                svc_mode: be_mode.get('mode'),
                svc_mode_pending: be_mode.get('pending'),
                plugin_final_error: be_mode.get('plugin.final_error'),
                svc_info: E.be_mode.get('svc.info'),
                build_info: be_util.build_info(),
                hola_ff: E.hola_ff,
            };
            ccgi_resp(msg, resp_cb);
        }]));
        return true;
    case 'svc_callback':
        msg.data = null;
        E.sp.spawn(etask({name: 'svc_callback', cancel: true}, [function(){
            return be_svc.callback({raw: 1});
        }, function(r){
            r.from_be = true;
            msg.data = r;
            ccgi_resp(msg, resp_cb);
        }, function catch$(){ ccgi_resp(msg, resp_cb); }]));
        return true;
    case 'update_rules':
        msg.data = {};
        try { RMT.update_rules(false); } catch(e){}
        return ccgi_resp(msg, resp_cb);
    case 'enable': E.be_ext._set('enabled', !!msg.data); break;
    case 'vpn_enable':
        msg.data = {};
        E.sp.spawn(etask({name: 'vpn_enable', cancel: true}, [function(){
            if (!RMT || !RMT.be_vpn)
                return msg.data.err = 'no be_vpn';
            return RMT.be_vpn.enable();
        }, function catch$(err){ return msg.data.err = ''+err;
        }, function finally$(){ return ccgi_resp(msg, resp_cb); }]));
        return true;
    case 'perr':
        be_lib.perr(zerr.L.NOTICE, {id: msg.perr_id,
            info: JSON.parse(msg.info)});
        break;
    case 'set_rule':
        msg.data = {};
        if (!RMT || !RMT.be_vpn || !RMT.be_vpn.be_rule)
            return msg.data.err = 'no be_rule';
        E.sp.spawn(etask({name: 'set_rule', cancel: true}, [function(){
            return RMT.be_vpn.be_rule.set_rule(msg.opt);
        }, function catch$(err){ return msg.data.err = ''+err;
        }, function finally$(){
            if (!msg.no_resp)
                ccgi_resp(msg, resp_cb);
        }]));
        return !msg.no_resp;
    case 'fetch_rules':
        msg.data = {};
        if (!RMT || !RMT.be_vpn || !RMT.be_vpn.be_rule)
            return msg.data.err = 'no be_rule';
        E.sp.spawn(etask({name: 'fetch_rules', cancel: true}, [function(){
            return RMT.be_vpn.be_rule.fetch_rules();
        }, function(){ return msg.data.rules = RMT.be_vpn.be_rule.get('rules');
        }, function catch$(err){ return msg.data.err = ''+err;
        }, function finally$(){
            if (!msg.no_resp)
                ccgi_resp(msg, resp_cb);
        }]));
        return !msg.no_resp;
    case 'enable_root_url':
        msg.data = {};
        if (!RMT || !RMT.be_vpn)
            return msg.data.err = 'no be_vpn';
        E.sp.spawn(etask({name: 'enable_root_url', cancel: true}, [function(){
            return RMT.be_vpn.enable_root_url(msg.opt);
        }, function(rule){ return msg.data.rule = rule;
        }, function catch$(e){ return msg.data.err = ''+e;
        }, function finally$(){
            if (!msg.no_resp)
                ccgi_resp(msg, resp_cb);
        }]));
        return !msg.no_resp;
    case 'refresh_membership':
        if (RMT && RMT.be_premium)
            E.sp.spawn(RMT.be_premium.refresh_membership(msg.data));
        break;
    case 'refresh_commercial':
        if (RMT && RMT.be_commercial)
            E.sp.spawn(RMT.be_commercial.refresh(msg.data));
        break;
    case 'ping': /* handled by be_bg_main */ break;
    case 'set_dont_show_again':
        try { E.sp.spawn(RMT.be_info.set_dont_show_again(msg.data)); }
        catch(e){}
        break;
    case 'opts_set': be_util.zopts.set(msg.data.key, msg.data.val); break;
    // XXX pavlo: sent by old extensions, where cs_inject.js is still embedded
    case 'cs_inject':
        if (!sender.tab || !sender.tab.id)
            break;
        // prevents injection (checked in cs_inject.js)
        delete msg.id;
        return ccgi_resp(msg, resp_cb);
    default: zerr('unknown ccgi message '+zerr.json(msg));
    }
}

return E; });
