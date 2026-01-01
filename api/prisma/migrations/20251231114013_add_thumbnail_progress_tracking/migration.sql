-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "thumbGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "transcodedAt" TIMESTAMP(3);
