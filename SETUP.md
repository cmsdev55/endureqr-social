# Instagram + Facebook auto-posting: one-time setup (free)

Ek dafa ~30 minute lagenge. Us ke baad GitHub roz 14:00 UTC (Pakistan 7 baje shaam) khud post karega.
Kuch bhi paid nahi: Meta Graph API free hai, GitHub Actions free hai (roz ~1 minute).

## Kya ban chuka hai

| Cheez | Jagah |
|---|---|
| 30 din ke posts (slides, captions, hashtags) | `posts.json` |
| Images (1080×1350) aur reels (1080×1920 MP4) | `media/` → GitHub Pages pe `https://cmsdev55.github.io/endureqr-social/media/...` |
| Images/reels banane wala script | `npm run render` (laptop pe) |
| Post karne wala script | `node scripts/post.mjs` |
| Roz chalne wala workflow | `.github/workflows/social-post.yml` |

Website (StayQR repo) se is ka koi taluq nahi: yahan push karne se endureqr.com deploy nahi hoti.

---

## Step 1: Instagram ko Creator account banao aur Facebook Page se jodo

1. Instagram app → Profile → ☰ → **Settings** → **Account type and tools** → **Switch to professional account** → **Creator**.
   - **Creator kyun, Business kyun nahi:** Business accounts ko Instagram ki music library ka sirf chhota hissa milta hai
     (zyada tar mashhoor gaane nahi). Creator pe poori library milti hai, aur auto-posting dono pe chalti hai.
   - Pehle se Business hai? Usi jagah se **Switch to creator account** kar lo.
2. Facebook Page → **Settings** → **Linked accounts** → **Instagram** → apna account connect karo.
   (Ya Instagram → Settings → **Accounts Center** se.)

## Step 2: Meta developer app banao (free)

1. <https://developers.facebook.com> → apne Facebook account se login → **My Apps** → **Create App**.
2. Use case mein Instagram content publish / Pages manage wala option chuno (Meta ke screen ka naam badalta rehta hai;
   "Business" type app chalega). App ka naam: `EndureQR Poster`.
3. App **Development mode** mein hi rehne do. Aap app ke admin ho aur Page/Instagram bhi aap ke hain, is liye App Review
   ki zaroorat nahi.

## Step 3: Token nikaalo

1. <https://developers.facebook.com/tools/explorer> kholo. Upar **Meta App** mein `EndureQR Poster` chuno.
2. **Permissions** mein ye add karo:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`
3. **Generate Access Token** → apna Page aur Instagram account select karke allow karo.
4. Ye short-lived token hai. Lamba karne ke liye: <https://developers.facebook.com/tools/debug/accesstoken> → token
   paste → **Debug** → neeche **Extend Access Token**. Naya (long-lived) token copy karo.
5. Wapas Graph API Explorer mein wo long-lived token daalo aur ye query chalao: `me/accounts`
   - Jawab mein apne Page ka `access_token` aur `id` milega. **Ye Page token expire nahi hota.** Yehi `META_PAGE_TOKEN` hai.
   - `id` = `FB_PAGE_ID`.
6. Ab query chalao: `<FB_PAGE_ID>?fields=instagram_business_account`
   - Jawab ka `instagram_business_account.id` = `IG_USER_ID`.

⚠️ Token password jaisa hai. Isay kisi chat, file ya code mein mat daalna; sirf GitHub Secrets mein.

## Step 4: GitHub mein daalo

github.com/cmsdev55/endureqr-social → **Settings** → **Secrets and variables** → **Actions**

**Secrets** tab → **New repository secret** (teen dafa):

| Name | Value |
|---|---|
| `META_PAGE_TOKEN` | Step 3.5 ka Page token |
| `FB_PAGE_ID` | Step 3.5 ka id |
| `IG_USER_ID` | Step 3.6 ka id |

**Variables** tab → **New repository variable**:

| Name | Value |
|---|---|
| `SOCIAL_START_DATE` | Jis din Day 1 post ho, format `2026-11-06` (UTC date) |

## Step 5: Test karo

1. Images GitHub Pages pe live hain. Check: <https://cmsdev55.github.io/endureqr-social/media/d01-1.jpg> khulni chahiye.
2. GitHub → **Actions** → **Daily social post** → **Run workflow** → `day` = 1, **Dry run** ✅ → Run. Log mein caption aur links dikhenge.
3. Sab theek ho to dobara Run workflow, `day` = 1, Dry run ❌ → Instagram aur Facebook pe post ho jayegi.
4. Us ke baad kuch karne ki zaroorat nahi: har roz khud chalega. Ek hi din ka post do dafa nahi jata (script pehle check karta hai).

### Agar error aaye

| Error | Matlab |
|---|---|
| `returned 404` | GitHub Pages abhi deploy nahi hua. Repo → **Actions** mein "pages build and deployment" ka wait karo. |
| `Invalid OAuth access token` / `Session has expired` | Token galat ya purana. Step 3 dobara, `META_PAGE_TOKEN` update karo. |
| `(#10) ... permission` | Step 3.2 ki koi permission reh gayi. |
| `The user must be an administrator...` | Instagram professional account Page se linked nahi (Step 1). |

---

## Reels: Instagram pe haath se, sound ke saath (mahine mein ek dafa, ~20–30 minute)

Instagram ka API apni music library se sound nahi laga sakta, is liye workflow **Instagram pe reels post nahi karta**.
Carousels aur images automatic jati hain; Facebook pe reel bhi automatic jati hai.

1. Phone pe [REELS.md](REELS.md) kholo. Har reel ki date, video link, sound ka mood aur caption wahan hai.
2. Video link kholo → video save karo (iPhone: share → **Save Video**; Android: ⋮ → **Download**).
3. Instagram → **+** → **Reel** → video chuno → **Audio** (♫) → mood ke hisaab se trending sound chuno.
   Sound ka volume halka rakho, text slides padhne ka waqt milna chahiye.
4. **Next** → caption REELS.md se copy-paste → **Advanced settings** (ya **More options**) → **Schedule** → REELS.md wali date, shaam 7 baje.
5. Agle reel pe. 10 reels ~20–30 minute.

Dates `SOCIAL_START_DATE` se banti hain. Start date badli to mujhe bolo, ya laptop pe chalao:
`SOCIAL_START_DATE=2026-11-06 npm run reels` (REELS.md nayi dates ke saath ban jayegi).

Agar kabhi reels bhi bina sound ke automatic chahiye: variable `SOCIAL_REELS_AUTO` = `ig,fb`.
Facebook pe bhi reel haath se daalni ho: `SOCIAL_REELS_AUTO` = `none`.

---

## Code ke bagair option (agar ye setup mushkil lage)

**Meta Business Suite** (free): <https://business.facebook.com> → **Planner** → **Create post**. `media/` se images
uthao, caption `posts.json` se copy karo, Instagram + Facebook dono tick karke date/time schedule kar do.
30 posts ~45 minute mein schedule ho jate hain. Bas itna farq hai ke ye manual hai, aur Meta aage kitne din tak schedule
karne deta hai wo limit badalti rehti hai.

## Agle 30 din

Day 30 ke baad script kuch post nahi karega aur log mein bata dega. Mujhe kehna "next 30 posts bana do": main
`posts.json` mein day 31–60 add karke `npm run render` chala dunga.
