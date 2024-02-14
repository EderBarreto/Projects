var botMicrosoftTeams = Class.create();
botMicrosoftTeams.prototype = {
    initialize: function() {},

    _getGroupMembers: function(groupsID) {
        var list = [];
        var grM = new GlideAggregate('sys_user_grmember');
        grM.addEncodedQuery('user.active=true^group.active=true^user.emailISNOTEMPTY');
        grM.addEncodedQuery('groupIN' + groupsID + '^ORgroup.parentIN' + groupsID + '^ORgroup.parent.parentIN' + groupsID + '^ORgroup.parent.parent.parentIN' + groupsID + '^ORgroup.parent.parent.parent.parentIN' + groupsID + '^ORgroup.parent.parent.parent.parent.parentIN' + groupsID + '^ORgroup.parent.parent.parent.parent.parent.parentIN' + groupsID);
        grM.addAggregate('count', 'user');
        grM.query();
        while (grM.next()) {
            list.push(grM.getValue('user'));
        }

        return list;
    },

    _getRecipients: function(usersID, groupsID) {
        var list = [];
        list = this._getGroupMembers(groupsID).concat(usersID);
        list = this._getUserTeams(list);
        var unique = new global.IrisVirtualAgent().clearList(list);
        //var unique = new global.ArrayUtil().unique(list);

        return unique;
    },

    _getContentBase64: function(table, rec) {
        /* GLOBAL SCOPE
        var gr = new GlideRecord('sys_attachment'); gr.get('table_sys_id', rec); var gsa = new global.GlideSysAttachment().getBytes(gr); var data64 = GlideStringUtil.base64Encode(gsa);*/

        // SCOPED
        var gsa = new GlideSysAttachment();
        var agr = gsa.getAttachments(table, rec);

        if (agr.next()) {
            var data64 = gsa.getContentBase64(agr);
        }

        return data64;
    },

    _getAttachment: function(table, req) {
        var gr = new GlideRecord('sys_attachment');
        gr.addQuery('table_sys_id', req);
        gr.addQuery('table_name', table);
        gr.query();
        if (gr.next()) {
            var image = gr.getUniqueValue();
            image = "https://" + gs.getProperty("instance_name") + ".service-now.com/" + image + ".iix";
        }

        return image;
    },

    _getRecord: function(table, recordId) {
        var ga = new GlideAggregate(table);
        ga.addQuery('sys_id', recordId);
        ga.query();
        if (ga.next()) {
            return ga;
        }
    },

    _usageStats: function(eventName, table, targetUserId, sourceUserId) {
        var usageData = {
            table: table,
            targetUser: targetUserId,
            sourceUser: sourceUserId,
            eventName: eventName
        };
        var usageStats = new sn_now_teams.MSTeamsUsageStats().updateUsageStats(usageData);
    },

    _cardCreate: function(ga, titulo, subtitulo, texto, backgroundImage, campo_url) {
        var card = [];
        var actions = [];

        var header = {
            "id": "header",
            "type": "Container",
            "bleed": true,
            "minHeight": "100px",
            "verticalContentAlignment": "center",
            "backgroundImage": {
                "url": backgroundImage,
                "fillMode": "cover",
                "HorizontalAlignment": "center",
                "VerticalAlignment": "center"
            },
            "items": [{
                "type": "TextBlock",
                "weight": "Bolder",
                "wrap": true,
                "size": "Medium",
                "text": titulo
            }]
        };
        card.push(header);

        if (subtitulo) {
            var subheader = {
                "id": "subheader",
                "type": "TextBlock",
                "separator": true,
                "wrap": true,
                "text": subtitulo
            };
            card.push(subheader);
        }

        var body = {
            "id": "body",
            "type": "TextBlock",
            "wrap": true,
            "spacing": "large",
            "size": "medium",
            "text": texto
        };
        card.push(body);

        if (campo_url) {
            var action = {
                "type": "Action.OpenUrl",
                "title": "Abrir link relacionado",
                "url": campo_url
            };
            actions.push(action);
        }

        var notification = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "type": "AdaptiveCard",
            "body": card,
            "actions": actions,
        };

        return notification;
    },

    _cardSend: function(card, table, recordId, targetUserId, sourceUserId, eventName) {

        //teste
		

        if (card) {
            //Send card at Microsoft Teams
            var outBoundMessage = new sn_now_teams.MSTeamsOutboundMessages();
            var response = outBoundMessage.sendDirectMessage(targetUserId, "adaptiveCard", card);

            //Updating the usage stats at table sn_now_teams_outbound_message
            var outBoundStats = new sn_now_teams.MSTeamsPersonalMessageUtils();
            outBoundStats._insertOutboundMsgRecord(targetUserId, table, recordId, card, response);

            //Updating the usage stats at table sn_now_teams_usage
            this._usageStats(eventName, table, targetUserId, sourceUserId);
        }
	
    },


	
        
    _IRISNotifica: function(ga, recordId, sourceUserId, eventName, backgroundDefault, campo_url) {
		var user = new GlideRecord('sys_user'); //teste inicio
        user.addQuery('sys_id', sourceUserId);
        user.addQuery('active', active); //novo teste 
        user.query();
        if (!user.next()) {
            return;
        }
		else{
        //teste fim
        if (!ga || !recordId) {
            return;
        }

        var titulo = ga.getValue('title');
        var subtitulo = "";
        var texto = ga.getValue('summary');

        var notification = this._cardCreate(ga, titulo, subtitulo, texto, backgroundDefault, campo_url);

        //Background image uploaded at item catalog
        var req = ga.getValue('u_iris_notifica_request');
        backgroundImage = this._getAttachment('ZZ_YYsc_req_item', req); //Check if image attached using item catalog
        if (backgroundImage) {
            notification.body[0].backgroundImage.url = backgroundImage;
        }

        var users = ga.getValue('u_notification_users');
        var groups = ga.getValue('u_notification_groups');
        var recipients = this._getRecipients(users, groups);
        // 		recipients = this._getUserTeams(recipients);
        for (i = 0; i < recipients.length; i++) {
            this._cardSend(notification, 'announcement', recordId, recipients[i], sourceUserId, eventName);
        }
	}
	
    },

    trigger: function(table, recordId, backgroundImage, eventName, sourceUserId, targetUserId, titulo, subtitulo, texto, campo_url, customCard) {


        if (table && recordId) {
            var ga = this._getRecord(table, recordId);
        }

        if (!ga) {
            return;
        }

        var backgroundDefault = "https://" + gs.getProperty("instance_name") + ".service-now.com/Iris.Color.png"; //Default value to IRIS color

        //Default values
        if (!sourceUserId) sourceUserId = gs.getProperty('itau.user.admin.sysid'); // System Administrator
        if (!eventName) eventName = 'iris.notifica'; //Default event to IRIS analytics
        if (!backgroundImage) backgroundImage = backgroundDefault;

        //Tabela Announcement - IRIS Notifica
        if (table === 'announcement') {
            this._IRISNotifica(ga, recordId, sourceUserId, eventName, backgroundDefault, campo_url);
        } else if (table === 'sc_req_item' || table === 'sc_request' || table === 'asmt_assessment_instance' || table === 'sc_task' || table === 'u_icube_parametros') {
            this._IRISNotificaV2(table, ga, recordId, targetUserId, sourceUserId, eventName, titulo, subtitulo, texto, backgroundImage, campo_url);
        } else {
            //Other Notification
            if (!targetUserId) {
                return;
            }

            var notification = this._cardCreate(ga, titulo, subtitulo, texto, backgroundImage, campo_url);
            if (customCard) {
                notification = customCard; //Allows to alter to a custom card object
            }
            this._cardSend(notification, table, recordId, targetUserId, sourceUserId, eventName);
        }
    },
    _getUserTeams: function(user) {
        var validUsers = [];
        var provider = new GlideRecord('provider_user_map');
        provider.addEncodedQuery('active=true^user.sys_idIN' + user);
        provider.query();
        while (provider.next()) {
            validUsers.push(provider.user.sys_id);
        }
        this._sendNotification(user, validUsers);
        return validUsers;
    },
    _sendNotification: function(user, validUsers) {
        var email = user.toString().split(',');
        for (var i = 0; i < validUsers.length; i++) {
            var pos = email.indexOf(validUsers[i].trim());
            email.splice(pos, 1);
        }

        var getUser = new GlideRecord('sys_user');
        getUser.addEncodedQuery('sys_idIN' + email);
        getUser.query();
        while (getUser.next()) {
            gs.eventQueue('sn_now_teams.iris.notifica.email', getUser, getUser.email);
            //             gs.eventQueue('iris.notifica.email');
        }
    },
    _IRISNotificaV2: function(table, ga, recordId, targetUserId, sourceUserId, eventName, titulo, subtitulo, texto, backgroundImage, campo_url) {
		var user = new GlideRecord('sys_user'); //teste inicio
        user.addQuery('sys_id', targetUserId);
        user.addQuery('active', false);//TESTE
        user.query();
        if (!user.next()) {
            return;
        }
		else{
        //teste fim

        if (!ga || !recordId) {
            return;
        }

        var notification = this._cardCreate(ga, titulo, subtitulo, texto, backgroundImage, campo_url);

        //Background image uploaded at item catalog
        backgroundImage = this._getAttachment('ZZ_YYsc_req_item', recordId); //Check if image attached using item catalog
        if (backgroundImage) {
            notification.body[0].backgroundImage.url = backgroundImage;
        }

        var users = targetUserId;
        var groups = sourceUserId;
        var recipients = this._getRecipients(users, groups);
        for (i = 0; i < recipients.length; i++) {
            this._cardSend(notification, table, recordId, recipients[i], sourceUserId, eventName);
        }
		}
    },

    type: 'botMicrosoftTeams'
};
//To create a Custom Card, get support at https://adaptivecards.io/explorer