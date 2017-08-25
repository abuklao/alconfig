// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
(function(){
var chrome = window.chrome;
if (!chrome)
    return;
chrome.extension.sendMessage({devtool_pane: true}, function(response){
    if (!response || !response.create)
        return;
    var panels = chrome.devtools && chrome.devtools.panels;
    panels.create('Unblocker', '/js/bext/vpn/pub/img/logo.png',
        '/js/bext/vpn/pub/dev_unblocker.html', function(panel){});
});

})();
