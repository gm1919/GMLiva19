function bad(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) throw new Error("Unsupported image format.");
  return {
    buffer: Buffer.from(match[2], "base64"),
    ext: match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase()
  };
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return bad("GMLiva AI is not connected. Add OPENAI_API_KEY to Vercel.", 503);
    }

    const body = await request.json();
    if (typeof body?.image !== "string" || typeof body?.pose !== "string") {
      return bad("A source photo and pose direction are required.");
    }

    const { buffer, ext } = dataUrlToBuffer(body.image);
    if (buffer.length > 12 * 1024 * 1024) return bad("The source image is too large.");

    const prompt = `Edit this real personal photo to create one natural social-media pose variation.

Requested pose:
${body.pose}

Preserve the person's recognizable identity, facial features, skin appearance, hairstyle, clothing, body proportions, camera realism and overall photographic style as closely as possible. Change the pose only as needed to achieve the requested direction. Do not beautify into a different person. Do not change gender, age, ethnicity, body shape, clothing design, location, or add/remove unrelated people or objects. Keep hands and anatomy realistic. Keep the result photorealistic and suitable for an ordinary social-media photo.`;

    const mime = ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    form.append("image", new Blob([buffer], { type: mime }), `gmliva-source.${ext}`);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("input_fidelity", "high");
    const upstream = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });
    const payload = await upstream.json();
    if (!upstream.ok) throw Object.assign(new Error(payload?.error?.message || "Image editing failed."), { status: upstream.status });
    const edited = payload;

    const b64 = edited?.data?.[0]?.b64_json;
    if (!b64) return bad("The image model returned no edited image. Please try again.", 502);

    return new Response(JSON.stringify({
      image: `data:image/jpeg;base64,${b64}`,
      title: body.title || "Pose variation"
    }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("GMLiva pose error:", error);
    const detail = error?.error?.message || error?.message || "Unknown image-generation error.";
    return bad(`Pose generation failed: ${detail}`, error?.status && Number.isInteger(error.status) ? error.status : 500);
  }
}
