// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define([], function(){
var E = {};

E.hash_int = function(v){ return ((1103515245*v+12345)^(v>>16))>>>0; };
E.hash_string = function(s){
    if (!s.length)
        return 0;
    var hash = E.hash_int(s.length);
    for (var i=0; i<s.length; i+=2)
    {
        hash = E.hash_int(
            (hash+(s.charCodeAt(i)<<16)+(s.charCodeAt(i+1)|0))>>>0);
    }
    return hash;
};

// sha1sum/md5sum output parser
E.sum_parse = function(str){
    // sha1sum format is 'hash [ |*]filename'
    var parts = /([0-9a-f]+)\s+([ *]?)(.*)/i.exec(str);
    if (!parts)
        return null;
    return {hash: parts[1], type: parts[2]=='*' ? 'binary' : 'text',
        file: parts[3]};
};

return E; }); }());

