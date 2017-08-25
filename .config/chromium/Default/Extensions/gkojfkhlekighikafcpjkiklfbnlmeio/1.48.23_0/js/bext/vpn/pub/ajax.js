// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define(['/util/ajax.js', '/util/storage.js'], function(ajax, storage){

// ajax module with global logging of timeouts
// notice: no matter what module uses it, ALL of timeouts
// will be logged, because ajax.events are global
var E = ajax;

ajax.events.on('timeout', function(){
    storage.set('ajax_timeout', storage.get_int('ajax_timeout')+1);
});

return E; });
