# SafeBot

SafeBot is a chatbot for Facebook Messenger that integrates the SafeTrek API. Below are some high-level design thoughts I have before implementing the bot. Sections tagged "FB" are referenced in the Facebook Developer documentation under their [General Best Practices section](https://developers.facebook.com/docs/messenger-platform/introduction/general-best-practices).

## High-level strategy:
  - mostly utility, but needs to be pleasurable/calming.
  - people should be able to generate an alert immediately (in one step).
    - it will need to let people get help as soon as possible, but it should also stick around and obtain more information from them as necessary.
    - button/GUI to report immediate information (HELP, share location, 'are you ok?').
    - conversation to provide details. Chatbots are "an extension of the chat experience".
    - add the NLP functions of [Wit.ai](https://wit.ai) to "automatically parse and interpret intents from received messages" -> true conversation can calm a person down in time of high stress.

## Design Principles (FB):
  - Be brief: important with SafeBot b/c it depends on the fast and reliable transmission of data
  - Avoid modality (expect a specific set of responses): might have to use more of a GUI for sensitive data (give only a couple of options); also accept text messages and try to intrepret them.
  - Mix conversation and GUI: Necessary with SafeBot.
  - Observe conversational norms: do not disguise an automated interaction as a real person. Make it clear that it is a bot. I think responses should be delivered as quickly as possible because it is an alert-generating process.
  - Embrace structure
  - Be predictable: Use typing indicator to give in-progres status.
  - Notify with care: Most responses will assert a push notification.
  - Fail gracefully: if misunderstood request, reiterate capabilities. Failure = feedback, a chance to improve bot.
  - Do not create a separate entity: This will be up to SafeTrek, because I am implementing separate from them. I will stand up an independent page for testing.

## Language (FB):
  - Familiarity, no new personality -> I should try to get my hands on some existing SafeTrek examples to mimic their responses.
    - I will also rely on my English major background to communicate clearly and amicably
  - Provide context: confirm what actions people take ('I generated your alert. Sending help.'); acknowledge requests and let them know if you can handle it right away.

## Interactions (FB):
  - Create list of keywords, map out interactions.
  - If asking a question, just give buttons with specific answers instead of allowing textual response.
  - Active voice, contractions, 'I' or 'We'?

## Specific details:

  - persistent menu with set of options (immediate alert - share loc, start sharing details, info)
  - typing indicator when processing/generating alert
  - conversation handover to real person
    - message to let the person know that is happening

### Integration Components
  - Page-scoped ID (PSID) unique to FB page. On each send, include recipient PSID in `recipient.id` property of request.
  - APIs:
    - Send API: for simple text, structured template messages, assets (images, videos, audio, files); quick replies, sender actions.
    - Attachment Upload API: upload assets to Messenger Platform from URL or local file system. This API would remove overhead of uploading assets every time it is needed. I do not think this is necessary for SafeBot, but could be useful later on.
    - ID Matching API: only necessary if user interacting with multiple FB pages/apps that you own.
    - Handover Protocol API: pass control of conversation b/w multiple FB apps. Probably not necessary either.
    - Messenger Code API: advertise bot on web or elsewhere. Could be useful, but not really my primary goal.
    - Messaging Insights API: metrics.
    - Messenger Profile API: set, update, delete settings for bot.
    - not useful: Customer matching API (not customer-driven (I think?))

  - Webhook: whenever an action occurs in conversation, bot API sends an event to webhook (webhook = single HTTPS endpoint exposed that accepts POST requests). This is where the bot processes and responds to all incoming webhook events.
    - in dev, this will be the SafeTrek sandbox with RESTful API to process alerts
    - Messenger Platform supports a standard set of webhook events to which webhook can be subscribed during setup. Basic MP features: `messages`, `messaging_postbacks webhook` events.
