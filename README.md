# Contentful React Native Demo

Two Expo React Native apps that demonstrate how to display content from a Contentful space -- and how the **Contentful Optimization SDK** enhances the experience with personalization, analytics, and a live preview panel.

Both apps connect to the same Contentful space (`k8i80axw1j4b`, environment `react-native-demo`) and render the same content model (callToAction CTA header and blogPost list). The difference is _how_ they do it.

---

## Repository Structure

```
react-native-demo/
├── ContentfulDemoBase/          # Plain Contentful SDK app
│   ├── App.tsx                  # Navigation setup
│   ├── src/
│   │   ├── contentfulClient.ts  # Contentful CDA client + CTA_ENTRY_ID
│   │   ├── components/          # CTAHeader, RichTextRenderer
│   │   └── screens/             # HomeScreen, BlogPostDetailScreen
│   └── .env                     # Contentful credentials
│
├── ContentfulDemoOptimized/     # Optimization SDK app
│   ├── App.tsx                  # + OptimizationRoot wrapper & preview panel
│   ├── src/
│   │   ├── contentfulClient.ts  # Same Contentful CDA client
│   │   ├── optimizationClient.ts # Optimization SDK initialization
│   │   ├── components/          # Same components (unchanged)
│   │   └── screens/             # + Personalization, Analytics, ScrollProvider
│   └── .env                     # Contentful + Optimization credentials
│
└── README.md
```

---

## What Each App Does

### ContentfulDemoBase

A straightforward Contentful-powered app. It fetches content via the Contentful Delivery API and renders it in a clean, modern UI.

- **Home screen**: Displays a CTA header (fetched by `CTA_ENTRY_ID`) and a list of Blog Post entries as tappable cards.
- **Blog post detail screen**: Fetches a blog post with `include: 10` and renders its `title`, `teaser`, and `body` (rich text) in a clean article-style layout.
- **Rich text**: A lightweight custom renderer handles paragraphs, headings (h1--h6), bold/italic/underline marks, hyperlinks, and lists -- no external rich text library needed.

### ContentfulDemoOptimized

Identical UI, but with the **Contentful Optimization SDK** (`@contentful/optimization-react-native`) integrated. Four files differ from the base app:

| Change | What it does |
|--------|-------------|
| **`App.tsx`** | Wraps the app in `<OptimizationRoot>` with the SDK instance and an enabled preview panel FAB. |
| **`src/optimizationClient.ts`** (new) | Async factory that calls `Optimization.create()` with `clientId` and `environment` from `.env`. |
| **`src/screens/HomeScreen.tsx`** | The CTA is wrapped in `<Personalization baselineEntry={cta}>` (render-prop pattern) so the SDK resolves the correct variant. Each blog post card is wrapped in `<Analytics entry={...}>` for view tracking. |
| **`src/screens/BlogPostDetailScreen.tsx`** | Content is wrapped in `<ScrollProvider>` for viewport-based tracking. The blog post is wrapped in `<Analytics entry={...}>`. |

**Key demo points:**

- `<Personalization>` automatically resolves the right CTA variant for the current user profile (e.g. "Recurring Visitor" experience resolves a different CTA on return visits).
- `<Analytics>` tracks when a Contentful entry is at least 80% visible for 2 seconds (configurable).
- `<ScrollProvider>` enables accurate scroll-position-aware viewport tracking.
- The **preview panel** (floating action button) lets you browse audiences, override variant selection, and inspect the current profile -- all without modifying real user data.

---

## Prerequisites

- **Node.js** >= 18
- **Expo CLI** (comes with `npx expo`)
- **Expo Go** app on your phone, _or_ an Android Emulator / iOS Simulator
- A **Contentful Delivery API token** with access to space `k8i80axw1j4b`, environment `react-native-demo`
- _(Optimized app only)_ An **Optimization SDK client ID**

---

## Setup

### 1. Install dependencies

```bash
# Base app
cd ContentfulDemoBase
npm install

# Optimized app
cd ../ContentfulDemoOptimized
npm install
```

### 2. Configure environment variables

Each app has a `.env` file with placeholders. Fill in your actual credentials.

**ContentfulDemoBase/.env**

```env
CONTENTFUL_SPACE_ID=k8i80axw1j4b
CONTENTFUL_ACCESS_TOKEN=<your-delivery-api-token>
CONTENTFUL_ENVIRONMENT=react-native-demo
```

**ContentfulDemoOptimized/.env**

```env
CONTENTFUL_SPACE_ID=k8i80axw1j4b
CONTENTFUL_ACCESS_TOKEN=<your-delivery-api-token>
CONTENTFUL_ENVIRONMENT=react-native-demo
OPTIMIZATION_CLIENT_ID=<your-optimization-client-id>
OPTIMIZATION_ENVIRONMENT=react-native-demo
```

### 3. Run an app

```bash
# From either app directory:
npx expo start

# Or target a specific platform directly:
npx expo start --android
npx expo start --ios
```

Scan the QR code with Expo Go, or press `a` (Android emulator) / `i` (iOS simulator) in the terminal.

---

## Content Model Reference

The apps render these Contentful content types:

| Content Type | Key Fields | Notes |
|-------------|-----------|-------|
| **callToAction** | `heading` (Symbol, localized), `body` (RichText), `label` (Symbol, localized) | Has `nt_experiences` for personalization |
| **blogPost** | `title` (localized), `slug`, `teaser` (localized), `body` (RichText), `media`, `author`, `relatedPosts`, `cta` | Has `nt_experiences` |

### Known Entry IDs

| Entry | ID | Content Type |
|-------|-----|-------------|
| Baseline CTA | `6wk0RzqTcB8vyj4GsL95zE` | callToAction |
| CTA Variant ("Hi there USA!") | `6QnGwENQTR8FcApgv2SwGN` | callToAction |
| Personalization Experience | `2xUaecmUihPAbZ9j8fQycl` | nt_experience (Recurring Visitor) |
| Blog: Speed up your website | `6krLjwB5sNTm67u6Kunus` | blogPost |
| Blog: Financial tips for frequent flyers | `pkmjJYwMRzpf0TE2fz7Ay` | blogPost |
| Blog: How to optimize images for SEO | `6nipCnNuxVbk9UTEhp5C9C` | blogPost |

---

## Comparing the Two Apps Side-by-Side

Run both apps simultaneously on two emulators (or one on a device, one on an emulator) to see the difference:

1. **Base app** -- Content renders statically. Every user sees the same CTA.
2. **Optimized app** -- The CTA resolves to a personalized variant. Blog posts are tracked for analytics. The preview panel FAB in the bottom-right corner lets you switch audiences and see variants change in real time.
