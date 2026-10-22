
# Cloudflare R2 Object Storage Skill

> Load this skill when implementing file uploads, attachments, user avatar storage, or streaming files from Cloudflare R2.

---

## 1. Zero Egress Fee Object Storage

Cloudflare R2 provides an S3-compatible API with zero data egress charges. In {{PROJECT_NAME}}, interface with R2 using `@aws-sdk/client-s3`.

---

## 2. R2 Client Factory (`app/lib/r2/client.ts`)

```typescript
import { S3Client } from "@aws-sdk/client-s3";
import type { Env } from "~/lib/env";

export function createR2Client(env: Env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing Cloudflare R2 credentials in environment");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}
```

---

## 3. Upload Resource Route (`app/routes/api.upload.ts`)

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client } from "~/lib/r2/client";
import { supabaseMiddleware } from "~/middleware/supabase";
import { authMiddleware } from "~/middleware/auth";
import type { Route } from "./+types/api.upload";

export const middleware: Route.MiddlewareFunction[] = [
  supabaseMiddleware,
  authMiddleware,
];

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const r2 = createR2Client(env);

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
  }

  // Generate clean, collision-free key
  const fileExt = file.name.split(".").pop();
  const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  const buffer = await file.arrayBuffer();

  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
    })
  );

  return {
    success: true,
    key,
    url: `https://${env.R2_PUBLIC_DOMAIN}/${key}`,
  };
}
```

---

## 4. Presigned Upload URLs (Direct Client-to-R2)

For files larger than 10MB, bypass the Worker body limit using presigned URLs:

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function getPresignedUploadUrl(env: Env, key: string, contentType: string) {
  const r2 = createR2Client(env);
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2, command, { expiresIn: 3600 });
}
```

---

## 5. Best Practices & Rules

- **Sanitize File Names**: Never use raw client-provided filenames directly as object keys. Always prefix with a timestamp or UUID.
- **Set Content-Type**: Always specify `ContentType` when uploading so browsers render the asset with appropriate MIME types.
- **Use Presigned URLs for Large Payloads**: Direct multipart uploads through Workers risk hitting the 128MB memory ceiling.
