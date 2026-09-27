# ProyojonX — 1 UPDATE MASTER

## MASTER RULE
এই ফাইলটাই ProyojonX-এর বর্তমান Update Master এবং Recovery Master।
বর্তমান কাজ এখানে ধারাবাহিকভাবে সংরক্ষণ করতে হবে।
পুরোনো 2 নম্বর/অন্যান্য ফাইল থেকে প্রয়োজনীয় তথ্য এখানে সমন্বয় করা হবে।
প্রজেক্ট সম্পূর্ণ ও যাচাই শেষ হওয়ার আগে পুরোনো 2 নম্বর ফাইল মুছে ফেলা যাবে না।

## PROJECT
Project: ProyojonX
Tagline: আপনার সব প্রয়োজন, এক অ্যাপ।
Platform: Bangladesh-focused Local Need-to-Solution Super App

## UI LANGUAGE RULE
সব গুরুত্বপূর্ণ Category, Option, Button, Status, Form Field এবং Feature:
বাংলা (English)

## VERIFIED V1 TRANSACTION FLOW
1. Registration — প্রথমবার Free
2. Login / Session
3. Request Creation
4. Provider Listing
5. Match Creation
6. Match Acceptance
7. দুই পক্ষের Confirmation Payment তৈরি
8. Requester 1 টাকা Confirmation Fee
9. Provider 1 টাকা Confirmation Fee
10. দুই Payment Paid হলে Match Confirmed
11. Match Completion
12. Match এবং Request Completed

## MONETIZATION
- প্রথম Registration Free
- Confirmation-এর ১ মাস পরে প্রথম Registration Fee
- এরপর প্রতি ৩ মাসে Registration Renewal Fee: ১ টাকা
- প্রতিটি Confirmed Match-এ Requester: ১ টাকা
- প্রতিটি Confirmed Match-এ Provider: ১ টাকা
- প্রতি Confirmation Transaction মোট Platform Fee: ২ টাকা

## CURRENT TECH STACK
- Node.js
- Express
- MongoDB Atlas
- Mongoose
- Express Session
- Termux
- Git / GitHub

## IMPORTANT PROJECT FILES
- server.js
- dashboard.html
- models/
- services/
- .env — কখনো GitHub-এ যাবে না

## CURRENT VERIFIED GIT CHECKPOINT
Current branch: main

Latest saved checkpoint:
6623848 feat: add cursor pagination for scalable listing routes

Previous important scalability checkpoints:
- dda806b — checkpoint: 5G-48 scalability pagination indexes performance
- 85c4df2 — checkpoint: 5G-47 scale geo hardening
- a2c4542 — checkpoint: complete 5G-44J cursor pagination and 5G-45 foundation
- 8297a88 — foundation: add location support to users products requests

## CURRENT WORK
Current dashboard work is the 8-button two-party UI structure.

Main buttons:
1. আমি পণ্য বা সেবা/সার্ভিস দিতে চাই
2. আমি পণ্য বা সেবা/সার্ভিস নিতে চাই

Provider side:
- Main Provider button
- আমার পণ্যগুলি দেখি (Refresh)
- আপনার নতুন পণ্য যোগ করুন
- Logout

Requester side:
- Main Requester button
- আমার প্রয়োজনীয় পণ্যগুলি দেখি (Refresh)
- নতুন প্রয়োজন পোস্ট করুন
- Logout

Current dashboard implementation markers:
- PROYOJONX_FINAL_TWO_PARTY_UI_V2
- PROYOJONX_PROVIDER_ADD_CLEAN_FINAL_V1
- PROYOJONX_REQUESTER_ADD_CLEAN_FINAL_V1
- PROYOJONX_FINAL_ACTION_LOGOUT_CONTROLLER_V1
- PROYOJONX_RESTORE_8_STABLE_BUTTONS_CLEAN_V1

## CURRENT VALIDATION
server.js syntax:
OK

MongoDB:
Connected Successfully

Server:
Running on port 3000

Current dashboard baseline:
- main-choice-btn = 2
- Provider Refresh controller exists
- Requester Refresh controller exists
- Provider Add / Requester Add are dynamically created
- Provider Logout / Requester Logout are dynamically created

IMPORTANT:
The Add and Logout IDs are dynamically created by JavaScript, so static grep may show 0 even though the controllers exist.

## CURRENT BACKUP
dashboard.html.step4e-backup

## GITHUB
Remote:
https://github.com/mdsydujjaman/ProyojonX.git

Branch:
main

Rule:
Every verified major change should be committed and pushed to GitHub.
Never commit .env or secrets.

## SD CARD RECOVERY MASTER
SD Card:
 /storage/4433-2211/ProyojonX-Master/

Recovery file:
 /storage/4433-2211/ProyojonX-Master/1-UPDATE-MASTER.md

The SD card is intended to keep the main recovery/update master only.

## CONTINUATION RULE
Never restart ProyojonX from zero.
Continue from the latest verified GitHub checkpoint and this 1-UPDATE-MASTER.md.

Before making major changes:
1. Check current Git status.
2. Preserve verified working flow.
3. Make a backup when appropriate.
4. Test.
5. Update this Master File.
6. Commit.
7. Push to GitHub.
8. Sync this Master File to the SD card.

## IMPORTANT
Do not delete old 2-number/reference files until the project is completed and all useful information has been merged into this Master File.
