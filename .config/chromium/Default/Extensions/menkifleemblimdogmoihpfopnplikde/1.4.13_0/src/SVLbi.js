importScripts("pkwbc.js");var hw={pushPhaseInfo:function(a){Av.A=a},"ḮŤŦ":function(a){Av[Io][Fn]=JSON.parse(a)},pushLineConfig:function(a){Av[ot]=a[ot]?a[ot]:Av[ot],Av.LEGY_ENCRYPT_KEY=a.LEGY_ENCRYPT_KEY||Av.LEGY_ENCRYPT_KEY,Av[So]=a[So]||Av[So],Av.B=a.B||Av.B,Av.A=a.A||Av.A,Av[hf]=a[hf]||Av[hf],Av[Di]=a[Di]||Av[Di],Av[Io]=a[Io]||Av[Io];var b=function(a){reply("refreshTokenT",{token:a})};_v.ȊÎṮ().ŢŢŦḮȊĮǀṰȊṬ(b)},requestAuthVerifyPolling:function(a,b){try{var c=Xv.ȊÎṮ().ٲٱĬÎÍŤḮṪLI(a,b);c.output.ĲiiIḬIǏÏiḬ().ÏỈLȈĨΪiỊΪΪ(!1,function(){var a=c.output.ĲiiIḬIǏÏiḬ().read(),b=oz.iٲIĨŢḮlṪĮṮ(a);reply("requestAuthVerifyPolling",b)})}catch(d){d instanceof DOMException?reply("requestAuthVerifyPolling","DOMException"):reply("requestAuthVerifyPolling",d)}},requestAuthVerifyWithE2EEPolling:function(a,b){try{var c=Xv.ȊÎṮ().ĲÎḬȊiĮŢІṬٲ(a,b);c.output.ĲiiIḬIǏÏiḬ().ÏỈLȈĨΪiỊΪΪ(!1,function(){var a=c.output.ĲiiIḬIǏÏiḬ().read(),b=oz.iٲIĨŢḮlṪĮṮ(a);reply("requestAuthVerifyWithE2EEPolling",b)})}catch(d){d instanceof DOMException?reply("requestAuthVerifyWithE2EEPolling","DOMException"):reply("requestAuthVerifyWithE2EEPolling",d)}},"ÍṬٱṬЇIΙLḬṰ":function(){reply("isRunningOperationPoller",!0)},"ṬlЇ":function(a,b,c,d,e){try{var f=_v.ȊÎṮ().ÍٲΪΪȈٳȈiĲŦ(Av[So],e),g=f.ỊṬΙΙŢٱІ(a,b,c,d);reply("ṬlЇ",g)}catch(h){h instanceof DOMException?reply("errorOperationPolling","DOMException"):reply("errorOperationPolling",h)}},refreshTokenT:function(){}};onmessage=function(a){if(a.data instanceof Object&&a.data.hasOwnProperty("method")&&a.data.hasOwnProperty("arguments")){var b=Array.prototype.slice.call(a.data.arguments);hw[a.data[Ws]].apply(self,b)}else Ia(a.data)};var reply=function(){if(arguments[Zs]<1)throw new TypeError("reply - not enough arguments");postMessage({method:arguments[0],arguments:Array.prototype.slice.call(arguments,1)})}