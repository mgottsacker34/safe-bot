# SafeBot

SafeBot is a chatbot for Facebook Messenger that integrates the [SafeTrek API](https://developers.safetrek.io/). Below are some high-level design thoughts I have before starting implementation of the bot. Sections tagged "FB" are referenced in the Facebook Developer documentation under their [General Best Practices section](https://developers.facebook.com/docs/messenger-platform/introduction/general-best-practices).

Things to think about:

1. Who is the target user and how will they use it?
2. Functionality/Features
3. UI Outline
4. How will you build?
5. Future Ideas (Features and Usage)
6. Project Plan/Priorities

## Target user
The end user of SafeBot is someone who experiences an emergency and does not have the SafeTrek app on their phone or does not think to open it up.
Additionally, the end user is someone experiencing an emergency under situational duress. In this case, SafeBot is an always-on and friendly interface the person can connect with *silently* and without raising alarm or adding stress to the situation. It offers an alternative way for the user to report an emergency that complements the SafeTrek app.

## High-level strategy for functionality:
  - mostly utility, but needs to be pleasurable/calming for the end user.
    - people should be able to generate an alert immediately (in one step).
  - it will need to let people get help as soon as possible, but it should also stick around and obtain more information from them as necessary.
    - conversational to provide details. Chatbots are "an extension of the chat experience".
    - add the NLP functions of [Wit.ai](https://wit.ai) to "automatically parse and interpret intents from received messages" -> true conversation can calm a person down in time of high stress.
  - bot will connect user to real person for follow-up information gathering, checking up on the user after the event is resolved, etc.

## UX Outline

### Design principles (FB):
  - Be brief: important with SafeBot b/c it depends on the fast and reliable transmission of data
  - Avoid modality (expect a specific set of responses): will have to use more of a GUI for sensitive data (give only a couple of options); also accept textual messages and try to interpret them.
  - Mix conversation and GUI: Necessary with SafeBot.
  - Observe conversational norms: do not disguise an automated interaction as a real person. Make it clear that it is a bot. I think responses should be delivered as quickly as possible because it is an alert-generating process (rather than delaying responses to mimic a more conversational setting).
  - Embrace structure
  - Be predictable: Use typing indicator to give in-progress status.
  - Notify with care: Most responses will assert a push notification.
  - Fail gracefully: if misunderstood request, reiterate capabilities. Failure = feedback, a chance to improve bot.
  - Do not create a separate entity: This bot should eventually be attached to the [SafeTrek Facebook page](https://www.facebook.com/SafeTrek/) so that users can search for SafeTrek and easily start communicating with it. Because I am implementing on my own at first, I will stand up an independent page for testing.

#### Language (FB):
  - Familiarity, no new personality -> I will try to get my hands on some existing SafeTrek examples to mimic their responses where appropriate.
    - I will also rely on my English major background to communicate clearly and amicably.
  - Provide context: confirm what actions people take ('I generated your alert. Sending help.'). Acknowledge requests and let them know if the bot can handle it right away or if additional actions are taken.

#### Interactions (FB):
  - Create list of keywords, map out interactions.
  - If asking a question, just give buttons with specific answers instead of allowing textual response.
  - Active voice, contractions, 'I' or 'We'?

## Specific implementation and UI details:

  - persistent menu with set of options
  - quick and detail-oriented bot at beginning of conversation
  - typing indicator when processing/generating alert
  - conversation handover to real person
    - message to let the person know that transition is happening

### Integration components (FB)
  - Page-scoped ID (PSID) unique to FB page. On each send, include recipient PSID in `recipient.id` property of request.
  - APIs:
    - Send API: for simple text, structured template messages, assets (images, videos, audio, files); quick replies, sender actions.
    - Attachment Upload API: upload assets to Messenger Platform from URL or local file system. This API would remove overhead of uploading assets every time it is needed. I am unsure if this is necessary for SafeBot at this point, but we'll see.
    - Messaging Insights API: metrics.
    - Messenger Profile API: set, update, delete settings for bot.
    - not useful at this stage:
      - Customer Matching API (not customer-driven for prototype)
      - Messenger Code API: advertise bot on web or elsewhere. Could be useful later, but not my primary goal at this stage.
      - ID Matching API: only necessary if user interacting with multiple FB pages/apps that you own.
      - Handover Protocol API: pass control of conversation b/w multiple FB apps. Probably not necessary either.

  - [Webhook](https://developers.facebook.com/docs/messenger-platform/webhook): whenever an action occurs in conversation, bot API sends an event to webhook (webhook = single HTTPS endpoint exposed that accepts POST requests). This is where the bot processes and responds to all incoming webhook events.
    - in development, this will hit the SafeTrek sandbox and RESTful API to process alerts.
    - Messenger Platform supports a standard set of [webhook events](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/) to which the webhook can be subscribed during setup. Basic MP features: `messages`, `messaging_postbacks webhook` events.
  - Messenger Webview: This webview allows more complex operations. It does not seem necessary at this stage, but there is an opportunity for future extensibility here.
  - Built-in natural language processing: [Wit.ai](https://wit.ai) can analyze message intents. This seems like a great way to infer the end user's goal. This will be able to be extended in the future to improve responses.

### Conversation components (FB)
  - Text Messages: basic text. Foundational building block of the chatbot. Must be conversational.
  - Message Templates: structure messages types (GUI in-conversation). The [button template](https://developers.facebook.com/docs/messenger-platform/send-messages/template/button) and [list template](https://developers.facebook.com/docs/messenger-platform/send-messages/template/list) seem quite useful here.
  - Quick Replies: present a set of options to end user. There should be one of these with an option to generate alert and share location when the user begins a conversation with SafeBot.
  - Sender Actions: these will control things like setting read receipts and typing indicators when processing a request.
  - Welcome Screen: This should be basic and contain few words/images.
  - Persistent Menu: always available set of options
    - immediate alert - share location
    - start sharing details
    - general information

## Plan of action
The steps below are outlined in Facebook's [Getting Started documentation](https://developers.facebook.com/docs/messenger-platform/getting-started).
1. Set up webhook
    - This is the core of the Messenger Platform integration. It is the point where messages are received, processed, sent. This is where the code will live that hits the SafeTrek API when the user wishes to generate an alert. The webhook handles the integration components described above.
2. Set up FB app
    - This is the connection between the Messenger front-end and the webhook. The webhook gets connected to the app, and the app is subscribed to a Page so that it can receive webhook events.
3. Build the bot
    - This is the front-end of the SafeTrek integration. It will incorporate the conversation components and UX design principles described above.

## Future extensions
- The Messenger Platform supports a variety of advertising integrations. These can and should be leveraged to reach more people and let them know that this safety alert system is easily accessible in multiple formats.
- The webview can be leveraged to allow complex processing. This bot will focus on simple conversations, so if there is more complex functionality required later on, it will likely be possible to add it. This could include a dynamic map rendering to convey the location of first responders.
- The built-in NLP will always have the opportunity for improvement. Conversation failures should be examined to figure out where the bot misinterprets intents.
