// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
(function(){
function require_err(locale, err){
    try { localStorage.setItem('locale', 'en'); }
    catch(cerr){ console.error('failed set localStorage.locale '+cerr.stack); }
    if (window.hola && window.hola.base)
    {
        window.hola.base.perr({id: 'be_lang_err', info: ''+locale+err,
            bt: err.stack, filehead: 'userAgent: '+navigator.userAgent});
    }
    // XXX arik/bahaa/vladimir hack: if we fail to get lang file we will get
    // into an infinite loop. we have such a case:
    // ec16e0b80ee75fddc03322b6cdbb5285 (14-feb-2014)
    // todo:
    // - no need for special handling of this failure. it is like any other
    // require error
    // - verify that clicking on the popup will reload the extension if this
    // error happened
    // - try to understand what causes this failure (we don't get
    // be_require_err for this file)
    if (0)
        setTimeout(function(){ location.reload(); }, 200);
}

define(['lang', '/bext/pub/locale/en.js'], function(be_lang, locale_en){
var E = get_message;
E.locale = 'en';
E.locales = be_lang.lang.slice();
E.locale_curr = E.locale_en = locale_en;
try { E.locale = localStorage.getItem('locale'); }
catch(err){ console.error('failed to read locale '+(err.stack||err)); }
if (!E.locales.includes(E.locale))
{
    var navlang = (navigator.language||'').replace('-', '_');
    var choices = [navlang, navlang.substr(0, navlang.indexOf('_')), 'en'];
    for (var i=0; i<choices.length; i++)
    {
        if (E.locales.includes(choices[i]))
        {
            E.locale = choices[i];
            break;
        }
    }
}
require(['/bext/pub/locale/'+E.locale+'.js'], function(locale_curr){
    E.locale_curr = locale_curr;
    try { localStorage.setItem('locale', E.locale); }
    catch(err){ console.error('failed to setup locale '+(err.stack||err)); }
}, function(err){
    require_err(E.locale, err);
    E.locale = 'en';
});

E.is_rtl = function(){ return /^(ar|he|fa|ur)$/.test(E.locale); };

function get_message(id, vals, locale){
    var s, o = E.locale_curr[id]||locale_en[id];
    if (locale)
        o = (E.locale==locale&&E.locale_curr[id])||locale_en[id];
    if (!o)
    {
        if (window.console && console.error)
            console.error('no string for '+id);
        if (window.hola.base.perr_once)
        {
            window.hola.base.perr_once({id: 'be_lang_missing',
                info: ''+E.locale+'|'+id.substr(0, 512)});
        }
        s = id;
    }
    else
	s = o.message;
    if (!vals)
        return s;
    /* XXX arik: check chrome code for better implementation/regex */
    for (var i=0; i<vals.length; i++)
        s = s.replace('$'+(i+1), vals[i]);
    return s;
}

/* XXX arik: check for a better way to make first char capital */
E.capital = function(id, vals, locale){
    var s = get_message(id, vals, locale);
    return s ? s[0].toUpperCase()+s.substr(1) : s;
};

return E; }, require_err.bind(null, 'en'));
})();
