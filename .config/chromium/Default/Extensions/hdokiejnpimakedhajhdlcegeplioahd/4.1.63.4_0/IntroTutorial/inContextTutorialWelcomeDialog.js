var InContextTutorialWelcomeDialog=function(e){Dialog.call(this,e,{closeButtonEnabled:!1,maximizeButtonEnabled:!1,dynamicHeight:!1,hideHeader:!0,hideButtons:!0,confirmOnClose:!1})};InContextTutorialWelcomeDialog.prototype=Object.create(Dialog.prototype),InContextTutorialWelcomeDialog.prototype.constructor=InContextTutorialWelcomeDialog,function(e){function t(e,t,o,n){var i=new lpTile({id:o,name:n.displayName,tileClass:"tile-sm",iconSrc:IntroTutorialImages.getImage(n.displayName.toLowerCase(),"square"),clickHandler:function(t){bg.removeModalOverlay(),t.preventDefault(),e.close(!0),bg.sendLpImprove("onboardingtour::selected",{action:n.getDomainCode(),version:"incontext"}),bg.IntroTutorial.setState({enabled:!0,domain:n.domain,name:n.displayName,tile:n.getDomainCode(),isInContext:!0,firstLogin:!0,inContextOnboardingStep:"add_first_site",isAllSet:!1}),n.goToLogin()}});t.append(i.$tileEl)}InContextTutorialWelcomeDialog.prototype.initialize=function(e){function o(e){e.preventDefault(),bg.sendLpImprove("onboardingtour::selected",{action:"nothanks",version:"incontext"}),LPProxy.setPreferences("showIntroTutorial",!1),bg.IntroTutorial.completeTutorial({textChoice:"skipped"}),n.close(!0)}Dialog.prototype.initialize.apply(this,arguments);for(var n=this,i=e.find("#tileContainer"),a=LPSiteService.getSites(),r=0;r<a.length;r++)t(n,i,"#tile"+(r+1),a[r]);var l=!0,c=LPProxy.getPreference("ShowIntroTutorialLater",null);c&&Date.now()>=new Date(c)&&(l=!1);var s=e.find("#showLater"),d=e.find("#noThanks");l?(d.hide(),s.show(),s.bind("click",function(e){e.preventDefault(),bg.sendLpImprove("onboardingtour::selected",{action:"later",version:"incontext"});var t=new Date;t.setDate(t.getDate()+3),LPProxy.setPreferences("ShowIntroTutorialLater",t.toString()),bg.IntroTutorial.completeTutorial({textChoice:"skipped"}),n.close(!0)})):(s.hide(),d.show(),d.bind("click",o)),e.find("#btnClose").bind("click",o),bg.sendLpImprove("onboardingtour::seen",{version:"incontext"})},InContextTutorialWelcomeDialog.prototype.getSize=function(){return{"max-height":"100%","max-width":"100%"}},InContextTutorialWelcomeDialog.prototype.open=function(e){Dialog.prototype.open.apply(this,arguments),bg.get_selected_tab(null,function(e){/\/how-it-works\/?/.test(e.url)&&bg.showModalOverlay()})}}(jQuery);