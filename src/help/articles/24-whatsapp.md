---
title: WhatsApp bot and inbox
screen: whatsapp
tags: whatsapp, bot, chat, inbox, meta, reply, take over, guest messages, free replies, 24 hours, webhook, token
---
Guests write to the hotel's WhatsApp number and the bot answers. Choose the bot in Setup:
- **Menu bot (free):** a menu with buttons: **Rooms & prices**, **Check availability** (the guest sends dates like *20/12 to 22/12, 2 guests*), **My booking** (found by the guest's WhatsApp number, or the booking code and last name), **Location & contact** and **Talk to staff**. Guests can also reply 1–5 or type simple words in English or Swahili. Only HotelEasy's data is used; no AI and no extra cost.
- **Smart bot (AI):** understands free questions and your extra facts. Needs the Anthropic key (paid per use); without it the menu bot answers.

**Inbox:** WhatsApp → **Inbox**. Chats marked **Person** need a reply from your team (filter **Need a person**). Open a chat and type your reply; press Enter to send.
**Take over / Let the bot answer:** when you take over (or simply reply), the bot stays quiet in that chat. Click **Let the bot answer** to hand it back.
**"Reply window closed":** WhatsApp only allows a free reply within 24 hours of the guest's last message. Wait until the guest writes again.
**Free replies this month:** Meta gives each WhatsApp number 1,000 free replies a month. With **Stop at the free limit** on, nothing is sent after that until next month, so there is no charge. HotelEasy never starts chats or sends templates (those are always charged).
**The bot doesn't answer:** check WhatsApp is on and the bot is switched on in Setup, the chat isn't taken over, this month's free replies aren't used up, and the booking page is on (Online → Setup).

**Setting it up (owner or manager):** WhatsApp → **Setup**:
1. From your Meta app (WhatsApp → API Setup) enter the **Phone number ID**, a permanent **access token** and the **app secret**.
2. Copy the **Callback URL** and **Verify token** into Meta (WhatsApp → Configuration → Webhook), verify, and subscribe to **messages**.
3. Choose **Menu bot (free)** or **Smart bot (AI)**, choose the free-limit setting, switch WhatsApp on and **Save**.
Each hotel connects its own number; one hotel's chats and information are never shown to another.
