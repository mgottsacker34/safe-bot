# SafeBot

SafeBot is a chatbot for Facebook Messenger that integrates the [SafeTrek API](https://developers.safetrek.io/). It is an always-on and friendly interface the end user can connect with *silently* and without raising alarm or adding stress to the situation.

## Development

This project is currently under construction. Refer to the [Design Outline](docs/design-outline.md) document to read about SafeBot's plans.

## Running and testing

This application requires access to the SafeTrek API and the Facebook Messenger API.

You will need a live Facebook webhook and application to host a chatbot. Follow the steps [here](https://developers.facebook.com/docs/messenger-platform/getting-started/webhook-setup).

To host it, use a Heroku dyno hosting a Node.js environment. You will need a Heroku account. Check out their [documentation](https://devcenter.heroku.com/articles/getting-started-with-nodejs#introduction) to get going.
Alternatively (and probably an easier option), follow the steps [here](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start) to run the app on Glitch.

If running on Heroku, clone this repository into your local file system and run `npm install`.
If running on Glitch, you can copy and paste the contents of this repository into the Glitch GUI.

**You will need to set up a .env file with the following secret variables set:**
- FB_VERIFY_TOKEN (user-defined token to verify Facebook webhook)
- PAGE_ACCESS_TOKEN (token that FB generates in developer web portal)
- CLIENT_ID (unique SafeTrek identifier)
- CLIENT_SECRET (SafeTrek secret)

Your personal Facebook account will have admin access to the chatbot by default. When the bot is up and running, you can search for it in Messenger and start a conversation. The bot will take you through SafeTrek authorization and generating alerts.
