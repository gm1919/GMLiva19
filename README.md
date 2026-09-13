# GMLiva

GMLiva is a real AI-powered personal social-media assistant.

Core flow:

2–3 photos → AI analysis → strongest photo → 5 natural pose directions → aesthetics → post package → stories/collage → planner → approval

## Stack

- Vanilla HTML/CSS/JavaScript frontend
- Vercel serverless backend
- OpenAI Responses API for image analysis + content generation
- No API key in frontend code

## Deploy to Vercel

1. Put this project in a GitHub repository.
2. Import the repository into Vercel.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `OPENAI_API_KEY` = your OpenAI API key
   - Optional: `OPENAI_MODEL` = `gpt-5.6-luna`
4. Redeploy.
5. Open the Vercel public URL.
6. Upload 2–3 photos and press Analyse.

## Local development

Install Node.js, then:

```bash
npm install
npx vercel dev
```

Create a local `.env.local` containing:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

Never commit `.env.local` or expose the key in `app.js` or `index.html`.

## Privacy behavior

The browser resizes photos before sending them to `/api/analyze`. The serverless function passes them to the configured AI provider and does not save them to a database. Provider-side data handling is governed by the provider's current terms/settings.

## MVP boundaries

GMLiva does not automatically publish to Instagram or other platforms. The approval step is intentionally manual.

The current Pose Studio provides natural pose directions. It does not claim to generate edited pose images unless a separate image-generation backend is added later.


## GMLiva v2 feature update
- Actual AI Pose Studio: generates five edited pose versions from the selected photo using OpenAI image editing.
- Music Studio: surfaces AI-selected music ideas for posts/stories.
- Highlights: profile highlight name ideas remain part of the content plan.
- Privacy & Security section: explains server-side API key, no automatic publishing, and local/session handling.
- `/api/pose` performs the image-edit request server-side; the OpenAI API key is never sent to the browser.

### Important privacy note
GMLiva's own Vercel backend does not persist uploaded photos in a database or file store. AI requests are sent to the configured OpenAI API, so the final privacy statement should always be kept consistent with the current OpenAI API data-controls/retention terms for the account.
