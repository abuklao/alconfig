var IntroTour=function(e,r,n,t,o){"use strict";function s(){b.laterThisTour(),t.setPreferences("IntroTour",JSON.stringify(b.getOptions()))}function u(){b.neverThisTour(),t.setPreferences("IntroTour",JSON.stringify(b.getOptions()))}function i(){b.neverAllTours(),t.setPreferences("IntroTour",JSON.stringify(b.getOptions()))}function c(){b.takeThisTour(),t.setPreferences("IntroTour",JSON.stringify(b.getOptions()))}function T(){t.setPreferences("IntroTour",null)}function a(){var e=JSON.parse(t.getPreference("IntroTour",null));e&&e.remainingTours&&e.remainingTours.length>0&&(e.remainingTours[0].showDate=new Date,t.setPreferences("IntroTour",JSON.stringify(e)))}function l(){g&&(g.unSubscribeAction("later"),g.unSubscribeAction("never"),g.unSubscribeAction("start"),g.unSubscribeAction("close"),g.cleanup(),g=null)}function f(i){var T=this,a=t.getPreference("IntroTour")?JSON.parse(t.getPreference("IntroTour")):null;b=new e(n,a);var f=b.getAvailableTour();f&&f.showDate&&new Date>=new Date(f.showDate)&&(g=new r(f),i||(t.setPreferences("IntroTour",JSON.stringify(b.getOptions())),g.subscribeToAction("later",s),g.subscribeToAction("never",u),g.subscribeToAction("start",c),g.subscribeToAction("close",l)),o.get(o.CLEAR_DATA).subscribe(function(){T&&T.cleanup&&T.cleanup()}),g.startFlow(i))}var g,b;return{start:f,cleanup:l,neverThisTour:u,laterThisTour:s,neverAllTours:i,takeThisTour:c,resetAllTours:T,makeLaterNowTours:a}}(IntroTourQueue,IntroTourFlow,IntroTourData,LPProxy,Topics);