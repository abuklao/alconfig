// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['jquery', 'underscore', '/bext/pub/backbone.js', '/util/etask.js',
    '/bext/vpn/pub/util.js', '/svc/pub/util.js',
    '/util/version_util.js', '/util/zerr.js', '/bext/pub/util.js',
    '/bext/pub/locale.js', '/bext/vpn/pub/social.js',
    '/bext/pub/browser.js', '/util/url.js', '/util/string.js',
    '/bext/pub/popup_lib.js', '/protocol/pub/countries.js',
    '/www/util/pub/user_navbar.js', '/svc/pub/search.js', '/util/date.js',
    'backbone', '/util/user_agent.js', '/util/storage.js',
    '/bext/vpn/pub/defines.js', '/util/util.js', '/bext/pub/ga.js',
    '/util/zdot.js', 'text!views/share', 'text!views/cross_sale',
    'text!views/install_exe', '/util/escape.js', 'text!views/ext_promo',
    'text!views/ext_promo_rating', 'text!views/country_list_item',
    'text!views/popup_disabled'],
    function($, _, be_backbone, etask, be_vpn_util, svc_util,
    version_util, zerr, be_util, T, be_social, B, zurl, string, be_popup_lib,
    pcountries, user_navbar, search, date, Backbone, user_agent, storage,
    be_defines, zutil, ga, zdot, share, cross_sale, install_exe,
    zescape, ext_promo, ext_promo_rating, country_list_item, popup_disabled){
B.assert_popup('be_ui_vpn');
var E = new (be_backbone.model.extend({
    _defaults: function(){ this.$el = $('<div>', {class: 'be_ui_vpn'}); },
}))();
var SEC = date.ms.SEC, assign = Object.assign;
var browser = be_util.browser();
var chrome = window.chrome, is_tpopup = window.is_tpopup;
var is_torch = be_util.detect_torch();
var is_mp_ui = !window.is_tpopup;
var animation_time = 300;
var countries;

function ff_dropdown_resize_cb(){
    var opened = $('.dropdown.open').length||$('.navbar-nav li.open').length;
    if (!opened)
        $('.f_ff_dropdown_fixup').remove();
    else if (!$('.f_ff_dropdown_fixup').length)
        $('<div>', {class: 'f_ff_dropdown_fixup'}).appendTo($('body'));
    ff_dropdown_resize();
}

/* XXX arik/bahaa BACKWARD: ugly hack to fix popup resize on ff. the dropdown
 * is absulte position and in firefox we have a bug where it doesn't take
 * absolute elements into account when resizing the popup */
function ff_dropdown_resize(){
    if (chrome || version_util.cmp(be_util.version(), '1.2.726')>=0)
        return;
    setTimeout(ff_dropdown_resize_cb, 500);
}

function g_switch_cb(){
    // XXX alexeym: unify this check with similar in ui_popup_ext.js
    if (E.be_ext.get('ext.conflict'))
        return;
    zerr.notice('on/off clicked');
    set_user_cmd({label: 'g_switch', cmd: 'on_off', country: ''});
}

E.get_enabled_rule = function(){
    var rules = be_vpn_util.get_rules(E.be_rule.get('rules'), E.get_url());
    if (!rules || !rules[0] || !rules[0].enabled || !E.be_ext.get('r.vpn.on'))
        return null;
    return rules[0];
};

function msg_handler(msg){
    // no origin check, this message triggered for site on-click
    // to close tpopup
    if (msg.data && msg.data.id=='cs_tpopup.hide_anim')
        $('body').addClass('hide_anim');
}

E.init = function(ui_popup){
    if (E.inited)
        return;
    window.addEventListener('message', msg_handler, false);
    E.on('destroy', function(){
        E.sp.return();
        window.removeEventListener('message', msg_handler, false);
    });
    E.inited = true;
    E.sp = etask('be_ui_vpn', [function(){ return this.wait(); }]);
    E.ui_popup = ui_popup;
    E.R = ui_popup.R;
    E.be_vpn = ui_popup.be_vpn;
    E.be_tpopup = E.be_vpn.be_tpopup;
    E.be_rule = ui_popup.be_rule;
    E.be_info = ui_popup.be_info;
    E.be_tabs = ui_popup.be_tabs;
    E.be_ext = ui_popup.be_ext;
    E.be_svc = ui_popup.be_svc;
    E.be_mode = ui_popup.be_mode;
    E.be_premium = ui_popup.be_premium;
    E.be_commercial = ui_popup.be_commercial;
    E.conf = E.R.get('conf');
    ff_dropdown_resize();
    pcountries.add_il();
    countries = _.sortBy(pcountries.proxy_countries.bext.map(function(c){
        return {proxy_country: c, name: T(c)}; }), 'name');
    countries.get = function(c){
        return {proxy_country: c, name: T(c.toUpperCase())}; };
    init_footer();
    init_status();
    init_state();
    init_country();
    init_verify_proxy();
    init_tpopup();
    if (!is_tpopup && E.be_tpopup)
    {
        E.listenTo(E.be_tpopup, 'change:tpopup_type', function(){
            if (E.be_tpopup.get('tpopup_type')=='svc_require')
                on_close_button();
        });
    }
    E.be_rule.trigger('fetch_rules');
    // XXX arik NOW: review all listeners below
    E.on_init('change:country change:active.root_url', _.debounce(E.ui_init));
    E.on_init('change:country change:active.url', _.debounce(rule_rating_cb));
    E.on('change:status', _.debounce(busy_slow_cb));
    E.listen_to(E.be_tabs, 'change:active.status', loading_site_slow_cb);
    E.on('change:active.user_url', active_url_cb);
    E.listen_to(E.be_tabs, 'change:active.url', active_url_cb);
    E.listenTo(E.be_tabs, 'completed error_occured', function(info){
        if (!info || !info.tabId)
            return;
        var fix_task = fix_tasks[info.tabId];
        if (!fix_task)
            return;
        if (!fix_task.fix_waiting)
            return;
        fix_task.continue();
    });
    E.listenTo(E.be_info, 'change:status', status_cb);
    E.listenTo(E.be_rule, 'change:status', status_cb);
    E.listenTo(E.be_info, 'change:status_opt', status_cb);
    E.listenTo(E.be_rule, 'change:status_opt', status_cb);
    setTimeout(function(){
        E.on_init('change:state change:status change:rule_ratings.root_url '+
            'change:rule_ratings.groups change:unblocking_rate', E.render);
        E.listenTo(E.be_rule, 'change:verify_proxy_ret', E.render);
        E.listenTo(E.be_tabs, 'change:active.status', E.render);
    }, 10);
    E.listen_to(E.be_ext, 'change:metro', render_warnings);
    add_user_nav();
    E.sp.spawn(etask({cancel: true}, [function(){
        return E.be_premium.ecall('is_active', []);
    }, function(have_premium){ E.set('have_premium', !!have_premium); }]));
    $('#g_switch').click(g_switch_cb);
    E.on('destroy', function(){ $('#g_switch').off('click', g_switch_cb); });
};

E.ui_init = function(){
    set_user_cmd({label: 'ui_init', cmd: '', country: '', no_busy: true}); };

var status_cb = _.debounce(function(){
    var prev = E.get('status');
    var s1 = E.be_rule.get('status'), s2 = E.be_info.get('status');
    var _new = [s1, s2].includes('error') ? 'error' :
        [s1, s2].includes('busy') ? 'busy' : 'ready';
    zerr.notice('status %s > %s (%s %s)', prev, _new, s1, s2);
    E.set({prev_status: prev, status: _new,
        status_opt: E.be_rule.get('status_opt')||E.be_info.get('status_opt')});
});

function busy_slow_cb(){
    busy_slow_cb.timer = clearTimeout(busy_slow_cb.timer);
    if (E.get('status')!='busy')
        return;
    // XXX arik: need to reduce time
    busy_slow_cb.timer = setTimeout(function(){
        be_popup_lib.perr_err({id: 'be_ui_vpn_busy_slow'});
        busy_slow_cb.timer = setTimeout(function(){
            be_popup_lib.perr_err({id: 'be_ui_vpn_busy_very_slow'});
        }, 13*SEC);
    }, 7*SEC);
}

function loading_site_slow_cb(){
    if (!chrome) // XXX arik/bahaa: add tab status support for firefox
        return;
    loading_site_slow_cb.timer = clearTimeout(loading_site_slow_cb.timer);
    if (E.be_tabs.get('active.status')=='complete')
        return;
    loading_site_slow_cb.timer = setTimeout(function(){
        delete loading_site_slow_cb.timer;
        var r = E.get_enabled_rule();
        if (!r)
            return;
        be_popup_lib.perr_err({id: 'be_ui_vpn_loading_slow', info: {
            root_url: E.get_root(), url: E.get_url(),
            rule: {name: r.name, country: r.country}}});
    }, 15*SEC);
}

function active_url_cb(){
    var prev = E.get_root();
    var tpopup_url = window.hola && window.hola.tpopup_opt &&
        window.hola.tpopup_opt.url;
    var qs = !is_tpopup && (zurl.parse(window.top.location.href).search||'');
    var url = tpopup_url || E.get('active.user_url') ||
        qs && zurl.qs_parse(qs).url || E.be_tabs.get('active.url') || '';
    E.set({'active.url': url, 'active.root_url': svc_util.get_root_url(url)});
    if (prev && prev!=E.get_root() && !E.get('active.user_url'))
    {
        var info = {root_url: E.get_root(), root_url_prev: prev,
            ext_enabled: E.be_ext.get('r.ext.enabled')};
        if (window.hola)
            info.t = Date.now()-window.hola.t.l_start;
        be_popup_lib.perr_err({id: 'be_ui_vpn_root_url_changed', info: info});
    }
}

// XXX arik/eilam: need test
E.get_url = function(){ return E.get('active.url')||''; };
E.get_root = function(){ return E.get('active.root_url')||''; };
E.get_host = function(){ return zurl.get_host(E.get_url()); };

function set_active_url(host, country, disable){
    var url = '';
    return etask([function(){
        // XXX arik bug: rule_ratings_cb may be called twice in this scenrio
        // (once we call explicity and one auto-called by change:active.url
        return rule_rating_cb();
    }, function(){
        var popular = get_popular_country(host);
        country = country || popular[0].proxy_country;
        if (!disable && !check_before_unblock(host, country))
            return this.return();
        url = get_unblock_url(host, country);
        E.set('active_url', url);
        E.set('navigating_to', {host: host, country: country});
    }, function(){
        if (E.get('status')!='busy')
            return;
        E.once('change:status', function(){ this.continue(); }.bind(this));
        return this.wait(5*SEC);
    }, function catch$(err){
        be_popup_lib.perr_err({id: 'be_set_active_url_err', info: url,
            err: err});
        this.goto('update_tab');
    }, function update_tab(){
        B.tabs.update(E.be_tabs.get('active.id'), {url: url, active: true});
    }]);
}

function init_search(search_container, opt){
    var country = (E.get('country')||'us').toLowerCase();
    var s = new search.search({country: country,
        settings: assign({}, opt,
        {no_redir: true, suggest_remote: E.conf.url_ccgi+
            '/autocomplete?src_country='+(country||'us')+'&search=%QUERY'}),
        on_select: function(d){
            d = zurl.parse(d).host;
            if (!zurl.is_valid_domain(d))
                return E.set('active.user_url', '');
            s.$input.blur();
            set_active_url(d);
            be_popup_lib.perr_ok({id: 'be_search', info: d});
    }});
    s.render(search_container);
    return s;
}

function get_is_reminder(){
    return window.hola && window.hola.tpopup_opt &&
        window.hola.tpopup_opt.is_reminder;
}

function get_unblocking_rate(){
    var limit = 6;
    return etask([function(){
        return E.be_info.ecall('get_unblocking_rate', [limit]);
    }, function(unblocking_rate){ E.set('unblocking_rate', unblocking_rate);
    }]);
}

function rule_rating_cb(){
    var root_url, rule_ratings;
    return etask([function(){
        if (!E.get('country'))
            return this.return();
        root_url = E.get_root();
        if (E.skip_url()||get_is_reminder())
            return this.return(get_unblocking_rate());
        if (E.get('rule_ratings.root_url')==root_url)
            return this.return();
        var rule_enabled = E.get_enabled_rule();
        return E.be_rule.ecall('get_rule_ratings',
            [{root_url: root_url, src_country: E.get('country'), limit: 20,
            proxy_country: rule_enabled&&rule_enabled.country,
            vpn_only: true}]);
    }, function(ratings){
        rule_ratings = ratings;
        E.set({rule_ratings: ratings, 'rule_ratings.root_url': root_url});
        if (!ratings)
            return this.return();
        return E.be_rule.ecall('get_groups_from_ratings', [ratings]);
    }, function(groups){
        // XXX arik: add groups, don't replace
        E.set({'rule_ratings.groups': groups});
        if (!rule_ratings||!groups)
            return;
        rule_ratings.forEach(function(country_ratings){
            _.forEach(country_ratings.rules, function(r){
                if (r.rating<=0||!groups)
                    return;
                if (!svc_util.find_rule(groups.unblocker_rules, r))
                {
                    be_popup_lib.perr_err({id: 'be_ui_vpn_rating_no_rule',
                        info: {rule: r, ratings: rule_ratings,
                        groups: groups}});
                    return;
                }
            });
        });
    }, function catch$(err){
        E.set({rule_ratings: undefined, 'rule_ratings.root_url': root_url});
        be_popup_lib.perr_err({id: 'be_ui_vpn_rule_ratings_err', err: err,
            info: root_url});
    }]);
}

E.set_err = function(id, err){
    E.set('error', id);
    E.ui_popup.set_err(id, err);
};

function init_footer(){
    var cb = _.debounce(function(){
        E.footer_inited = true;
        update_footer();
    });
    E.listenTo(E.be_rule, 'change:rules', cb);
    E.on_init('change:active.url', cb);
}

function init_status(){
    if (!E.loader)
    {
        var $status = $('<div>', {class: 'popup-status'});
        E.loader = new loader_view_class();
        E.loader.render($status);
        $status.insertBefore('#popup');
    }
    var loader_options = {timeout: 15*SEC};
    var cb = _.debounce(function(){
        if (!E.loader)
            return;
        var verify_proxy_ret = E.be_rule.get('verify_proxy_ret')||{};
        var ui_status = E.get('ui_status');
        var loading = chrome && E.be_tabs.get('active.status')!='complete'
            ||E.redirect_page();
        if (E.get('hide_loader'))
            E.loader.stop(true);
        else if (E.get('status')=='busy' || ui_status=='busy')
            E.loader.start(loader_options);
        else if (verify_proxy_ret.error && E.get('state')=='enable')
            E.loader.finish();
        else if (loading && E.get('state')=='enable')
            E.loader.start(loader_options);
        else
            E.loader.finish();
    });
    E.on_init('change:status change:status_opt change:ui_status '+
        'change:ui_status_opt change:state change:hide_loader', cb);
    E.listenTo(E.be_rule, 'change:verify_proxy_ret', cb);
    E.listenTo(E.be_tabs, 'change:active.status', cb);
}

function update_footer(){
    if (!E.footer_inited || !E.is_visible)
        return;
    var rule_enabled = E.get_enabled_rule();
    var root_url = rule_enabled ? E.get_root() : null;
    var $td;
    $td = $('#footer .r_ui_premium').empty();
    $('<a>', {href: 'https://hola.org/access/popular', target: '_blank'})
    .text(T('Popular sites')).appendTo($td);
    $('#content').show();
    $('#footer .popup-footer-content').empty().append(
        (new ext_promo_view_class()).render().$el);
    if (is_mp_ui)
        return;
    $td = $('#footer .r_ui_share').empty();
    add_footer_sharing($td, root_url, rule_enabled);
}

function add_footer_sharing($td, root_url, rule_enabled){
    if (version_util.cmp(be_util.version(), '1.1.777')<=0)
        return;
    var link = get_sharing_link(rule_enabled);
    be_social.init_globals(root_url, E.get('country'), link);
    E.social_sharing = new be_social.SocialSharing({
        tooltip: false,
        mailto_frame: !!chrome,
        perr: function(id, share){
            be_popup_lib.perr_ok({id: id, info: assign({share: share,
                root_url: E.get_root(), url: E.get_url(),
                src_country: E.get('country').toLowerCase(),
                proxy_country:
                    (rule_enabled&&rule_enabled.country||'').toLowerCase()},
                _.pick(rule_enabled||{}, 'name', 'type', 'md5'))});
        }
    });
    $td.prepend(E.social_sharing.$el);
}

function get_unblock_url(domain, country){
    domain = domain || '';
    country = (country || '').toLowerCase();
    var proto = E.be_ext.get('use_http') ? 'http' : 'https';
    if (!domain)
        return get_popular_url();
    return proto+'://hola.org/access/'+domain+'/using/vpn-'
            +country+'?go=2';
}

function get_sharing_link(rule_enabled){
    var root_url = E.get_root();
    var proto = E.be_ext.get('use_http') ? 'http' : 'https';
    var link = proto+'://hola.org/access/popular';
    var rule = rule_enabled;
    if (rule)
    {
        // XXX arik: reuse www/pub/unblock_util.js:E.rule_unblock_url
        link = proto+'://hola.org/access/'+root_url+'/using/vpn-'
        +rule.country.toLowerCase();
    }
    return link;
}

function add_user_nav(){
    if (version_util.cmp(be_util.version(), '1.1.609')<=0)
        return;
    var user_status = E.ui_popup.nav && E.ui_popup.nav.model;
    var nav = user_navbar.new_user_nav({upgrade: true, login: true,
        be_premium: E.be_premium, user_status: user_status,
        settings_handler: E.ui_popup.open_settings,
        social_sharing: E.ui_popup.social_sharing});
    E.on('destroy', function(){ nav.remove(); });
    if (window.popup_main && window.popup_main.uninit_user_nav)
        window.popup_main.uninit_user_nav();
    if (E.ui_popup.nav)
        E.ui_popup.nav.remove();
    E.ui_popup.nav = nav;
    E.mode_listening = false;
    $('#header .popup-header-controls-left').prepend(nav.$el);
}

function set_country_rule(proxy_country, disable, rule_enabled){
    var root_url = E.get_root();
    if (!disable && !check_before_unblock(root_url, proxy_country))
        return;
    return etask([function(){
        proxy_country = proxy_country.toLowerCase();
        var cmd = disable ? 'disable' : 'enable';
        if (!disable)
        {
            if (rule_enabled && rule_enabled.country==proxy_country)
                return this.return();
            return set_active_url(root_url, proxy_country);
        }
        set_user_cmd({label: 'set_country_disable', cmd: cmd,
            country: proxy_country, no_busy: !rule_enabled});
        if (!rule_enabled)
        {
            be_popup_lib.perr_err({id: 'be_ui_vpn_set_country_nothing',
                info: {proxy_country: proxy_country, disable: disable,
                name: rule_enabled&&rule_enabled.name}});
        }
        else
        {
            return E.script_set(rule_enabled, {enabled: false,
                root_url: root_url});
        }
    }, function catch$(err){ E.set_err('be_ui_vpn_set_country_rule', err); }]);
}

function get_popular_country(host){
    return be_vpn_util.get_popular_country({host: host||E.get_host(),
        rule_ratings: !host&&E.get('rule_ratings')});
}

function set_working(){
    var rule_enabled = E.get_enabled_rule();
    var root_url = E.get_root();
    /* XXX arik: need limit on number of entries */
    var j = storage.get_json('vpn_working')||{};
    j[root_url] = {working: 1, name: rule_enabled.name};
    storage.set_json('vpn_working', j);
    refresh_sharing();
}

function clr_working(){
    var root_url = E.get_root();
    var j = storage.get_json('vpn_working')||{};
    delete j[root_url];
    storage.set_json('vpn_working', j);
    refresh_sharing();
}

function is_working(){
    var root_url = E.get_root();
    var rule_enabled = E.get_enabled_rule();
    var j = (storage.get_json('vpn_working')||{})[root_url];
    return rule_enabled && j && j.working && j.name==rule_enabled.name;
}

function refresh_sharing($o){
    if (is_working())
    {
        $('.sharing-obj').show();
        if ($o)
            $o.show();
    }
    else
    {
        $('.sharing-obj').hide();
        if ($o)
            $o.hide();
    }
}

function init_state(){
    var cb = _.debounce(state_cb);
    E.on_init('change:user.cmd change:user.country change:status '+
        'change:active.root_url change:country', cb);
    E.listenTo(E.be_rule, 'change:rules', cb);
    E.listenTo(E.be_ext, 'change:r.vpn.on', cb);
}

function init_verify_proxy(){
    var cb = _.debounce(function(){
        var rule_enabled = E.get_enabled_rule();
        if (E.get('user.cmd')||rule_enabled)
        {
            E.off('change:user.cmd', cb);
            E.stopListening(E.be_rule, 'change:rules', cb);
        }
        if (!E.get('user.cmd') && rule_enabled)
            E.verify_proxy(rule_enabled, 'popup_open');
    });
    E.on_init('change:user.cmd', cb);
    E.listenTo(E.be_rule, 'change:rules', cb);
}

// XXX alexeym: merge with be_ui_mp & move into be_ui_popup_ext
function on_close_button(e){
    if (e)
        e.stopPropagation();
    if (!E.ui_popup)
    {
        if (is_tpopup)
            parent.postMessage({id: 'tpopup.close'}, '*');
        return;
    }
    if (!is_tpopup)
        return E.ui_popup.close_popup();
    E.ui_popup.set_dont_show_again({root_url: E.get_root(),
        period: 'session', src: 'x_btn',
        tab_id: window.hola.tpopup_opt.tab_id,
        type: window.hola.tpopup_opt.type});
}

function init_tpopup(){
    if (!is_tpopup)
        return;
    // XXX arik/mark: need proper tooltip api and mv styles to css
    var $el, $hint, timer;
    var root_url = E.get_root();
    function dont_show_for_current_url(e){
        e.stopPropagation();
        E.ui_popup.set_dont_show_again({root_url: root_url, src: 'x_tooltip',
            period: 'default', type: window.hola.tpopup_opt.type});
    }
    function dont_show_for_all(e){
        e.stopPropagation();
        E.ui_popup.set_dont_show_again({root_url: 'all', period: 'default',
            src: 'x_tooltip', type: window.hola.tpopup_opt.type});
    }
    $el = $('#tpopup_close').off('click mouseenter mouseleave');
    $hint = $('#tpopup_close_hint').on({mouseenter: function(){
        timer = clearTimeout(timer);
        $hint.fadeIn();
    }, mouseleave: function(){
        timer = setTimeout(function(){ $hint.fadeOut(); }, animation_time);
    }});
    $el.on({click: on_close_button,
        mouseenter: function(){
            var new_root_url = E.get_root();
            timer = clearTimeout(timer);
            if (root_url!=new_root_url)
            {
                root_url = new_root_url;
                $hint.empty();
                $('<div>', {class: 'hint_dont_show'})
                .text(T('Don\'t show again')).appendTo($hint);
                $('<div>', {class: 'hint_option'})
                .html(T('for <b>$1</b> for one week', [root_url]))
                .click(dont_show_for_current_url).appendTo($hint);
                $('<div>', {class: 'hint_option'}).click(dont_show_for_all)
                .html(T('for <b>any site</b> for one week')).appendTo($hint);
            }
            $hint.fadeIn();
        },
        mouseleave: function(){
            timer = setTimeout(function(){ $hint.fadeOut(); },
                animation_time);
        }
    });
}

function init_country(){
    var sent_perr;
    E.on('destroy', function(){
        init_country.timer = clearTimeout(init_country.timer); });
    E.listen_to(E.be_info, 'change:location', function location_cb(){
        var loc = E.be_info.get('location');
        var c = loc&&loc.country;
        E.set('country', c||'');
        if (!c)
            return;
        E.stopListening(E.be_info, 'change:location', location_cb);
        init_country.timer = clearTimeout(init_country.timer);
        if (E.get('country')&&sent_perr)
        {
            be_popup_lib.perr_err({id: 'be_ui_vpn_no_country_recover',
                info: {country: E.get('country')}});
        }
    });
    init_country.timer = setTimeout(function(){
        if (!E.get('country')&&!sent_perr)
        {
            sent_perr = true;
            be_popup_lib.perr_err({id: 'be_ui_vpn_no_country',
                info: {url: E.get_url(),
                be_info: {country: E.be_info.get('country'),
                    location: E.be_info.get('location')},
                status: {
                    rmt: E.R.get('status')+' '+
                        (E.R.get('inited') ? 'inited' : 'not_inited'),
                    be_vpn: E.be_vpn.get('status'),
                    be_rule: E.be_rule.get('status'),
                    be_info: E.be_info.get('status'),
                }
            }});
        }
    }, 3*SEC);
}

// XXX arik: need test
function state_cb(){
    var rule_enabled = E.get_enabled_rule();
    var redirect_page = E.redirect_page();
    var curr = E.get('state'), next;
    var status = E.get('status');
    var cmd = E.get('user.cmd'), user_opt = E.get('user.opt');
    var info = {state: curr, url: E.get_url(), root_url: E.get_root(),
        prev_url: E.get('prev_url'), prev_root: E.get('prev_root'),
        user_opt: user_opt, status: status};
    if (redirect_page)
        rule_enabled = redirect_page;
    if (rule_enabled)
    {
        info.name = rule_enabled.name;
        info.country = rule_enabled.country;
    }
    if (E.skip_url())
        next = 'skip_url';
    else if (status=='error')
        next = 'error';
    else if ({enable: 1, disable: 1}[cmd])
        next = cmd;
    else if (rule_enabled||redirect_page)
        next = 'enable';
    else
        next = E.get('active.url') ? E.get('state') : 'disable';
    E.set('prev_url', E.get_url());
    E.set('prev_root', E.get_root());
    E.set('state', next);
    if (curr!=next)
        zerr.notice('state %s > %s', curr, next);
    if (status!='busy')
    {
        var send_perr;
        info.next = next;
        info.ext_enabled = E.be_ext.get('r.ext.enabled');
        if (rule_enabled)
        {
            info.rule_enabled = {name: rule_enabled.name,
                country: rule_enabled.country};
        }
        if (cmd=='enable'&&!rule_enabled)
            send_perr = true;
        if (cmd=='disable'&&rule_enabled)
            send_perr = true;
        if (cmd=='enable' && rule_enabled &&
            rule_enabled.country!=user_opt.country.toLowerCase())
        {
            send_perr = true;
            info.mismatch_country = rule_enabled.country;
        }
        // XXX arik NOW: send perr if root_url doesn't match current rule
        if (send_perr)
        {
            if (window.hola)
                info.t = Date.now()-window.hola.t.l_start;
            be_popup_lib.perr_err({id: 'be_ui_vpn_state_mismatch_user_action',
                info: info});
        }
    }
}

// XXX arik/eilam: need test
E.skip_url = function(){
    var url = E.get_url();
    if (!url)
        return true;
    var protocol = zurl.get_proto(url);
    var host = E.get_host();
    return !E.get_root() || host.search(/^(.*\.)?hola.org$/)!=-1 &&
        url.search(/access\/([^\/]*)\/using\/.*/) == -1 ||
        zurl.is_ip_port(host) || protocol.search(/^(http|https)$/)==-1 ||
        host=='localhost' || !zurl.is_valid_domain(host);
};

E.redirect_page = function(url){
    var redirect_regexp = /hola\.org\/access\/([^/]*)\/using\/vpn-([^?/]*)$/gi;
    var redirect_match = redirect_regexp.exec(E.get_url());
    if (!redirect_match)
        return;
    return {name: redirect_match[1], country: redirect_match[2]};
};

E.is_popular_page = function(url){
    var popular_regexp = /hola\.org\/access\/popular.*$/gi;
    url = url || E.get_url();
    return popular_regexp.test(url);
};

// XXX arik: need generic hanlding of ui_status
E.change_proxy = function(rule, desc){
    return etask('change_proxy', [function(){
        E.set('ui_status', 'busy');
        E.set('ui_status_opt', {desc: 'Finding new peers...'});
        var verify_proxy_ret = E.be_rule.get('verify_proxy_ret')||{};
        return E.be_rule.ecall('change_proxy_wait', [{
            rule: rule, desc: desc, root_url: E.get_root(),
            zgettunnels_retry: be_defines.ZGETTUNNELS_RETRY,
            verify_proxy_ret: verify_proxy_ret}]);
    }, function(ret){
        // XXX arik/shachar hack: temporary hack till fixing tab_unblocker
        // to reload relevant tabs after zagent update
        B.tabs.reload(E.be_tabs.get('active.id'));
        E.unset('ui_status');
        E.unset('ui_status_opt');
    }, function catch$(err){
        E.unset('ui_status');
        E.unset('ui_status_opt');
        be_popup_lib.perr_err({id: 'be_change_proxy_err', err: err});
    }]);
};

E.verify_proxy = function(rule, desc){
    return etask('verify_proxy', [function(){
        E.set('ui_status', 'busy');
        E.set('ui_status_opt', {desc: 'Testing connection...'});
        return E.be_rule.ecall('verify_proxy_wait', [{rule: rule,
            desc: desc, zgettunnels_retry: be_defines.ZGETTUNNELS_RETRY,
            root_url: E.get_root()}]);
    }, function(){
        E.unset('ui_status');
        E.unset('ui_status_opt');
    }, function catch$(err){
        E.unset('ui_status');
        E.unset('ui_status_opt');
        be_popup_lib.perr_err({id: 'be_verify_proxy_err', err: err});
    }]);
};

function render_warnings(){
    $('.r_warnings').remove();
    var $error_holder = $('#popup');
    var $el = $('<div>', {class: 'r_warnings'}).insertBefore($error_holder);
    var $msg, br_ver = user_agent.guess_browser().version;
    var ff_upgrade = !chrome && version_util.cmp(br_ver, '23')<0;
    if (ff_upgrade)
    {
        $msg = $('<div>', {class: 'r_ui_vpn_compat'})
        .appendTo($el).append($('<span>'+
            T('Old version of Firefox. Press <a>here</a> to upgrade.')
            +'</span>'),
            $('<div>').text(T(
                '(some Hola features are not available on your version)')));
        $msg.find('a').attr('target', '_blank').attr('href',
            'http://www.mozilla.org/en-US/firefox/update/');
    }
    if (E.be_ext.get('metro'))
    {
        $('<div>', {class: 'r_ui_vpn_compat'})
        .appendTo($el).append($('<span>'+T(
            'Hola does not work well in Windows 8 mode. Please switch to '+
            'desktop mode. Click <a>here</a> for instructions')+'</span>'))
        .find('a').attr('target', '_blank').attr('href',
            'https://support.google.com/chrome/answer/2762879?hl='+T.locale);
    }
    if (is_chrome_incognito())
    {
        $('<div>', {class: 'r_ui_vpn_compat'})
        .appendTo($el).append($('<span>'+T(
            'Sorry, Hola does not work in Incognito mode.<br>'+
            'Please switch to regular mode to view this site')+'</span>'));
    }
}

function $new_popular_block(p){
    var custom_icon = p.root_url.replace(/\./g, '-');
    var $ret = $('<div>', {class: 'popup-popular-item', title: p.root_url})
    .click(function(){
        var is_mac = B.os == 'macos';
        if (!is_mac || !E.is_popular_page())
            return set_active_url(p.root_url);
        perr_event('popular_unblock_attempt', {
            info: {unblock_attempt_url: p.root_url}
        });
        return B.tabs.create({url: get_popular_url(), active: true});
    });
    var $icon_div = $('<i>', {class: 'popup-popular-item-image icon-'
        +custom_icon})
    .appendTo($ret);
    $('<span>', {class: 'popup-popular-item-name'}).text(p.root_url)
    .appendTo($ret);
    var icon = new Image();
    icon.src = zurl.add_proto(p.root_url)+'/favicon.ico';
    icon.className = 'popup-popular-item-icon';
    icon.onload = function(){ $icon_div.append(icon); };
    icon.onerror = function(){ $icon_div.addClass('icon-error'); };
    return $ret;
}

function get_popular_url(){
    var country = E.get('country');
    var proto = E.be_ext.get('use_http') ? 'http' : 'https';
    return proto+'://hola.org/access/popular'+
        (country ? '/'+country : '')+'?utm_source=holaext';
}

var country_list_head_view_class = Backbone.View.extend({
    el: '<span>',
    initialize: function(options){
        var $el = this.$el;
        var opt = this.options = options||{};
        var size = 'f' + (opt.size ? opt.size : 'svg_4x3');
        var $a = $('<a>', {class: size}).appendTo($el);
        this.$flag = $('<span>', {class: 'flag'}).appendTo($a);
        this.$label = $('<div>', {class: 'r_list_head_label'}).appendTo($el);
    },
    render: function(opt){
        var c = opt.country ? opt.country.proxy_country : '';
        this.$flag.attr('class', 'flag')
        .addClass(c.toLowerCase()||'flag_other');
        if (this.options.fade_head)
            this.$flag.addClass('flag_fade');
        var uc = c.toUpperCase();
        var label_text = uc && T(uc);
        this.$label.text(label_text||T('More...'));
    },
});

var country_list_item_template = zdot.template(country_list_item);

function get_country_list_item(c, disable){
    return country_list_item_template({country: c.proxy_country, name: c.name,
        disable: disable});
}

function unsupported_open(type, domain, country){
    var src_country = E.get('country').toLowerCase();
    var perr = type.replace(/-/g, '_');
    be_popup_lib.perr_ok({id: 'be_ui_vpn_click_unsupported_open_'+perr, info: {
        src: 'ext',
        browser: browser,
        root_url: domain,
        ext_ver: be_util.version(),
        url: E.get_url(),
        src_country: src_country,
        proxy_country: country,
        host: E.get_host()
    }});
    var reasons = {
        country: 'country_disabled',
        site: 'host_blacklisted',
        'not-working': 'not_working'
    };
    var alternative_url = best_url({
        root_url: domain,
        proxy_country: country,
        reason: reasons[type],
        is_blacklist: type=='site'
    });
    var url = zescape.uri('https://hola.org/unsupported/'+type,
        {domain: domain, country: country, alternative_url: alternative_url});
    E.ui_popup.open_page(url);
}

/**
 * @param opt Url parameters.
 * @param opt.root_url Domain to unblock.
 * @param opt.proxy_country Unblocking country.
 * @param opt.reason Reason for redirection. E.g. country_disabled.
 * @param [opt.rating] Rating chosen by user.
 * @param [opt.is_blacklist=false] Whether it's a blacklisted domain.
 */
function best_url(opt){
    var src_country = E.get('country').toLowerCase();
    return zescape.uri('https://hola.org/best/domain/'+opt.root_url,
        {}, {src: 'ext', browser: browser,
        reason: opt.reason, root_url: opt.root_url,
        ext_ver: be_util.version(), url: E.get_url(),
        src_country: src_country, proxy_country: opt.proxy_country,
        rating: opt.rating, host: E.get_host(), is_blacklist: opt.is_blacklist
    });
}

function best_open(proxy_country, reason, rating){
    be_popup_lib.perr_ok({id: 'be_ui_vpn_click_flag_best_open_'+reason});
    var root_url = E.get_root();
    E.ui_popup.open_page(best_url({
        root_url: root_url,
        proxy_country: proxy_country,
        reason: reason,
        rating: rating
    }));
}

// XXX colin/shachar: move google to be in blacklist
function is_google(root_url){
    return root_url.split('.')[0]=='google';
}

function is_blacklist(root_url, host){
    // XXX colin: if blacklisted make sure to disable rule for root_url of url
    var blacklist = (E.be_rule.get('rules')||{}).blacklist||{};
    return is_google(root_url) || blacklist[host] || blacklist[root_url];
}

function is_country_unsupported(country){
    var unsupported = ['il'];
    return unsupported.includes(country.toLowerCase());
}

/**
 * @param host Full host name.
 * @param country Two-letter (ISO 3166-1 alpha-2) country code.
 * @returns {boolean} Whether we can start unblocking.
 */
function check_before_unblock(host, country){
    if (!E.be_ext.get('enable_unsupported'))
        return true;
    country = country.toLowerCase();
    var domain = svc_util.get_root_domain(host);
    if (domain.includes('hola.org'))
        return false;
    if (is_blacklist(domain, host))
        unsupported_open('site', domain, country);
    else if (is_country_unsupported(country))
        unsupported_open('country', domain, country);
    else if (is_chrome_incognito())
        unsupported_open('incognito', domain, country);
    else
        return true;
    return false;
}

function is_chrome_incognito(){
    return chrome && chrome.extension && E.be_tabs.get('active.incognito');
}

var country_list_view_class = Backbone.View.extend({
    el: '<span>',
    className: 'r_country_list_view',
    events: {
        'click .list_head': 'toggle_list',
    },
    render_opt: {},
    initialize: function(options){
        options = options||{};
        this.no_dropdown = options.no_dropdown;
        this.no_search = options.no_search;
        var $el = this.$el;
        var $list = this.$list = $('<span>', {class: 'dropdown r_country_list'+
            (this.no_dropdown ? '' : ' r_country_list_dropdown')});
        $el.append($list);
        var $head = $('<a>', {class: 'list_head btn '+
            'r_btn-trans r_btn-rm-border '+
            (this.no_dropdown ? 'no-dropdown' : ''),
            'data-toggle': this.no_dropdown || options.on_click ?
                undefined : 'dropdown'}).appendTo($list);
        if (options.on_click)
            $head.click(options.on_click);
        this.country_list_head_view = new country_list_head_view_class({
            fade_head: options.fade_head,
            show_lock: options.show_lock,
            size: options.flag_size,
        });
        if (!this.no_dropdown || options.show_lock)
        {
            var $caret_parent = this.country_list_head_view.$('.flag')
                .parent();
            var $caret = $('<span>', {class: 'caret'});
            $caret.click(function(){ ff_dropdown_resize(); })
            .appendTo($caret_parent);
        }
        $head.append(this.country_list_head_view.$el);
        if (this.no_dropdown)
            return;
        $('body').on('click.country_list_click', this.hide_list.bind(this));
        this.$ul = $('<div>', {class: 'dropdown-menu country-selection'})
        .on('click', function(evt){
            evt.stopPropagation(); });
        if (!this.no_search)
        {
            this.$search = $('<div>', {class: 'country-selection-search'})
            .appendTo(this.$ul);
            $('<li>', {class: 'divider'}).appendTo(this.$ul);
            this.search_term = '';
        }
        this.$li_list = $('<ul>', {role: 'menu'}).appendTo(this.$ul);
    },
    render: function(opt){
        var _this = this;
        opt = opt||{};
        var active_country = opt.active_country;
        this.country_list_head_view.render({country:
            active_country ? countries.get(active_country) : undefined});
        if (this.no_dropdown)
            return;
        this.$list.one('show.bs.dropdown', function(){
            _this.render_list(opt); });
        if (!_.isEqual(opt, this.render_opt))
            _.defer(function(){ this.render_list(opt); }.bind(this));
        this.render_opt = opt;
        if (!opt.no_search)
            this.render_search(opt);
    },
    toggle_list: function(e){
        if (this.no_dropdown || !this.$ul)
            return;
        e.stopPropagation();
        this.$ul.toggleClass('dropdown-menu-open');
        E.set('hide_loader', this.$ul.hasClass('dropdown-menu-open'));
        this.trigger('toggle_list');
    },
    hide_list: function(e){
        E.unset('hide_loader');
        if (!this.$ul)
            return;
        if (e)
            e.stopPropagation();
        this.$ul.removeClass('dropdown-menu-open');
        this.trigger('toggle_list', 'hide');
    },
    remove: function(){
        if (this.$ul)
            this.$ul.remove();
        $('body').off('click.country_list_click');
        Backbone.View.prototype.remove.call(this);
    },
    /**
     * @param {string} [opt.host] Custom host for unblock. Default is current
     * page's host. Example: 'example.com'.
     * @param {boolean} [opt.no_back=false] Remove 'Back to [user_country]'
     * list item.
     * @param {string} [opt.active_country]
     */
    render_list: function(opt){
        var _this = this;
        opt = opt||{};
        var active_country = opt.active_country;
        var p = get_popular_country(opt.host);
        var src_country = E.get('country');
        var list_html = '';
        if (!_this.search_term)
        {
            if (active_country && !opt.no_back)
            {
                var src = countries.get(src_country);
                list_html += get_country_list_item({
                    proxy_country: src.proxy_country,
                    name: T('Back to $1', [src.name]),
                }, true);
            }
            _.forEach(p, function(p){
                list_html += get_country_list_item(
                    countries.get(p.proxy_country), false);
            });
            list_html += '<li class="divider"></li>';
        }
        var filtered_countries = countries.filter(function(c){
            return !_this.search_term || c.name.toLowerCase()
                .startsWith(_this.search_term.toLowerCase());
        });
        filtered_countries.forEach(function(c){
            list_html += get_country_list_item(c, false);
        });
        this.$li_list.off('click');
        this.$li_list.on('click', '.country', function(){
            var rule_enabled = !opt.host ? E.get_enabled_rule() : null;
            var info = $(this).data();
            if (!info.disable)
                be_popup_lib.perr_ok({id: 'be_ui_vpn_click_flag'});
            _this.trigger('select', info.country);
            _this.hide_list();
            if (opt.host)
                set_active_url(opt.host, info.country, info.disable);
            else
                set_country_rule(info.country, info.disable, rule_enabled);
        });
        this.$li_list.html(list_html);
    },
    render_search: function(opt){
        var _this = this;
        var $input = $('<input>', {type: 'text', placeholder:
            T('Search a country')});
        $input.val(this.search_term);
        this.$search.html($input);
        $(this.$search).off('keyup', 'input');
        $(this.$search).on('keyup', 'input',
            _.debounce(function(evt){
                evt.stopPropagation();
                _this.search_term = evt.target.value;
                _this.render_list(opt);
            }, 100));
    },
});

var country_selection_view_class = Backbone.View.extend({
    className: 'r_country_selection_view',
    host: null,
    active_country: null,
    initialize: function(opt){
        var _this = this;
        opt = opt||{};
        this.host = opt.host;
        this.active_country = opt.active_country;
        var $el = this.$el;
        var $row;
        $row = $('<div>').appendTo($el);
        if (is_tpopup)
        {
            this.list_all = new country_list_view_class({fade_head: true,
                show_lock: true,
                no_dropdown: true,
                on_click: function(){
                    this.trigger('select', this.p0);
                    this._set_country_rule(this.p0, E.get_enabled_rule());
                }.bind(this)});
            this.list_all.$el.addClass('country_selection_opt').appendTo($row);
        }
        else
        {
            this.is_multiselect = true;
            $row = $('<div>').appendTo($el);
            this.list_p0 = new country_list_view_class({caret: false,
                no_dropdown: true, className: 'country_selection_opt'});
            this.list_p0.$el.addClass('country_selection_opt '+
                'country_selection_left').appendTo($row)
            .click(function(){
                be_popup_lib.perr_ok({id: 'be_ui_vpn_click_flag'});
                this.trigger('select', this.p0);
                this._set_country_rule(this.p0, null);
            }.bind(this));
            this.list_p1 = new country_list_view_class({caret: false,
                no_dropdown: true, className: 'country_selection_opt'});
            this.list_p1.$el.addClass('country_selection_opt '+
                'country_selection_center').appendTo($row)
            .click(function(){
                be_popup_lib.perr_ok({id: 'be_ui_vpn_click_flag'});
                this.trigger('select', this.p1);
                this._set_country_rule(this.p1, null);
            }.bind(this));
            $row.append(this.list_p0.$el).append(this.list_p1.$el);
            this.list_all = new country_list_view_class();
            this.list_all.on('toggle_list', this.toggle_more.bind(this));
            this.list_all.$el.addClass('country_selection_opt '+
                'country_selection_right')
            .appendTo($row);
            var country_events = {
                mouseenter: function(){
                    var $this = $(this);
                    var $other = $row.find('.country_selection_opt')
                        .not(this);
                    $other.removeClass('popup-multiselect-hover')
                    .addClass('popup-multiselect-blur');
                    $this.removeClass('popup-multiselect-hover')
                    .addClass('popup-multiselect-hover');
                    _this._trigger_list_event('mouseenter', $this);
                },
                mouseleave: function(){
                    $row.find('.country_selection_opt')
                    .removeClass('popup-multiselect-hover')
                    .removeClass('popup-multiselect-blur');
                    _this._trigger_list_event('mouseleave', $(this));
                }
            };
            this.list_p0.$el.on(country_events);
            this.list_p1.$el.on(country_events);
            this.list_all.$el.on(country_events);
        }
        if (this.list_all && this.list_all.$ul)
            this.list_all.$ul.appendTo($('body'));
        this.list_all.on('select', function(){
            _this.trigger('select'); });
        return $el;
    },
    _trigger_list_event: function(name, $el){
        var list_num;
        if ($el.hasClass('country_selection_left'))
            list_num = 0;
        else if ($el.hasClass('country_selection_center'))
            list_num = 1;
        else
            list_num = 2;
        this.trigger('list:'+name, list_num);
    },
    _set_country_rule: function(country, rule_enabled){
        if (this.host)
            set_active_url(this.host, country);
        else
            set_country_rule(country, false, rule_enabled);
    },
    toggle_more: function(action){
        if (action == 'hide')
        {
            this.list_all.$el.addClass('country_selection_right');
            this.list_all.$el.removeClass('country_selection_center');
            this.list_p0.$el.show();
            this.list_p1.$el.show();
            return;
        }
        this.list_all.$el.toggleClass('country_selection_right');
        this.list_all.$el.toggleClass('country_selection_center');
        this.list_p0.$el.toggle();
        this.list_p1.$el.toggle();
    },
    render: function(){
        var popular_countries = get_popular_country(this.host);
        var tld = be_vpn_util.get_tld_country(this.host||E.get_host());
        // XXX: alexeym: for new UI country multi-country view
        // order should be "second, main, other"
        var main = this.is_multiselect ? 1 : 0;
        var second = this.is_multiselect ? 0 : 1;
        var ratings = [popular_countries[0], popular_countries[1]];
        if (tld && tld!=ratings[0].proxy_country &&
            tld!=ratings[1].proxy_country)
        {
            ratings.push({proxy_country: tld, rating: 0.1});
            ratings.sort(function(a, b){ return b.rating-a.rating; });
        }
        this['p'+main] = ratings[0].proxy_country;
        this['p'+second] = ratings[1].proxy_country;
        if (is_tpopup)
            this.list_all.render({active_country: this.p0, no_back: true});
        else
        {
            this.list_p0.render({active_country: this.p0});
            this.list_p1.render({active_country: this.p1});
            this.list_all.render({active_country: this.active_country, host:
                this.host});
        }
        return this;
    },
});
var disable_view_class = Backbone.View.extend({
    className: 'popup-enabled popup-multiselect',
    hover_title: null,
    initialize: function(opt){
        opt = opt||{};
        var $el = this.$el;
        this.hover_title = opt.title_view || new title_view_class({
            title: T('Select a country'), no_search: is_tpopup});
        var $title = this.hover_title.$el;
        this.country_selection_view = opt.country_selection_view ||
            new country_selection_view_class();
        if (this.country_selection_view.is_multiselect)
        {
            var $hover_title = this.hover_title.$title;
            $hover_title.append(
                '<i class="popup-multiselect-arrow '+
                'popup-multiselect-arrow-left"></i>'+
                '<i class="popup-multiselect-arrow '+
                'popup-multiselect-arrow-right"></i>');
            var events = {
                'list:mouseenter': function(list_num){
                    $hover_title.addClass('list-hover-'+list_num
                        +' list-hover');
                },
                'list:mouseleave': function(list_num){
                    $hover_title.removeClass('list-hover-'+list_num
                        +' list-hover');
                },
            };
            this.country_selection_view.on(events);
        }
        $el.append($title, this.country_selection_view.$el);
    },
    render: function(){
        this.hover_title.render();
        this.country_selection_view.render();
        $('body').addClass('is-popup-disabled');
        return this;
    }
});
var turned_off_view_class = Backbone.View.extend({
    className: 'popup-disabled',
    template: zdot.template(popup_disabled),
    initialize: function(){
        var className = this.className;
        var html = this.template({class_name: className});
        this.$el.css({padding: '0'}).html(html);
        this.$head = this.$el.find('.'+className+'-icon');
    },
    render: function(){
        this.$head.off('click').one('click', function(){
            setTimeout(function(){
                $('#g_switch').click(); }, animation_time);
        });
        $('body').addClass('is-popup-off');
    }
});

var country_selected_view_class = Backbone.View.extend({
    className: 'country_selected',
    initialize: function(){
        var $el = this.$el, $row;
        if (is_tpopup)
        {
            // XXX shachar: remove _virt_track_activation as it seems to be
            // used only for tracking number of tpopup activations using
            // google-analytics, it's better to just use perr
            // $('<iframe width=0 height=0 style="display:none" src=//hola.org'
            // +'/_virt_track_activation><iframe>').appendTo($el);
            be_popup_lib.perr_ok({id: 'be_tpopup_open'});
        }
        else
        {
            $row = $('<div>').appendTo($el);
            $('<div>', {class: 'icon_arrow'}).appendTo($row);
        }
        $row = $('<div>').appendTo($el);
        this.list_view = new country_list_view_class();
        $row.append(this.list_view.$el);
        if (this.list_view && this.list_view.$ul)
        {
            if (is_tpopup)
                this.list_view.$ul.appendTo($el);
            else
                this.list_view.$ul.appendTo('body');
        }
    },
    render: function(){
        var status = E.get('status');
        var rule_enabled = E.get_enabled_rule();
        var user_country = E.get('user.country');
        if (status!='busy')
        {
            this.country = (rule_enabled ?
                rule_enabled.country : user_country)||E.get('redirect_country')
                ||'';
        }
        else
        {
            this.country = user_country ? user_country :
                rule_enabled ? rule_enabled.country :
                E.get('redirect_country')||'';
        }
        this.list_view.render({active_country: this.country});
    },
});
var loader_view_class = Backbone.View.extend({
    className: 'popup-loader',
    initialize: function(){
        this.$el.addClass('g-hidden');
        this.$el.html('<div class="popup-loader-spinner popup-loader-back">'+
            '<svg width="100%" height="100%" viewBox="-1 -1 202 202">'+
                '<path class="popup-loader-rail" d="M 180,100 A 80,80 0 0,'+
                    '1 100,180 A 80,80 0 0,1 20,100 A 80,80 0 0,1 100,20 A '+
                    '80,80 0 0,1 180,100" style="fill:none"/>'+
            '</svg>'+
        '</div>'+
        '<div class="popup-loader-spinner popup-loader-bubble-container">'+
            '<svg width="100%" height="100%" viewBox="-1 -1 202 202">'+
                '<path class="popup-loader-bubble" d="M 180,100 A 80,80 0 0,1'+
                    '100,180 A 80,80 0 0,1 20,100 A 80,80 0 0,1 100,20 A 80,'+
                    '80 0 0,1 180,100" style="fill:none"/>'+
            '</svg>'+
        '</div> '+
        '<div class="popup-loader-spinner popup-loader-fore">'+
            '<svg width="100%" height="100%" viewBox="-1 -1 202 202">'+
                '<path class="popup-loader-spincircle" d="M 1,100" '+
                    'style="fill:none"/>'+
            '</svg>'+
        '</div>');
        this.loader_init();
    },
    render: function(parent){
        $(parent).append(this.$el);
    },
    loader_init: function(){
        var _this = this;
        var intId = 0, int2Id = 0, angle = 0, aperture = 0, d_aperture = 1.5;
        var d_angle = 15, need_finish = false;
        var transform_func = chrome ? '-webkit-transform' : 'transform';
        var arc = this.$('.popup-loader-spincircle')[0];
        var spinner = this.$('.popup-loader-fore')[0];
        var bubble = this.$('.popup-loader-bubble-container')[0];
        function setAperture(ang){
            ang %= 360;
            var angle = 6.28318531*ang/360.0;
            var ex = 100+Math.round(80*Math.cos(angle));
            var ey = 100+Math.round(80*Math.sin(angle));
            if (ang<=90)
                arc.setAttribute('d', 'M 180,100 A 80,80 0 0,1 '+ex+','+ey);
            else if (ang<=180)
            {
                arc.setAttribute('d', 'M 180,100 A 80,80 0 0,1 100,180 A 80,'+
                    '80 0 0,1 '+ex+','+ey);
            }
            else if (ang<=270)
            {
                arc.setAttribute('d', 'M 180,100 A 80,80 0 0,1 100,180 A 80,'+
                    '80 0 0,1 20,100 A 80,80 0 0,1 '+ex+','+ey);
            }
            else
            {
                arc.setAttribute('d', 'M 180,100 A 80,80 0 0,1 100,180 A 80,'+
                    '80 0 0,1 20,100 A 80,80 0 0,1 100,20 A 80,80 0 0,1 '+ex+
                    ','+ey);
            }
        }
        function burstBubble(){
            var iterations = 1, bubbleInt = 0;
            function startBurst(){
                bubble.setAttribute('class', 'popup-loader-spinner '+
                    'popup-loader-burst');
                setTimeout(function(){
                    bubble.setAttribute('class', 'popup-loader-spinner '+
                        'popup-loader-bubble-container');
                    if (!iterations)
                    {
                        _this.stop_timeout = setTimeout(function(){
                            _this.stop();
                        }, 400);
                    }
                }, 50);
                iterations -= 1;
                if (!iterations && bubbleInt)
                    clearInterval(bubbleInt);
            }
            startBurst();
            if (iterations)
                bubbleInt = setInterval(startBurst, 400);
        }
        function make_frame(){
            if (need_finish && aperture < 350)
                d_aperture = 10;
            else if (need_finish)
            {
                clearInterval(intId);
                aperture = 359.9;
                burstBubble();
            }
            else if (aperture > 200)
                d_aperture = (300 - aperture) / 50;
            else
                d_aperture = 1.5;
            setAperture(aperture);
            aperture = (aperture+d_aperture)%360;
        }
        this.start = function(opt){
            var _this = this;
            this.timeout = clearTimeout(this.timeout);
            if (opt && opt.timeout)
                setTimeout(function(){ _this.stop(); }, opt.timeout);
            need_finish = false;
            if (this.working)
                return;
            this.stop_timeout = clearTimeout(this.stop_timeout);
            this.working = true;
            this.$el.removeClass('g-hidden');
            setTimeout(function(){
                _this.$el.removeClass('g-transparent');
            }, 13);
            $('body').addClass('is-popup-loading');
            if (E.curr_view && E.curr_view.hide_search)
                E.curr_view.hide_search();
            if (intId)
                clearInterval(intId);
            intId = setInterval(make_frame, 50);
            int2Id = setInterval(function(){
                spinner.style[transform_func]='rotate('+angle+'deg)';
                angle=(angle+d_angle)%360;
            }, 50);
        };
        this.stop = function(is_immediately){
            this.$el.addClass('g-transparent');
            clearInterval(int2Id);
            this.timeout = clearTimeout(this.timeout);
            this.stop_timeout = setTimeout(function(){
                setAperture(0);
                _this.$el.addClass('g-hidden');
                $('body').removeClass('is-popup-loading');
            }, is_immediately ? 10 : animation_time);
            this.working = false;
        };
        this.finish = function(){
            if (need_finish)
                return;
            need_finish = true;
            this.timeout = clearTimeout(this.timeout);
            if (intId)
                clearInterval(intId);
            intId = setInterval(make_frame, 13);
        };
    }
});
var cross_sale_view_class = be_backbone.view.extend({
    className: 'cross-sale',
    events: {'click .button': 'on_go'},
    template: zdot.template(cross_sale),
    render: function(){
        this.$el.html(this.template());
        be_popup_lib.perr_err({id: 'be_vpn_cross_sale_view'});
        return be_backbone.view.prototype.render.apply(this);
    },
    on_go: function(event){
        var store = $(event.currentTarget).data('store');
        be_popup_lib.perr_err({id: 'be_vpn_cross_sale_'+store+'_click'});
    }
});
var ext_promo_rating_view_class = be_backbone.view.extend({
    className: 'ext-promo-rating',
    events: {'click .ext-promo-rating-item': 'handle_click'},
    template: zdot.template(ext_promo_rating),
    initialize: function(){
        var random = Math.floor(Math.random()*2);
        this.product = random ? 'va' : 'ab';
        this.$el.addClass(this.product);
    },
    render: function(){
        this.$el.html(this.template());
        be_popup_lib.perr_ok(
            {id: 'be_vpn_ext_promo_'+this.product+'_rating_view'});
        return be_backbone.view.prototype.render.apply(this);
    },
    handle_click: function(e){
        be_popup_lib.perr_ok(
            {id: 'be_vpn_ext_promo_'+this.product+'_click_rating_view'});
        return true;
    }
});
var install_exe_view_class = be_backbone.view.extend({
    className: 'install_exe',
    events: {'click .download': 'on_download'},
    template: zdot.template(install_exe),
    message_id: null,
    render: function(){
        this.$el.html(this.template());
        be_popup_lib.perr_err({id: 'be_vpn_install_exe_view'});
        return be_backbone.view.prototype.render.apply(this);
    },
    on_download: function(){
        etask([function(){
            return be_popup_lib.perr_err({id: 'be_vpn_install_exe_click'});
        }, function(){
            E.ui_popup.open_page('http://hola.org/?auto_install=%7B%22type%22%3A%22full%22%2C%22flow%22%3A%22vpn%22%7D');
        }]);
    }
});
var share_view_class = be_backbone.view.extend({
    className: 'share-container',
    events: {'click .share': 'on_share'},
    template: zdot.template(share),
    render: function(){
        this.$el.html(this.template());
        be_popup_lib.perr_err({id: 'be_vpn_share_view'});
        return be_backbone.view.prototype.render.apply(this);
    },
    on_share: function(event){
        var rule_enabled = E.get_enabled_rule();
        var root_url = rule_enabled ? E.get_root() : null;
        var link = get_sharing_link(rule_enabled);
        be_social.init_globals(root_url, E.get('country'), link, '');
        this.share_links = {
            facebook: (be_util.browser=='torch' ?
                be_social.sharer.facebook_no_app : be_social.sharer.facebook)
                +zescape.qs(be_social.share.facebook),
            twitter: be_social.sharer.twitter
            +zescape.qs(be_social.share.twitter)
        };
        var service = $(event.target).data('service');
        be_popup_lib.perr_err({id: 'be_vpn_share_'+service+'_click'});
        window.open(this.share_links[service], '_blank',
            'height=500,width=1000');
        this.trigger('chosen');
    }
});
var share_control_view_class = Backbone.View.extend({
    className: 'share-control',
    initialize: function(){
        var _this = this;
        var random = Math.floor(Math.random()*100); // 0 to 100
        var view = share_view_class;
        if (random > 33)
            view = cross_sale_view_class;
        if (random > 66)
            view = ext_promo_rating_view_class;
        this.child_view = new view();
        this.child_view.on('chosen', function(){ _this.trigger('chosen'); });
    },
    render: function(){
        this.$el.html(this.child_view.render().el);
        return this;
    }
});
var rating_view_class = Backbone.View.extend({
    className: 'popup-rating',
    events: {
        'mouseenter .popup-rating-star': 'on_hover',
        'click .popup-rating-star': 'on_click'
    },
    hints: [
        '',
        'Hate it',
        'Disliked it',
        'It was okay',
        'Like it',
        'Love it',
    ],
    initialize: function(opt){
        opt = opt||{};
        if (opt.hidden)
            this.$el.addClass('popup-rating-hidden');
        var $cont = $('<div>', {class: 'popup-rating-container'});
        var count = 5;
        var i = count;
        while (i--)
        {
            var num = count-i;
            $cont.append($('<span>', {class: 'popup-rating-star '+
                'popup-rating-star-'+num, 'data-num': num}));
        }
        this.$hint = $('<span>', {class: 'popup-rating-hint'})
        .appendTo($cont);
        $('<h3>', {class: 'popup-rating-title popup-more-title'})
        .text(T('Rate us'))
        .appendTo(this.$el);
        $('<div>', {class: 'popup-rating-msg'})
        .text(T('Thank you!'))
        .appendTo(this.$el);
        this.$el.append($cont);
    },
    show: function(){
        this.$el.removeClass('popup-rating-hidden');
        be_popup_lib.perr_ok({id: 'be_media_mp_vpn_rating_display'});
    },
    get_num: function(target){
        var $star = $(target);
        if (!$star.hasClass('popup-rating-star'))
            return;
        return $star.data('num');
    },
    on_hover: function(e){
        var num = this.get_num(e.target);
        if (!num)
            return;
        this.$el.removeClass(this.active_class);
        this.active_class = 'popup-rating-active-'+num;
        this.$el.addClass(this.active_class);
        this.$hint.text(T(this.hints[num])||'');
    },
    on_click: function(e){
        var num = this.get_num(e.target);
        if (!num)
            return;
        be_popup_lib.perr_ok({id: 'be_media_mp_vpn_rating_rate'});
        be_popup_lib.perr_ok({id: 'be_media_mp_vpn_rating_rate_'+num});
        E.be_info.ecall('set_vpn_last_rating', [num]);
        // for now send to reviews page only chrome users with 5 stars
        if (num<5 || browser!='chrome')
        {
            if (num<4)
            {
                $('.popup-rating-msg').text(T("Let's try other VPNs!"));
                E.sp.spawn(etask({cancel: true}, [function(){
                    return etask.sleep(500);
                }, function(){
                    var rule_enabled = E.get_enabled_rule();
                    var country = rule_enabled ?
                        rule_enabled.country.toLowerCase() : undefined;
                    best_open(country, 'rating_less_4_stars', num);
                }]));
            }
            return this.thanks();
        }
        var rate_url = 'https://chrome.google.com/webstore/detail'+
            '/hola-better-internet/gkojfkhlekighikafcpjkiklfbnlmeio/reviews';
        if (browser=='opera')
        {
            rate_url = 'https://addons.opera.com/en/extensions/details'+
                '/hola-better-internet/#feedback-container';
        }
        be_util.open_new_tab({url: rate_url});
        this.trigger('chosen');
    },
    thanks: function(){
        var _this = this;
        this.$el.addClass('popup-rating-thanks');
        setTimeout(function(){ _this.trigger('chosen'); }, 2000);
    }
});
var more_opt_view_class = Backbone.View.extend({
    className: 'popup-more',
    is_fix_it_redirect: false,
    no_fix_it_count: {},
    initialize: function(){
        var _this = this;
        var opt = this.opt = {};
        opt.active_classname = 'popup-button-active';
        opt.yes_text = T('Oh, yes!');
        opt.yes_active_text = T('Awesome!');
        opt.no_text = T('No, fix it');
        opt.unsupported_text = T('No, I need help');
        var $el = this.$el;
        this.$title = $('<h3>', {class: 'popup-more-title'})
        .text(T('Did it work?')).appendTo($el);
        this.$buttons = $('<div>', {class: 'popup-more-row'}).appendTo($el);
        this.$btn_yes = $('<button>', {class:
            'popup-button popup-button-yes'})
        .text(opt.yes_text).appendTo(this.$buttons)
        .click(function(e){
            e.stopPropagation();
            _this.on_yes();
        });
        this.$btn_no = $('<button>', {class: 'popup-button popup-button-no'})
        .text(opt.no_text).appendTo(this.$buttons)
        .click(function(e){
            var tab_id = E.be_tabs.get('active.id');
            _this.no_fix_it_count[tab_id] =
                (_this.no_fix_it_count[tab_id]||0)+1;
            var rule_enabled = E.get_enabled_rule();
            var country = rule_enabled ? rule_enabled.country.toLowerCase() :
                undefined;
            var src_country = E.get('country').toLowerCase();
            be_popup_lib.perr_err({id: 'be_ui_vpn_click_no_fix_it',
                info: assign({src_country: src_country,
                url: E.get_url(), root_url: E.get_root(),
                proxy_country: country},
                _.pick(rule_enabled||{}, 'name', 'type', 'md5'))});
            _this.update_yes(false);
            if (_this.$support_link)
                _this.$support_link.show();
            if (_this.is_fix_it_redirect)
            {
                unsupported_open('not-working', E.get_root(), country);
                return;
            }
            E.sp.spawn(fix_vpn());
        });
        if (browser=='chrome')
        {
            this.rating = this.rating||new rating_view_class({hidden: true});
            this.rating.$el.appendTo($el);
            this.rating.on('chosen', on_close_button);
        }
        this.share_control = new share_control_view_class();
        this.share_control.on('chosen', on_close_button);
        this.$share_wrapper = $('<div>', {class:
            'vpn-share-control-container'}).appendTo($el);
        $('#servers_list').remove();
        this.$more = $('<div>', {id: 'servers_list', class:
            'popup-more-servers g-hidden'})
        .insertAfter('#popup');
    },
    on_yes: function(){
        var _this = this;
        var rule_enabled = E.get_enabled_rule();
        if (!rule_enabled || this.poll_voted)
            return;
        var c = rule_enabled.country.toLowerCase();
        var root_url = E.get_root(), url = E.get_url();
        set_working();
        this.update_yes(true);
        be_popup_lib.perr_err({id: 'be_vpn_ok', info: assign({
            src_country: E.get('country').toLowerCase(), url: url,
            root_url: root_url, proxy_country: c},
            _.pick(rule_enabled, 'name', 'type', 'md5'))});
        this.poll_voted = true;
        var rating = E.be_info && E.be_info.get('vpn_last_rating') || 0;
        var vpn_work_yes = E.be_info && E.be_info.get('vpn_work_yes') || 0;
        vpn_work_yes++;
        if (E.be_info)
            E.be_info.ecall('increment_vpn_work_yes', []);
        this.$title.addClass('g-hidden');
        this.$buttons.hide(animation_time, function(){
            if (_this.rating && (!rating || rating<5 && vpn_work_yes%4==1))
                _this.rating.show();
            else
                _this.$share_wrapper.html(_this.share_control.render().el);
        });
    },
    update_yes: function(active){
        var $yes = this.$btn_yes;
        var $no = this.$btn_no;
        $yes.toggleClass(this.opt.active_classname, active)
        .text(active ? this.opt.yes_active_text : this.opt.yes_text);
        if (!active)
            return;
        $no.addClass('g-transparent');
        this.$title.addClass('g-transparent');
        setTimeout(function(){
            $no.addClass('g-hidden');
            $yes.addClass('popup-button-response');
        }, animation_time);
    },
    remove: function(){
        this.hide();
        this.hide_more();
        $('#servers_list').remove();
        Backbone.View.prototype.remove.call(this);
    },
    render: function(){
        var _this = this;
        var $no = this.$btn_no;
        this.is_fix_it_redirect = this._is_fix_it_redirect();
        $no.text(this.is_fix_it_redirect ? this.opt.unsupported_text
            : this.opt.no_text);
        if (!this.poll_voted)
            this.show();
        E.sp.spawn(etask({cancel: true}, [function(){
            return be_util.get_www_config();
        }, function(data){
            if (!data || !data.popup_need_help ||
                !data.popup_need_help.enabled)
            {
                return;
            }
            var countries = data.popup_need_help.countries;
            if (countries && countries.length &&
                !countries.includes(E.get('country')))
            {
                return;
            }
            if (_this.$support_link)
                _this.$support_link.remove();
            _this.$support_link = $('<a>', {target: '_blank'})
            .attr('href', 'https://hola.org/support')
            .text(' '+T('Need Help?'))
            .click(function(e){
                be_popup_lib.perr_ok({id: 'be_ui_vpn_number_of_need_help'});
            }).hide()
            .appendTo(_this.$buttons);
        }]));
    },
    show_more: function(){
        $('body').addClass('is-popup-servers');
        this.$more.removeClass('g-hidden');
    },
    hide_more: function(){
        $('body').removeClass('is-popup-servers');
        this.$more.addClass('g-hidden');
    },
    show: function(){
        this.$el.removeClass('g-hidden');
        $('body').addClass('is-popup-mini');
    },
    hide: function(){
        this.$el.addClass('g-hidden');
        this.hide_more();
        $('body').removeClass('is-popup-mini');
    },
    _is_fix_it_redirect: function(){
        // XXX colin: derry wants the following to be added
        // for platforms where hola_svc not relevant (non-Windows) - you can in
        // 2nd ‘not working’. In platforms where hola_svc exists but not
        // installed - in ‘not working’ (first one!) - you can recommend
        // ‘hola_svc’, and in 2nd ‘not working’ you can recommend alternative
        // VPNs.
        if (!E.be_ext.get('enable_unsupported'))
            return false;
        var tab_id = E.be_tabs.get('active.id');
        return this.no_fix_it_count[tab_id]>=1;
    }
});
var title_view_class = Backbone.View.extend({
    className: 'popup-hover-title',
    initialize: function(opt){
        this.opt = opt||{};
        var _this = this;
        if (this.opt.no_search)
            this.$el.addClass('no-search');
        var title_text = this.opt.title||T('Browsing')+' '+T('From');
        this.$title = $('<div>', {class: 'popup-enabled-title'});
        this.$title.append($('<h2>', {class: 'popup-title'})
            .text(title_text));
        this.$el.append(this.$title);
        if (this.opt.no_search)
            return;
        this.$search_container = $('<div>', {class:
            'popup-search-container'});
        this.$search = $('<div>', {class: 'popup-search'})
        .appendTo(this.$search_container);
        this.search = init_search(this.$search);
        this.search.$('.twitter-typeahead').append($('<span>', {class:
            'popup-search-trigger'}).click(function(){
                _this.search.select();
            }));
        this.$search.addClass('popup-search-advanced g-hidden');
        this.search.$el.addClass('g-transparent');
        this.$search.prepend($('<div>', {class: 'popup-search-title'})
            .html(T('Browsing')+'<span>&nbsp;'+T('From')+'</span>'));
        this.$search.append($('<div>', {class: 'popup-search-title-bottom'})
            .html('<span>'+T('Browsing')+'&nbsp;</span>'+T('From')));
        var events = {mouseenter: function(){ _this.show_search(); },
            mouseleave: function(){ _this.hide_search(); }};
        this.$title.on(events);
        this.$search.on(events);
        this.$el.prepend(this.$search_container);
    },
    render: function(){
        if (this.opt.no_search)
            return;
        if (this.search.$input.typeahead)
            this.search.$input.typeahead('val', E.get_root());
        else
            this.search.$input.val(E.get_root());
    },
    show_search: function(){
        var _this = this;
        var $body = $('body');
        if ($body.hasClass('is-popup-loading'))
            return;
        this.search_hide_timer = clearTimeout(this.search_hide_timer);
        this.$title.addClass('g-hidden');
        this.$search.removeClass('g-hidden');
        this.search.$el.removeClass('g-transparent');
        this.search_show = setTimeout(function(){
            _this.$search.addClass('popup-search-hover');
        }, 13);
    },
    hide_search: function(){
        if (this.search_hide_timer)
            return;
        var _this = this;
        this.search.off('blur');
        if (this.$search.find('.js-search-active').length > 0 && this.search)
            this.search.on('blur', function(){ _this.hide_search(); });
        else
        {
            this.search_show = clearTimeout(this.search_show);
            this.search.$el.addClass('g-transparent');
            this.$search.removeClass('popup-search-hover');
            this.search_hide_timer = setTimeout(function(){
                _this.$title.removeClass('g-hidden');
                _this.$search.addClass('g-hidden');
            }, animation_time);
        }
    }
});
var enable_view_class = Backbone.View.extend({
    className: 'popup-enabled',
    initialize: function(){
        var $container = $('<div>', {class: 'popup-enabled-content'});
        var hover_title = this.hover_title = new title_view_class({no_search:
            is_tpopup});
        this.$search = hover_title.$search;
        this.search = hover_title.search;
        this.country_selected_view = new country_selected_view_class();
        this.more_opt = new more_opt_view_class();
        $container.append(hover_title.$el, this.country_selected_view.$el);
        this.$el.append($container, this.more_opt.$el);
    },
    render: function(){
        this.hover_title.render();
        var prev_country = this.country_selected_view.country;
        this.country_selected_view.render();
        $('body').addClass('is-popup-enable-view');
        this.more_opt.render();
        if (this.country_selected_view.country!=prev_country)
            this.more_opt.hide_more();
    },
    remove: function(){
        $('body').removeClass('is-popup-enable-view');
        if (this.more_opt)
        {
            this.more_opt.remove();
            this.more_opt = null;
        }
        Backbone.View.prototype.remove.call(this);
    }
});
var popular_view_class = Backbone.View.extend({
    className: 'r_popular_view',
    initialize: function(){
        var _this = this;
        this.$search = $('<div>', {class: 'r_ui_search'});
        this.search = init_search(this.$search);
        this.search.$('.twitter-typeahead').append($('<span>', {class:
            'popup-search-trigger'}).click(function(){
                _this.search.select();
            }));
    },
    render: function(){
        var _this = this;
        var country = E.get('country');
        var $popular = $('<div>', {class: 'popup-popular'});
        this.$title = $('<h2>', {class: 'popup-title'})
        .html(T('Most popular in')+' <span class="country">'+T(country)
        +'</span>');
        var $search_container = $('<div>', {class:
            'popup-search-container'});
        this.$search.addClass('popup-search g-transparent')
        .removeClass('r_ui_search').appendTo($search_container);
        $popular.append($search_container);
        $popular.append(this.$title);
        var events = {mouseenter: function(){ _this.show_search(); },
            mouseleave: function(){ _this.hide_search(); }};
        var list = E.get('unblocking_rate')||[];
        this.$popular_list = $('<div>', {class: 'popup-popular-list'})
        .appendTo($popular);
        list.forEach(function(p){
            _this.$popular_list.append($new_popular_block(p));
        });
        var popular_footer_item = '<div class=\'popular-footer-item\'></div>';
        var $popular_footer = $('<div></div>', {class: 'popular-footer'})
        .html(popular_footer_item+popular_footer_item+popular_footer_item);
        $popular.append($popular_footer);
        var $more_sites = $('<a>', {class: 'popular-more', target: '_blank',
            href: 'https://hola.org/access/popular'});
        $popular.append($more_sites);
        this.$title.on(events);
        this.$search.on(events);
        this.$el.empty().append($popular);
        $('body').addClass('is_popular_view');
    },
    show_search: function(){
        this.$title.addClass('g-transparent');
        this.$popular_list.addClass('popup-popular-list-blur');
        this.$search.removeClass('g-transparent');
    },
    hide_search: function(){
        var _this = this;
        this.search.off('blur');
        if (this.$search.find('.js-search-active').length > 0 && this.search)
            this.search.on('blur', function(){ _this.hide_search(); });
        else
        {
            this.$title.removeClass('g-transparent');
            this.$popular_list.removeClass('popup-popular-list-blur');
            this.$search.addClass('g-transparent');
        }
    }
});

var redirect_view_class = Backbone.View.extend({
    className: 'popup-redirect hidden-until-reload',
    links: null,
    current_root: null,
    rule_enabled: null,
    disable_view: null,
    selected_host: null,
    events: {
        'change .sites-list .link input': '_on_site_change'
    },
    initialize: function(opt){
        this.current_root = svc_util.get_root_url(E.be_tabs.get('active.url'));
        this.links = opt.links;
        this.links.push(this.current_root);
        this.selected_host = this.links[0];
        this.rule_enabled = E.get_enabled_rule();
    },
    render: function(){
        var _this = this;
        if (this.disable_view)
            this.disable_view.remove();
        this.$el.empty();
        // XXX alexeym: remove display: none after extension update
        // (when most of users will use version with new popup.css)
        var $el = this.$el.css('display', 'none');
        $('body').addClass('is-redirect-suggest');
        $el.append($('<h2>', {class: 'popup-title title'})
            .text(T('Select site to access')));
        var $list = $('<ul>', {class: 'sites-list'});
        $el.append($list);
        _.forEach(this.links, function(link){
            _this.create_item(link, 'unblock', link==_this.selected_host)
            .data('link', link).appendTo($list);
        });
        var title_view = new title_view_class({title: T('Select a country'),
            no_search: true});
        var country_selection_view = new country_selection_view_class({
            active_country: !!this.rule_enabled&&E.get('country'),
            host: this.selected_host
        });
        country_selection_view.on('select', this._on_country_select, this);
        this.disable_view = new disable_view_class({title_view: title_view,
            country_selection_view: country_selection_view});
        $el.append(this.disable_view.render().$el);
    },
    _on_country_select: function(country){
        E.redirect_view_closed = true;
        var info = {current_root: this.current_root, links: this.links,
            country: country};
        if (E.get('country')==country)
        {
            be_popup_lib.perr_ok({id: 'be_ui_vpn_redirect_reject', info:
                info});
        }
        else
        {
            info.unblock = this.selected_host;
            be_popup_lib.perr_ok({id: 'be_ui_vpn_redirect_unblock',
                info: info});
        }
    },
    _on_site_change: function(e){
        this.selected_host = $(e.target).closest('.link').data('link');
        this.render();
    },
    create_item: function(text, class_name, checked){
        var $text = $('<span>', {class: 'text'}).text(text);
        var $radio = $('<input>', {type: 'radio', name: 'country',
            checked: !!checked});
        var $label = $('<label>').append($radio).append($text);
        return $('<li>', {class: 'link f32 '+class_name}).append($label);
    }
});

var ext_promo_view_class = Backbone.View.extend({
    className: 'more-from-hola',
    events: {
        'click .more-from-hola-items a': 'on_promo_click',
        'click .more-from-hola-desc': 'on_more_click'
    },
    template: zdot.template(ext_promo),
    id_prefix: 'be_ui_vpn_click_ext_promo',
    link_type: function(a){
        var $a = $(a);
        if ($a.hasClass('more-va'))
            return 'va';
        if ($a.hasClass('more-ab'))
            return 'ab';
        if ($a.hasClass('more-android'))
            return 'android';
    },
    on_promo_click: function(e){
        var id = this.id_prefix+'_'+this.link_type(e.target);
        be_popup_lib.perr_ok({id: id});
        return true;
    },
    on_more_click: function(e){
        var id = this.id_prefix+'_more_link';
        be_popup_lib.perr_ok({id: id});
        return true;
    },
    render: function(){
      this.$el.html(this.template());
      return this;
    }
});

function fix_vpn_perr(opt){
    if (!opt)
        return;
    var url = opt.url;
    var rule_enabled = opt.rule;
    if (!rule_enabled)
        return;
    var root_url = opt.root_url;
    var p = E.be_rule.get('verify_proxy_ret')||{};
    var c = rule_enabled.country.toLowerCase();
    var info = assign({
        src_country: E.get('country').toLowerCase(),
        url: url,
        root_url: root_url,
        proxy_country: c,
        tunnel: p.tunnel&&p.tunnel.tunnel,
        proxy_error: p.error,
        agent: p.basic&&p.basic.agent,
        zagent_log: E.be_vpn.get('zagent_conn_log')||[],
        callback_raw: E.be_mode.get('svc.callback_raw'),
        callback_ts: E.be_mode.get('svc.callback_ts'),
        mode_change_count: E.be_mode.get('mode_change_count'),
        multiple_mode_changes: E.be_mode.get('mode_change_count')>2,
        real_url: E.be_tabs.get('active.url'),
        status: E.be_tabs.get('active.status'),
    }, _.pick(rule_enabled, 'name', 'type', 'md5'));
    return etask([function(){
        return E.be_tabs.ecall('get_trace', [E.be_tabs.get('active.id')]);
    }, function(trace){
        info.page_load = trace && trace.length &&
            trace[trace.length-1].duration;
        return info;
    }, function finally$(){
        be_popup_lib.perr_err({id: 'be_ui_vpn_script_not_work', info: info});
    }]);
}
var fix_tasks = {};
function fix_vpn(){
    var rule_enabled = E.get_enabled_rule();
    var root_url = E.get_root(), url = E.get_url();
    if (!rule_enabled||!root_url)
    {
        be_popup_lib.perr_err({id: 'be_ui_vpn_no_rule',
            info: {country: E.get('country'), root_url: root_url, url: url}});
        return;
    }
    var info;
    var timeout = Date.now();
    var tab_id = E.be_tabs.get('active.id');
    if (fix_tasks[tab_id])
        fix_tasks[tab_id].return();
    return fix_tasks[tab_id] = etask({cancel: true}, [function(){
        return fix_vpn_perr({rule: rule_enabled, root_url: root_url,
            url: url});
    }, function(perr_info){
        info = perr_info;
        return E.change_proxy(rule_enabled, 'not_working');
    }, function(){
        var proxy_timeout = Date.now()-timeout;
        if (proxy_timeout<10*SEC)
            return true;
        return this.return();
    }, function get_trace(){
         return E.be_tabs.ecall('get_trace', [tab_id]);
    }, function(trace){
        var last_trace = trace && trace.length && trace[trace.length-1];
        var status = last_trace && last_trace.status;
        // XXX alexeym : if you assume status is array, should check !status
        if (!status)
        {
            this.fix_waiting = true;
            return this.wait(20*SEC);
        }
        info.page_load = last_trace && last_trace.duration;
        if (info.page_load<20*SEC && !['4', '5'].includes(status[0]))
            return this.return(true);
        return this.return();
    }, function(){
        this.fix_waiting = false;
        return this.goto('get_trace');
    }, function catch$(err){
        this.fix_waiting = false;
        be_popup_lib.perr_err({id: 'be_ui_vpn_script_fix_rule', info: info,
            err: err});
    }]);
}

E.on_show = function(){
    E.is_visible = true;
    update_footer();
    on_ext_display();
};

E.on_hide = function(){
    E.is_visible = false;
};

function on_ext_display(){
    if (E.is_visible && !E.displayed && !is_tpopup && E.curr_view)
    {
        E.displayed = true;
        be_popup_lib.perr_ok({id: 'be_media_mp_ui_display_ext_vpn'});
    }
}

function must_install_exe(){
    // only new users (first install version is >1.11.965) should install exe
    return (browser=='firefox' && version_util.cmp(
        storage.get('install_version'), '1.11.965')>0 || browser == 'torch')
        && (be_util.os_win() || (be_util.os_mac()
        && version_util.cmp(be_util.os_guess.version, '10.9')>=0))
        && !E.be_mode.get('svc.detected');
}

E.render = _.debounce(function(){
    return etask([function(){
        var be_bg_main = window.be_popup_main.be_bg_main;
        var $up, state = E.get('state'), enabled = be_bg_main.get('enabled');
        var redirect_page = E.redirect_page();
        var navigating_to = E.get('navigating_to');
        // XXX arik/mark hack: need a nicer way to handle removal from DOM
        if (state=='error')
            return E.set_err('be_ui_vpn_render_state_err');
        state = !enabled ? 'turned_off' : state;
        if (!E.curr_view || E.curr_view.state!=state || redirect_page
            || navigating_to)
        {
            E.unset('hide_loader');
            if (E.curr_view && E.curr_view.remove)
            {
                E.curr_view.remove();
                E.curr_view = null;
            }
            $('body').removeClass('is_popular_view is-popup-off '+
                'is-popup-disabled is-popup-error is-redirect-suggest');
            if (!enabled)
                E.curr_view = new turned_off_view_class();
            else if (must_install_exe())
                E.curr_view = new install_exe_view_class();
            else if (redirect_page || navigating_to)
            {
                var country = redirect_page ? redirect_page.country
                    : navigating_to.country;
                state = 'enable';
                E.set('redirect_country', country);
                if (E.loader)
                    E.loader.start();
                E.curr_view = new enable_view_class();
            }
            else if (state=='skip_url'||get_is_reminder())
                E.curr_view = new popular_view_class();
            else
            {
                E.curr_view = null;
                if (chrome && !is_tpopup && E.be_tabs &&
                    E.be_tabs.get_redirect_list)
                {
                    var active_tab = E.be_tabs.get('active.id');
                    var redirect_list = E.be_tabs
                        .get_redirect_list(active_tab);
                    var redirect_view = !E.redirect_view_closed;
                    if (redirect_view && redirect_list &&
                        redirect_list.length)
                    {
                        if (E.loader)
                        {
                            E.loader.finish();
                            E.loader.stop();
                        }
                        E.curr_view = new redirect_view_class({links:
                            redirect_list});
                    }
                }
                if (!E.curr_view)
                {
                    if (state=='enable')
                        E.curr_view = new enable_view_class();
                    else
                        E.curr_view = new disable_view_class();
                }
            }
            E.curr_view.state = state;
            $up = $('<div>', {class: 'r_ui_up'}).append(E.curr_view.$el);
            E.$el.empty().append($up);
        }
        E.curr_view.render();
        update_footer();
        on_ext_display();
    }, function(){ E.trigger('render_done');
    }, function catch$(err){ E.set_err('be_ui_vpn_render_err', err); }]);
});

function set_user_cmd(opt){
    zerr.notice('user action %s cmd %s country %s', opt.label, opt.cmd,
        opt.country);
    var new_state;
    if (E.get_enabled_rule())
        new_state = {};
    else
        new_state = {state: 'disable'};
    // XXX arik NOW: need better way to set status
    E.set(assign({'user.country': opt.country, 'user.cmd': opt.cmd,
        'user.opt': opt}, opt.no_busy ? new_state :
        {status: 'busy', status_opt: {desc: 'Connecting...'}}));
}

E.script_set = function(rule, val){
    console.log(rule, val, 'rule');
    return etask([function(){
        clr_working();
        return E.be_ext.ecall('set_enabled', [true]);
    }, function(){
        if (!E.be_ext.get('r.ext.enabled'))
            be_popup_lib.perr_err({id: 'be_ui_vpn_set_enabled_mismatch'});
        if (!E.be_ext.get('r.vpn.on'))
            return E.be_vpn.ecall('enable', []);
    }, function(){
        var new_rule = {name: rule.name, enabled: +val.enabled,
            country: val.country||rule.country, type: rule.type,
            root_url: val.root_url};
        if (val.expire)
            new_rule.expire = val.expire;
        new_rule.premium = !!val.premium;
        if (!new_rule.enabled)
            E.set('navigating_to', false);
        return E.be_rule.fcall('trigger', ['set_rule', new_rule]);
    }, function(){
        // XXX alexeym/shachar: check if we need to force tab refresh here
        // XXX arik: need to wait till not busy before sending perr
        be_popup_lib.perr_ok({id: 'be_ui_vpn_script_set_ok', info:
            {name: rule.name, src_country: E.get('country').toLowerCase(),
            root_url: val.root_url, enabled: val.enabled, premium:
            val.premium}});
    }, function catch$(err){
        E.set_err('be_ui_vpn_script_set_err', err);
    }]);
};

function perr_event(action, opt){
    var category = opt.category || 'bext';
    var label = opt.label;
    var id = category+(label ? '_'+label : '')+'_'+action;
    var info_opt = $.extend({src_country:
        E.get('country').toLowerCase()}, opt.info);
    ga.ga_send('event', category, action, label);
    if (!opt.err)
        return be_popup_lib.perr_ok({id: id, info: info_opt});
    return be_popup_lib.perr_err({id: id, info: info_opt});
}

return E; });
