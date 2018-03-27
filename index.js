'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
var self = this;
// In production, these tokens and alarm details should be saved in a DB keyed on the user's unique PSID.
let sender_psid;
let safetrek_access_token;
let safetrek_refresh_token;
let services = [];
let alarm_id = "";
let alarm_loc;

// Import dependencies and set up http server
const
  express = require('express'),
  path = require('path'),
  bodyParser = require('body-parser'),
  request = require('request'),
  app = express().use(bodyParser.json()); // creates express http server


// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Creates the endpoint for the webhook
app.post('/webhook', (req, res) => {

  let body = req.body;

  // Check this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple entries if batched
    body.entry.forEach(function(entry) {
      // Gets the message. entry.messaging is an array, but will only ever
      // contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      // console.log(webhook_event);

      // Get sender PSID
      sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and act accordingly
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Add support for GET requests to the webhook
app.get('/webhook', (req,res) => {

  // FB verify token. Should be a random string.
  let VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  let safetrek_auth_code = req.query.code;
  let safetrek_refresh_code = req.query.refresh_token;

  // these steps are needed for FB webhook verification
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks that the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED.');
      res.status(200).send(challenge);
    } else {
      // Reponds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else if (safetrek_auth_code) {
    console.log('SAFETREK AUTHORIZATION CODE RECEIVED: ' + safetrek_auth_code);
    console.log("RETRIEVING ACCESS TOKEN.");
    let request_body = {
      "grant_type": "authorization_code",
      "code": safetrek_auth_code,
      "client_id": process.env.CLIENT_ID,
      "client_secret": process.env.CLIENT_SECRET,
      "redirect_uri": "https://safe-bot.herokuapp.com/webhook"
    };

    request({
      "uri": "https://login-sandbox.safetrek.io/oauth/token",
      "headers": "Content-Type: application/json",
      "method": "POST",
      "json": request_body
    }, (err, response, body) => {
      if (!err) {
        console.log(body);
        safetrek_access_token = body.access_token;
        safetrek_refresh_token = body.refresh_token;
        res.status(200).sendFile(__dirname + "/views/auth-success.html");

        let response = {
          "text": "Successful login.  To start an alert, type \'help\'."
        }
        callSendAPI(sender_psid, response);
      } else {
        console.error("Unable to attain SafeTrek access token:" + err);
        res.status(500).send('Internal Server Error. Something went wrong. Please try again');
      }
    });
  } else if (safetrek_refresh_code) {
    console.log('REFRESHING TOKEN.');

  }
});

// Handle message events
function handleMessage (sender_psid, received_message) {
  // set Seen indicator and begin processing
  markSeen(sender_psid);
  typingOn(sender_psid);

  let response;

  // Check if the message contains text
  if (received_message.text) {
    if (received_message.text.toLowerCase() === 'info') {
      response = {
        "text": "SafeBot is here to help. If you experience an emergency, type \'help\'. We will send the help you need and someone from SafeTrek will contact you. For specific situations, you can send \'police\', \'fire\', or \'medical\' to send an alert to the police, the fire department, or emergency medical services, respectively."
      };
    } else if (received_message.text.toLowerCase() === 'help') {
      response = {
        "text": "If you need help, press one of the buttons below.",
        "quick_replies": [
          {
            "content_type": "text",
            "title": "Police",
            "payload": "police"
          },
          {
            "content_type": "text",
            "title": "Fire",
            "payload": "fire"
          },
          {
            "content_type": "text",
            "title": "Medical",
            "payload": "medical"
          },
          {
            "content_type": "text",
            "title": "I'm okay",
            "payload": "no_help_wanted"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'police') {
      services.push("police");
      response = {
        "text": "Share your location, or type \'fire\' or \'medical\' if you require those services as well.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'fire') {
      services.push('fire');
      response = {
        "text": "Share your location, or type \'police\' or \'medical\' if you require those services as well.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'medical') {
      services.push('medical');
      response = {
        "text": "Share your location, or type \'police\' or \'fire\' if you require those services.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'login') {
      // TODO: Use FB's account linking. Not necessary, but could be beneficial.
      let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "If you need help, press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \'info\' at any time.",
            "buttons": [
              {
                "type": "account_link",
                "url": url_string
              }
            ]
          }
        }
      };
    } else if (received_message.text.toLowerCase() === 'cancel') {
      if (alarm_id.length > 0) {
        cancelAlarm(alarm_id);
        response = {
          "text": "Alarm canceled."
        }
      } else {
        response = {
          "text": "There is no alarm to cancel."
        }
      }
    } else if (received_message.text.toLowerCase() === 'location') {
      if (alarm_id) {  // existing alarm, update
        response = {
          "text": "Please share your new location.",
          "quick_replies": [
            {
              "content_type": "location"
            }
          ]
        };
      } else {  // no alarm in existence, start one
        response = {
          "text": "We will dispatch help to your location.",
          "quick_replies": [
            {
              "content_type": "location"
            }
          ]
        };
        services.push('police');
      }
    } else if (received_message.text.toLowerCase() === "i'm okay") {
      if (alarm_id) {
        cancelAlarm(alarm_id);
        response = {
          "text": "Great! Glad to hear it. We canceled your alarm."
        }
      } else {
        response = {
          "text": "Great! Don't hesitate to reach out if you ever need help. Learn more about SafeBot by typing\'info\'."
        }
      }
    }
    // generic response when keyword is not sent (echo back to user - dev only)
    else {
      response = {
        "text": `You sent the message: "${received_message.text}"`
      }
    }
  } else if (received_message.attachments) {
    // case where attachment contains a location
    if (received_message.attachments[0].payload.coordinates) {
      let lat = received_message.attachments[0].payload.coordinates.lat;
      let long = received_message.attachments[0].payload.coordinates.long;
      // handle case where alarm location has not been set
      if (alarm_id.len == 0) {
        console.log("New:" + alarm_id + " " + alarm_loc);
        //get the URL of the message attachment
        response = {
            "text": "Location received. We are sending help. One of our call center employees will contact you in a moment. If you want to cancel this alert, just type \'cancel\'. Type \'location\' to update your location.",
        };
        console.log("***GENERATE ALERT***\nDispatch help to:\nLat: " + lat + "\nLong: " + long);
        generateSafeTrekAlert(services, lat, long);
      } else {
        console.log("Update:" + alarm_id + " " + alarm_loc);
        // alarm location has already been set, need to update it
        response = {
            "text": "Location updated. We have notified the responders.",
        };
        console.log("UPDATE LOCATION to:\nLat: " + lat + "\nLong: " + long);
        updateAlarmLoc(lat, long, alarm_id);
      }
    }
  }
  typingOff(sender_psid);
  // send the response message
  callSendAPI(sender_psid, response);
}

// Handle messaging_postbacks events
function handlePostback (sender_psid, received_postback) {
  markSeen(sender_psid);
  typingOn(sender_psid);
  let response;

  // get the payload for the postback
  let payload = received_postback.payload;
  console.log(payload);

  // set appropriate response
  if (payload === 'get_started') {
    // When get_started is returned, it is the first time the user interacts with SafeBot. Need to log in.
    let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text": "Press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \'info\' at any time.",
          "buttons": [
            {
              "type": "web_url",
              "url": url_string,
              "title": "Login",
              "webview_height_ratio": "full",
              "webview_share_button": "hide"
            }
          ]
        }
      }
    };
  } else if (payload === 'safetrek_login') {  // never gets called. Can adjust payload of Get Started button to hit this instead of get_started when implemented. Develop this functionality and test by typing 'login' and sending as message.
    // user needs to log in
    let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text": "If you need help, press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \'info\' at any time.",
          "buttons": [
            {
              "type": "account_link",
              "url": url_string
            }
          ]
        }
      }
    };
  }
  typingOff(sender_psid);
  // send message to ack the postback
  callSendAPI(sender_psid, response);
}

