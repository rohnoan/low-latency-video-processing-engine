import { exec } from "child_process";

//this is for testing ffmpeg failure handling

// export function transcode480p(inputPath: string, outputPath: string) {
//   throw new Error("ffmpeg failed intentionally");
// }


export function transcode480p(inputPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${inputPath}" -vf scale=-2:480 -c:a copy "${outputPath}" -y`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error("ffmpeg error:", error);
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

export function generateThumbnail(
  inputPath: string,
  outputPath: string
) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -ss 00:00:02 -i "${inputPath}" -frames:v 1 "${outputPath}" -y`;
    exec(cmd, (error) => {
      if (error) return reject(error);
      resolve(true);
    });
  });
}
