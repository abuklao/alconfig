// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['jquery', 'underscore', '/bext/pub/backbone.js', '/util/zerr.js',
    '/bext/pub/browser.js', '/bext/pub/lib.js'],
    function($, _, be_backbone, zerr, B, be_lib){
B.assert_bg('be_bg_main');
zerr.set_exception_handler('be', be_lib.err);
var chrome = !window.is_tpopup && window.chrome;
var conf = window.conf;
var E = {};

function unimplemented_cb(){
    console.error('unimplemented');
    console.error(arguments);
    console.error(new Error().stack);
}

E.init_proxy_mock = function(){
    chrome.proxy = {
        settings: {
            get: unimplemented_cb,
            set: function(opt){
                if (opt.value.mode!='pac_script')
                    return unimplemented_cb(opt);
                E.port.postMessage({id: 'pac_script_set',
                    content: opt.value.pacScript.data});
            },
            clear: unimplemented_cb,
            onChage: {
                addListener: unimplemented_cb,
                removeListener: unimplemented_cb
            },
        },
    };
};

E.init = function(){
    if (!conf.firefox_web_ext)
        return;
    E.port = chrome.runtime.connect({name: 'ff_hybrid_mock'});
    if (!chrome.proxy)
        E.init_proxy_mock();
    E.initialized = true;
};

return E; });
