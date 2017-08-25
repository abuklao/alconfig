// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define([], function(){
var E = {};
var GA_URL = 'https://ssl.google-analytics.com/ga.js';
E.inited = {};
E.init = function(id, no_pageview){
    if (E.inited[id])
        return;
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = GA_URL;
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
    var _gaq = window._gaq = window._gaq || [];
    _gaq.push(['_setAccount', id]);
    E.inited[id] = true;
    if (no_pageview)
        return;
    _gaq.push(['_trackPageview']);
};
E.ga_send = function(type, category, action, label, id){
    var _gaq = window._gaq;
    if (!_gaq)
        return;
    if (_gaq._getAsyncTracker)
        _gaq._getAsyncTracker(id)._trackEvent(category, action, label);
    else
        _gaq.push(['_trackEvent', category, action, label]);
};

return E; });
