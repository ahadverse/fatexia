IPHub full-response capture কাজটা শেষ করো।
memory/project_iphub_capture_wip.md পড়ো — কোথায় থেমেছিলাম ওখানে আছে।

আগে `git status` দেখে confirm করো backend-এর uncommitted কাজটা এখনো আছে কিনা।

বাকি কাজ:
1. backend-এ `npx tsc --noEmit` আর `vitest run` চালাও — proxy-detection.test.ts-এর
   নতুন "provider response capture" block একবারও run করা হয়নি
2. frontend wire করো: packages/types-এ ClickLog type, আর
   apps/admin/src/pages/reports/ClickLogs.tsx-এর drawer-এ নতুন ৬টা field দেখাও
   (admin only — affiliate portal-এ যাবে না)
3. PROGRESS.md-এ section যোগ করো

block: 2 scoring নিয়ে সিদ্ধান্ত: 0 — এখন কোনো risk যোগ করবে না (২০২৬-০৯-২২)।
কলামটা তখনো একবারও ভরেনি, তাই আমাদের ট্র্যাফিকের কত অংশকে IPHub non-residential
বলে সেটা অজানা — আর ও লেবেলটা উদারভাবে দেয় (corporate NAT, mobile carrier
gateway, CGNAT)। না জেনে ওজন বসানো মানে বৈধ অ্যাফিলিয়েটের payout band নাড়ানো।
কয়েক সপ্তাহ ডেটা জমলে আবার দেখতে হবে — PROGRESS.md-এ মাপার SQL আর
"৩০-ই একমাত্র অর্থবহ ওজন" যুক্তিটা লেখা আছে।
