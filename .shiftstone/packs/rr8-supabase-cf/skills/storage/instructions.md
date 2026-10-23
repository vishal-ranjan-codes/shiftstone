
# Cloudflare R2 Storage Skill

> Load this skill when implementing file uploads, object storage, or asset delivery in {{PROJECT_NAME}}.

---

## 1. Cloudflare R2 Architecture

{{PROJECT_NAME}} uses **Cloudflare R2** for object storage via the AWS SDK S3-compatible API (`@aws-sdk/client-s3`):

```
Browser Client
      │
      ├─► 1. Request Presigned Upload URL ──► /api/upload (Route Action)
      │                                             │
      │                                     AWS SDK S3 Client
      │                                     (getSignedUrl + PutObjectCommand)
      │
      ├─► 2. Direct PUT to Cloudflare R2 ────► Cloudflare R2 Bucket
      │
      └─► 3. Download / View Asset ─────────► /api/download/:key OR R2 Public Domain
```

---

## 2. S3 Client Setup (`app/lib/r2/client.ts`)

```typescript
import { S3Client } from "@aws-sdk/client-s3";

export function getR2Client(env: {
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}) {
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

## 3. Presigned Upload URL Generation

In route actions (e.g. `routes/api.upload.ts`):

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "~/lib/r2/client";

export async function action({ request, context }: Route.ActionArgs) {
  const { fileName, contentType } = await request.json();
  const fileKey = `${crypto.randomUUID()}-${fileName}`;

  const client = getR2Client(context.env);
  const command = new PutObjectCommand({
    Bucket: context.env.R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  return Response.json({ uploadUrl, fileKey });
}
```

---

## 4. Download & Asset Streaming

For private files, generate presigned GET URLs or stream directly through a resource route:

```typescript
// routes/api.download.$key.ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "~/lib/r2/client";

export async function loader({ params, context }: Route.LoaderArgs) {
  const client = getR2Client(context.env);
  const command = new GetObjectCommand({
    Bucket: context.env.R2_BUCKET_NAME,
    Key: params.key,
  });

  const response = await client.send(command);
  return new Response(response.Body as any, {
    headers: {
      "Content-Type": response.ContentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```
