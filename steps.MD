Preparations (step 0)

0.1. Install: Docker, Node.js (or your chosen runtime), pnpm/npm, AWS CLI, ffmpeg (locally for quick tests).
0.2. Create Git repo and branch mvp/basic-pipeline.
Check: docker --version && node -v && git status returns OK.

Step 1 — Create minimal repo layout

1.1. Locally create folders: api/, worker/, infra/, migrations/, .env.example.
1.2. Init package.json in api/ and worker/ (you’ll use TypeScript but keep minimal).
Check: ls shows the folders; cd api && npm init -y works.

Step 2 — Run Postgres + Redis with Docker

2.1. Run Postgres:
docker run -d --name mvp-postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:15
2.2. Run Redis:
docker run -d --name mvp-redis -p 6379:6379 redis:7
Check: docker ps shows both containers; connect with psql or redis-cli if needed.

Step 3 — Create Prisma schema + migrate (minimal Video model)

3.1. Install Prisma in api/: npm i -D prisma @prisma/client then npx prisma init.
3.2. Add Video model with fields: id, title, status, rawKey, variants Json, thumbKey, createdAt, updatedAt.
3.3. Run npx prisma migrate dev --name init.
Check: psql shows the Video table or npx prisma studio shows the model.

Step 4 — Add environment config

4.1. Create .env with: DATABASE_URL, REDIS_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET.
4.2. Add .env.example and do not commit secrets.
Check: app can read env variables: node -e "console.log(process.env.DATABASE_URL)".

Step 5 — Implement presigned URL endpoint (simple)

5.1. Create POST /upload/request that: receives { title }, generates an S3 key like videos/<uuid>/raw.mp4, returns presigned PUT URL and that key.
5.2. For dev, you can use aws-sdk S3 presign or @aws-sdk/s3-request-presigner.
Check: call endpoint locally (curl). It returns { url, key }.

Step 6 — Test direct upload to S3

6.1. Using the returned presigned URL do:
curl --upload-file test.mp4 "<presigned-url>"
6.2. Verify object exists with AWS CLI:
aws s3 ls s3://<bucket>/videos/<uuid>/
Check: AWS CLI lists raw.mp4 (or uploaded key).

Step 7 — Webhook to receive upload notification (temporary manual)

7.1. Implement POST /webhook/s3-upload that accepts a JSON payload with key and size. (You’ll mimic S3 events first.)
7.2. On receive: create Video row with status = uploaded, rawKey = key, timestamp. Push a job to Redis/Bull queue with { videoId, key }.
Check: POST a mock payload via curl; DB has new Video row and Bull queue length increments.

Step 8 — Setup BullMQ queue (basic)

8.1. Install BullMQ, create a queue transcodeQueue. Backend pushes jobs; worker consumes them.
8.2. Configure simple retry policy (3 retries).
Check: push a test job; bull-board or logs show job is in queue.

Step 9 — Worker skeleton

9.1. In worker/ implement a worker process that consumes transcodeQueue. For now, on job receipt it should: log, set DB status = processing, then exit (placeholder).
9.2. Run worker locally with node dist/index.js or ts-node.
Check: Push a job from Step 7, see worker log and DB status updated to processing.

Step 10 — Add FFmpeg transcode (single variant 480p)

10.1. In worker, download file from S3 to /tmp/<videoId>.mp4 (or stream).
10.2. Run: ffmpeg -i input.mp4 -vf scale=-2:480 -c:a copy output_480.mp4 (simple).
10.3. Upload output_480.mp4 to S3 at videos/<videoId>/480p.mp4. Update DB: variants = [{resolution:'480p', key: '...'}], status = processed.
Check: S3 has 480p.mp4 and DB status = processed.

Step 11 — End-to-end test

11.1. Flow: Request presigned URL → Upload file → POST webhook (or real S3 event later) → job enqueued → worker transcodes → uploads → DB updated.
11.2. Run through it with a real small video.
Check: final DB shows processed, S3 contains raw + 480p, worker logs show completed steps.

Step 12 — Add signed playback URL endpoint

12.1. Implement GET /videos/:id/play that: verifies user/ownership (for MVP you can skip auth), generates S3 presigned GET URL for 480p.mp4, returns it.
Check: Call endpoint, open URL in browser — video streams/downloads.

Step 13 — Replace manual webhook with real S3 event (optional iteration)

13.1. Configure S3 to send s3:ObjectCreated:Put to an SQS queue or SNS -> HTTP webhook. (For local testing use localstack or continue manual).
13.2. Confirm webhook receives real S3 event and your endpoint verifies signature.
Check: Upload via presigned URL triggers webhook and enqueues job automatically.

Step 14 — Improve reliability: retries + DLQ

14.1. Configure BullMQ retries, add a DLQ queue transcodeDLQ. After N failures, move job to DLQ with error details.
14.2. Add DB column failCount and lastError.
Check: Simulate FFmpeg failure; job retries then moves to DLQ; DB records error.

Step 15 — Add thumbnail generation + incremental DB updates

15.1. Modify worker to generate a thumbnail with ffmpeg -ss 00:00:02 -i input.mp4 -frames:v 1 thumb.jpg. Upload to S3, set thumbKey in DB.
15.2. Update DB after each step so dashboard can show progress.
Check: S3 has thumb.jpg; DB shows thumbnailKey and timestamps for steps.

Step 16 — Add logging & observability

16.1. Send structured logs to console + file. Add Sentry/Log service later. Add simple metrics counters for jobs processed, failed.
Check: Logs show job start/end; metrics counters increment.

Step 17 — Small React dashboard (optional now or later)

17.1. Build a tiny UI that lists videos from DB, shows status, variants, thumbnail, and has Retry button calling POST /videos/:id/retry.
Check: UI shows DB entries in real time (poll every 5s or use websockets).

Step 18 — Clean up + refactor into final folder structure

18.1. Once MVP works, refactor code into clean structure (controllers/services/models). Add Dockerfiles (include ffmpeg in worker image).
18.2. Add infra/terraform if you plan IaC.
Check: All services run with Docker Compose or containers; repo structure matches earlier suggested final layout.

Step 19 — Harden for prod (quick list)

19.1. Add auth & permission checks on playback.
19.2. Add DLQ monitoring & alerting.
19.3. Use CDN with signed URLs for playback.
19.4. Secure secrets with vault/Secrets Manager.
Check: Security scan or checklist completed.

Step 20 — Ship & iterate

20.1. Deploy backend + worker to chosen host (Render, Railway, ECS). Use managed Postgres/Redis.
20.2. Monitor logs and iterate on features (multi-res, multipart upload, analytics).
Check: Live pipeline works end-to-end in cloud.