// not called anymore; interior code put directly in GET handling at top
function retrieveSTAccessTok (safetrek_auth_code) {
  console.log("RETRIEVING ACCESS TOKEN.");

  let request_body = {
    "grant_type": "authorization_code",
    "code": safetrek_auth_code,
    "client_id": process.env.CLIENT_ID,
    "client_secret": process.env.CLIENT_SECRET,
    "redirect_uri": "https://safe-bot.herokuapp.com/webhook"
  };

  request({
    "uri": "https://login-sandbox.safetrek.io/oauth/token",
    "headers": "Content-Type: application/json",
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log(body);
      safetrek_access_token = body.access_token;
      safetrek_refresh_token = body.refresh_token;
    } else {
      console.error("Unable to attain SafeTrek access token:" + err);
    }
  });
}

function refreshSafeTrekTok () {
  let request_body = {
    "grant_type": "refresh_token",
    "code": safetrek_refresh_code,
    "client_id": process.env.CLIENT_ID,
    "client_secret": process.env.CLIENT_SECRET,
  };

  request({
    "uri": "https://login-sandbox.safetrek.io/oauth/token",
    "headers": "Content-Type: application/json",
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log(body);
      safetrek_access_token = body.access_token;
      // the response does not contain a refresh_token ?
      // safetrek_refresh_token = body.refresh_token;
      res.status(200).send('Authorization success.');
    } else {
      console.error("Unable to attain SafeTrek access token:" + err);
      res.status(500).send("Internal Server Error. Something went wrong. Please try again");
    }
  });
}

