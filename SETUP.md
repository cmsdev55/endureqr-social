# Instagram + Facebook + X auto-posting: one-time setup

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

## Reels: ab poori tarah automatic (original music ke saath)

Har reel mein **apna banaya hua background music** hai (`scripts/music.mjs`, code se bana, kisi gaane ya library se
nahi), is liye copyright ki wajah se reel kabhi mute nahi hogi. Mood `posts.json` ke `sound` se aata hai:
upbeat, calm ya tense (scam alert). Workflow reels Instagram aur Facebook dono pe khud post karta hai
(variable `SOCIAL_REELS_AUTO` = `ig,fb`). Aap ko kuch nahi karna.

- Naye reels: `npm run render` music khud laga deta hai. Sirf music dobara banana ho: `npm run music` (ya `npm run music -- 5`).
- Kabhi kisi reel pe Instagram ka trending sound haath se lagana ho: `SOCIAL_REELS_AUTO` = `fb`, phir
  [REELS.md](REELS.md) aur reminder workflow (Actions → **Reel reminder** → **Enable workflow**) wapas kaam karte hain.

---

## X (Twitter): roz email reminder, haath se post (free) ← abhi yehi chal raha hai

Har subah ~8 baje (Pakistan) **X reminder** workflow aap ko GitHub issue assign karta hai, aur GitHub us ka **email**
bhejta hai (aur GitHub app pe notification). Email mein:

1. **"Open X with today's text already filled in"** link: dabao, X khulega, text likha hua hoga.
2. Images / video ke links: save karke X mein 🖼️ se lagao.
3. Post karo, ya 🕒 se shaam 7 baje schedule karo.

Haath se post karne ke paise nahi lagte, is liye reminder wale text mein guide ka link bhi hai. Agle din purana
reminder khud close ho jata hai.

**Setup (2 minute):**
- Kuch nahi: push hote hi workflow chalne lagta hai (`SOCIAL_START_DATE` pehle se set hai).
- Email nahi aa raha? github.com → profile photo → **Settings → Notifications** → "Participating, @mentions and
  custom" mein **Email** ✅ hona chahiye, aur upar wala email woh ho jo aap check karte ho. Spam folder bhi dekh lo.
- Test: **Actions → X reminder → Run workflow** (Dry run ❌) → turant issue + email.

`SOCIAL_PLATFORMS` mein `x` **mat** daalna jab tak paid API (neeche) use na karni ho, warna X pe do dafa post hoga.

---

## X (Twitter) auto-posting (optional, paid API)

Agar baad mein haath se post karna mushkil lage: wahi daily workflow X pe khud bhi post kar sakta hai. Phir
**Actions → X reminder → ⋯ → Disable workflow** kar dena. Har din ka X wala text `posts.json` mein `x` field mein hai (280 characters
ke andar). Carousel ki pehli 4 images jati hain (X 4 se zyada nahi leta), reels video ban ke jati hain.

**Kharcha (zaroor parhein):** Feb 2026 se X API naye developers ke liye free nahi. Pay-per-use hai: takreeban
**$0.015 per post**, lekin post mein link ho to **$0.20**. Is liye X posts mein link nahi daala (bio mein endureqr.com
hai). 30 posts ≈ $0.45 mahina. Naye account ko pehli credit purchase pe ~$20 free credit milta hai. Rates badalte
rehte hain: Developer Console mein check karein.

### Step X1: Developer account aur app

1. <https://console.x.com> (ya developer.x.com) → `@endureqr_app` se login → developer account banao.
2. **Billing / Credits** mein card save karo aur thode credits kharido (jitna kam se kam allow ho). Auto-recharge band rakho.
3. **Projects & Apps** → naya app, naam `EndureQR Poster`.
4. App → **Settings → User authentication settings → Set up**:
   - App permissions: **Read and write**
   - Type: **Web App, Automated App or Bot**
   - Callback URL: `https://endureqr.com` · Website: `https://endureqr.com` (sirf form ke liye, use nahi hote)
5. App → **Keys and tokens**:
   - **API Key and Secret** → Regenerate → dono copy karo.
   - **Access Token and Secret** → Generate (Step 4 ke BAAD, warna token read-only banta hai) → dono copy karo.

⚠️ Ye chaaron keys password jaisi hain. Chat, file ya code mein nahi, sirf GitHub Secrets mein.

### Step X2: GitHub mein daalo

github.com/cmsdev55/endureqr-social → **Settings → Secrets and variables → Actions**

**Secrets** (4 dafa New repository secret): `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`

**Variables**: `SOCIAL_PLATFORMS` = `ig,fb,x` (pehle se hai to edit karke `,x` add karo)

Optional: `X_INCLUDE_LINK` = `true` → X posts mein guide ka link bhi jayega (har post ~$0.20).

### Step X3: Test

**Actions → Daily social post → Run workflow**, `day` = aaj ka din, Dry run ✅ → log mein `--- X post (…/280) ---`
dikhega. Theek ho to Dry run ❌ se ek dafa chalao. Us ke baad roz khud chalega; X pe ek din ka post do dafa nahi
jata (GitHub cache mein free marker rakha jata hai, X ka timeline check karne pe paise lagte).

| Error | Matlab |
|---|---|
| `401 Unauthorized` | Koi key galat copy hui, ya Regenerate ke baad purani reh gayi. |
| `403 ... oauth1 app permissions` | Access token "Read and write" set karne se pehle bana tha. Token regenerate karo. |
| `402` / `CreditsDepleted` | Credits khatam. Console → Billing. |
| `403 ... duplicate content` | Same text pehle post ho chuka. |

---

## Code ke bagair option (agar ye setup mushkil lage)

**Meta Business Suite** (free): <https://business.facebook.com> → **Planner** → **Create post**. `media/` se images
uthao, caption `posts.json` se copy karo, Instagram + Facebook dono tick karke date/time schedule kar do.
30 posts ~45 minute mein schedule ho jate hain. Bas itna farq hai ke ye manual hai, aur Meta aage kitne din tak schedule
karne deta hai wo limit badalti rehti hai.

## Agle 30 din

Day 30 ke baad script kuch post nahi karega aur log mein bata dega. Mujhe kehna "next 30 posts bana do": main
`posts.json` mein day 31–60 add karke `npm run render` chala dunga.
