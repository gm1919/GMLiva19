import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          photoNumber: { type: "integer" },
          score: { type: "integer" },
          strengths: { type: "array", items: { type: "string" } },
          improvement: { type: "string" }
        },
        required: ["photoNumber", "score", "strengths", "improvement"]
      }
    },
    bestPhotoNumber: { type: "integer" },
    bestPhotoReason: { type: "string" },
    poseIdeas: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          direction: { type: "string" },
          naturalTip: { type: "string" }
        },
        required: ["title", "direction", "naturalTip"]
      }
    },
    aesthetics: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          setting: { type: "string" },
          light: { type: "string" },
          mood: { type: "string" }
        },
        required: ["name", "setting", "light", "mood"]
      }
    },
    postPackage: {
      type: "object",
      additionalProperties: false,
      properties: {
        caption: { type: "string" },
        alternatives: { type: "array", items: { type: "string" } },
        music: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
        postingSuggestion: { type: "string" }
      },
      required: ["caption", "alternatives", "music", "hashtags", "postingSuggestion"]
    },
    storyPlan: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slide: { type: "string" },
          text: { type: "string" },
          visual: { type: "string" },
          music: { type: "string" }
        },
        required: ["slide", "text", "visual", "music"]
      }
    },
    collageLayouts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" }
    },
    highlights: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string" }
    },
    planner: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          idea: { type: "string" },
          timing: { type: "string" }
        },
        required: ["type", "idea", "timing"]
      }
    }
  },
  required: [
    "analyses",
    "bestPhotoNumber",
    "bestPhotoReason",
    "poseIdeas",
    "aesthetics",
    "postPackage",
    "storyPlan",
    "collageLayouts",
    "highlights",
    "planner"
  ]
};

function bad(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return bad("GMLiva AI is not connected yet. Add OPENAI_API_KEY to the Vercel project environment variables.", 503);
    }

    const body = await request.json();
    const images = Array.isArray(body?.images) ? body.images : [];

    if (images.length < 2 || images.length > 3) {
      return bad("Please upload exactly 2 or 3 photos.");
    }

    const validImages = images.filter(
      (src) => typeof src === "string" && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(src)
    );

    if (validImages.length !== images.length) {
      return bad("One or more uploaded files are not supported images.");
    }

    const content = [
      {
        type: "input_text",
        text: `You are GMLiva, a personal social-media content assistant.
Analyze these ${images.length} personal photos as a set.

Your job:
1. Score each photo for social-media readiness using composition, lighting, framing, expression, clarity and overall visual balance.
2. Select the strongest photo and explain the choice in plain language.
3. Give exactly 5 natural pose directions that could be recreated by the same person. Do not suggest body reshaping, facial changes, identity changes, exaggerated anatomy, or artificial-looking poses.
4. Give exactly 4 suitable background/aesthetic directions. Keep the person's real identity and natural proportions as design goals.
5. Create a practical post package: one main caption, 3 alternatives, 4 music suggestions, hashtags, and a sensible posting suggestion. Music suggestions should be titles/artists only; do not quote lyrics.
6. Create a 3-slide story plan.
7. Give 3 collage layout ideas.
8. Give 4 highlight name ideas.
9. Give a simple 3-item future content plan.

Do not infer sensitive traits, identity, age, religion, health, ethnicity, political views, or other private attributes from the images. Describe only visible, useful creative characteristics.

Return only the requested JSON structure.`
      },
      ...validImages.map((image_url) => ({
        type: "input_image",
        image_url
      }))
    ];

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "gmliva_content_plan",
          strict: true,
          schema
        }
      }
    });

    const raw = response.output_text;
    if (!raw) return bad("The AI returned an empty result. Please try again.", 502);

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return bad("The AI response could not be read. Please try again.", 502);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    console.error(error);
    return bad("GMLiva could not complete the analysis. Please try again.", 500);
  }
}
