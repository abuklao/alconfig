var familyOnboardingTour=function(){"use strict";var t,e;return t={name:"familyOnboardingTour",showDate:new Date,isLater:!1,isAvailable:function(){return LPFeatures.allowFamilies()&&LPProxy.isFamilyUser()&&!LPProxy.getPreference("seenFamilyOnboardingTour")}},e={welcomeStep:{class:"family-onboarding-override family-onboarding-welcome-step",title:Strings.translateString("Welcome to Families!"),contentText1:Strings.translateString("Take a tour of your new vault to explore some of the new features of your LastPass Family account."),buttons:[{style:"family-close-button btn-link",text:Strings.translateString("Maybe later"),action:"close"},{style:"family-next-button btn-primary",text:Strings.translateString("Take the tour"),action:"start"}],position:{targetId:"#header",align:"left",orientation:"top",offset:{left:200,top:150}},shadeOn:!0,openAction:function(){LPVault.maximizeLeftMenu(),bg.sendLpImprove("family::onboarding::tour::welcome")},exitAction:"close"},steps:[{class:"family-onboarding-override family-onboarding-step family-onboarding-step-two",title:Strings.translateString("Welcome to the family"),contentText1:Strings.translateString("Invite members to your family, all you need is the email address and name of the person you'd like to invite."),buttons:[{style:"family-close-button btn-link",text:Strings.translateString("Close"),action:"close"},{style:"family-next-button btn-primary",text:Strings.translateString("Next"),action:"next"}],position:{targetId:"#familyAdminConsoleMenuItem",align:"top",orientation:"left",offset:{left:20,top:-25},pingOffset:{left:115,top:0}},openAction:function(){$("#familyAdminConsoleMenuItem").addClass("selected")},exitAction:"close"},{class:"family-onboarding-override family-onboarding-step",title:Strings.translateString("Share as much as you like"),contentText1:Strings.translateString("Share with your family quickly and easily with unlimited family folders."),buttons:[{style:"family-close-button btn-link",text:Strings.translateString("Close"),action:"close"},{style:"family-next-button btn-primary",text:Strings.translateString("Next"),action:"next"}],position:{targetId:"#sharingMenuItem",align:"top",orientation:"left",offset:{left:20,top:-25},pingOffset:{left:115,top:0}},openAction:function(){$("#familyAdminConsoleMenuItem").removeClass("selected"),$("#sharingMenuItem").children(":first").click()},exitAction:"close"},{class:"family-onboarding-override family-onboarding-step",title:Strings.translateString("In case of an emergency"),contentText1:Strings.translateString("Designate a family member to receive access to your LastPass account in case of an emergency."),buttons:[{style:"family-close-button btn-link",text:Strings.translateString("Close"),action:"close"},{style:"family-next-button btn-primary",text:Strings.translateString("Next"),action:"exit"}],position:{targetId:"#emergencyAccessMenuItem",align:"top",orientation:"left",offset:{left:20,top:-25},pingOffset:{left:115,top:0}},openAction:function(){$("#emergencyAccessMenuItem").children(":first").click()},exitAction:"close"}],exitStep:{class:"family-onboarding-override family-onboarding-step family-onboarding-last-step",title:Strings.translateString("Congratulations, you're ready to go!"),contentText1:Strings.translateString("Protect your family and share your digital lives securely. Enjoy the simplicity and security of your LastPass Families subscription. "),buttons:LPProxy.isFamilyAdmin()?[{style:"family-close-button btn-link",text:Strings.translateString("Skip for now"),action:"never"},{style:"family-next-button btn-primary invite-family-members",text:Strings.translateString("Invite family members"),action:function(){LPProxy.setPreferences("seenFamilyOnboardingTour",!0),bg.openFamilyConsole(),this.invisibleShade.cleanup(),this.darkShade.cleanup()}}]:[{style:"family-next-button btn-primary get-started",text:Strings.translateString("Get started"),action:"never"}],position:{targetId:"#header",align:"left",orientation:"top",offset:{left:200,top:150}},shadeOn:!0,exitAction:"never"}},{getTourSettings:function(){return t},getTourData:function(){var t=Object.assign({},e);return LPProxy.isFamilyAdmin()||t.steps.shift(),t}}}();