function updateAlarmLoc (lat, long, alarm_id) {
  let request_body = {
    "coordinates": {
      "lat": lat,
      "lng": long,
      "accuracy": 5
    }
  }
  let request_uri = "https://api-sandbox.safetrek.io/v1/alarms/" + alarm_id + "/locations";
  let auth_string = "Bearer " + safetrek_access_token;

  request({
    "uri": request_uri,
    "headers": {
      "Authorization": auth_string,
      "Content-Type": "application/json"
    },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log("LOCATION UPDATED.");
      console.log(body);
      services = [];
    } else {
      console.error("Unable to update location:" + err);
    }
  });
}

function cancelAlarm (alarm_id) {
  let request_body = {
    "status": "CANCELED"
  };
  let request_uri = "https://api-sandbox.safetrek.io/v1/alarms/" + alarm_id + "/status";
  let auth_string = "Bearer " + safetrek_access_token;

  request({
    "uri": request_uri,
    "headers": {
      "Authorization": auth_string,
      "Content-Type": "application/json"
    },
    "method": "PUT",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log("ALARM CANCELED.");
      console.log(body);
      services = [];
      alarm_id = "";
    } else {
      console.error("Unable to cancel alarm:" + err);
    }
  });
}

function generateSafeTrekAlert (services, lat, long) {
   let police = services.includes('police');
   let fire = services.includes('fire');
   let medical = services.includes('medical');

   let auth_string = "Bearer " + safetrek_access_token;

   let request_body = {
     "services": {
       "police": police,
       "fire": fire,
       "medical": medical
     },
     "location.coordinates": {
       "lat": lat,
       "lng": long,
       "accuracy": 5
     }
   };

   request({
     "uri": "https://api-sandbox.safetrek.io/v1/alarms",
     "headers": {
       "Authorization": auth_string,
       "Content-Type": "application/json"
     },
     "method": "POST",
     "json": request_body
   }, (err, res, body) => {
     if (!err) {
       console.log("ALARM POSTED.");
       console.log(body);
       alarm_id = body.id;
       services = []; // clear services array for new request
     } else {
       console.error("Unable to post alarm:" + err);
     }
   });
}

// Send response messages via the Send API
function callSendAPI(sender_psid, response) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // send the HTTP request to the Messenger Platform API
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!');
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

function markSeen (sender_psid) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    }
  };

  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "sending_action": "mark_seen",
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log("marked seen");
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

function typingOn (sender_psid) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    }
  };

  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "sending_action": "typing_on",
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log("typing on");
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

function typingOff (sender_psid) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    }
  };

  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "sending_action": "typing_off",
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log("typing off");
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}
