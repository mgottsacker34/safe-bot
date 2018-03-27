'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
let safetrek_access_token;
let safetrek_refresh_token;
let services = [];

// Import dependencies and set up http server
const
  express = require('express'),
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
      let sender_psid = webhook_event.sender.id;
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

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  let safetrek_auth_code = req.query.code;
  let safetrek_refresh_code = req.query.refresh_token;

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
        res.status(200).send('Authorization success. Close this window.');
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
function handleMessage(sender_psid, received_message) {
  let response;

  // Check if the message contains text
  if (received_message.text) {
    if (received_message.text.toLowerCase() === 'info') {
      response = {
        "text": "SafeBot is here to help. If you experience an emergency, you can send \"help\" at any time. We will take you through steps to get the help you need and someone from SafeTrek will contact you. For specific situations, send \"police\", \"fire\", or \"medical\" to send an alert to the police, the fire department, or emergency medical services, respectively."
      };
    } else if (received_message.text.toLowerCase() === 'help') {
      response = {
        "text": "If you need help, press one of the buttons below. For more general information about SafeBot, type \"info\".",
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
        "text": "Share your location, or type \"fire\" or \"medical\" if you require those services as well.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'fire') {
      services.push('fire');
      response = {
        "text": "Share your location, or type \"police\" or \"medical\" if you require those services as well.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'medical') {
      services.push('medical');
      response = {
        "text": "Share your location, or type \"police\" or \"fire\" if you require those services.",
        "quick_replies": [
          {
            "content_type": "location"
          }
        ]
      };

    } else if (received_message.text.toLowerCase() === 'login') {
      // user needs to log in again (refresh)
      let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "If you need help, press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \"info\" at any time.",
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
    // generic response when keyword is not sent
    else {
      // create payload for basic text message
      response = {
        "text": `You sent the message: "${received_message.text}"`
      }
    }
  } else if (received_message.attachments) {
    // case where attachment contains a location
    if (received_message.attachments[0].payload.coordinates) {
      //get the URL of the message attachment
      let lat = received_message.attachments[0].payload.coordinates.lat;
      let long = received_message.attachments[0].payload.coordinates.long;
      response = {
          "text": "Location received. We are sending help. One of our call center employees will contact you in a moment. If you want to cancel this alert, just type \"cancel\".",
          // "quick_replies":[
          //   {
          //     "content_type":"user_phone_number"
          //   }
          // ]
      };

      console.log("***GENERATE ALERT***\nDispatch help to:\nLat: " + lat + "\nLong: " + long);

      generateSafeTrekAlert(services, lat, long);
    }
  }

  // send the response message
  callSendAPI(sender_psid, response);

}

// Handle messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;

  // get the payload for the postback
  let payload = received_postback.payload;

  // set appropriate response
  if (payload === 'yes') {
    response = { "text": "Thanks!" };
  } else if (payload === 'no') {
    response = { "text": "Sorry about that. Try sending another." };
  } else if (payload === 'get_started') {

    // When get_started is returned, it is the first time the user interacts with SafeBot. Need to log in.
    let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \"info\" at any time.",
            "buttons": [
              {
                "type": "web_url",
                "title": "Login",
                "url": url_string
              }
            ]
          }]
        }
      }
    };


  } else if (payload === 'safetrek_login') {
    // user needs to log in again (refresh)
    let url_string = "https://account-sandbox.safetrek.io/authorize?audience=https://api-sandbox.safetrek.io&client_id=" + process.env.CLIENT_ID + "&scope=openid%20phone%20offline_access&state=statecode&response_type=code&redirect_uri=https://safe-bot.herokuapp.com/webhook";
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text": "If you need help, press the button below to login to SafeTrek. If you want to learn more about what we can do for you, type \"info\" at any time.",
          "buttons": [
            {
              "type": "account_link",
              "url": url_string
            }
          ]
        }
      }
    };

  } else if (payload === 'police') {

  } else if (payload === 'fire') {

  } else if (payload === 'medical') {

  } else if (payload === 'no_help_wanted') {

  }

  // send message to ack the postback
  callSendAPI(sender_psid, response);
}

function retrieveSTAccessTok(safetrek_auth_code) {
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
      res.status(500).send('Internal Server Error. Something went wrong. Please try again');
    }
  });
}

function updateAlarmLoc(lat, long, alarm_id) {

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

function cancelAlarm(status) {

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
      console.log("ALARM POSTED.");
      console.log(body);
      services = [];
    } else {
      console.error("Unable to post alarm:" + err);
    }
  });
}

function generateSafeTrekAlert(services, lat, long) {
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
       services = [];
     } else {
       console.error("Unable to post alarm:" + err);
     }
   });
}

// Send response messages via the Send API
function callSendAPI(sender_psid, response) {
  // construct message body
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
