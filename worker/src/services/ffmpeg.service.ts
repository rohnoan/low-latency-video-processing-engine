import { exec } from "child_process";

 import { execSync } from "child_process";
//this is for testing ffmpeg failure handling

// export function transcode480p(inputPath: string, outputPath: string) {
//   throw new Error("ffmpeg failed intentionally");
// }

export function getVideoHeight(file: string): number {
  const out = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${file}"`
  ).toString();
  return parseInt(out.trim(), 10);
}


function run(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, _stdout, stderr) => {
      if (error) {
        console.error("ffmpeg error:", stderr);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function transcode480p(inputPath: string, outputPath: string) {
  return run(
    `ffmpeg -y -i "${inputPath}" -vf scale=-2:480 -c:v libx264 -preset veryfast -crf 23 -c:a aac "${outputPath}"`
  );
}

export function transcode720p(inputPath: string, outputPath: string) {
  return run(
    `ffmpeg -y -i "${inputPath}" -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 21 -b:v 3000k -c:a aac "${outputPath}"`
  );
}

export function generateThumbnail(inputPath: string, outputPath: string) {
  return run(
    `ffmpeg -y -ss 00:00:02 -i "${inputPath}" -frames:v 1 "${outputPath}"`
  );
}
