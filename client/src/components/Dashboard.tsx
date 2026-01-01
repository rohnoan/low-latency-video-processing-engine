import { useEffect, useState } from "react";

type Video = {
  id: string;
  title: string;
  status: string;
  lastError?: string;
  failCount?: number;
};

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  async function fetchVideos() {
    const res = await fetch("http://localhost:3000/videos");
    const data = await res.json();
    setVideos(data);
  }

  async function retryVideo(id: string) {
    await fetch(`http://localhost:3000/videos/${id}/retry`, {
      method: "POST",
    });
    fetchVideos();
  }

  // ---------- UPLOAD FLOW ----------
  async function uploadVideo() {
    if (!file) return;

    // 1. Ask backend for presigned URL
    const res = await fetch("http://localhost:3000/api/upload/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: file.name,
        userId: "temp-user", // auth later
      }),
    });

    const { uploadUrl } = await res.json();

    // 2. Upload directly to S3
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploadProgress(100);
      setFile(null);
      fetchVideos(); // show immediately as uploaded
    };

    xhr.send(file);
  }

  // ---------- PLAY VIDEO ----------
  async function playVideo(id: string) {
    const res = await fetch(`http://localhost:3000/videos/${id}/play`);
    const data = await res.json();
    setPlayingUrl(data.playbackUrl);
  }

  useEffect(() => {
    fetchVideos();
    const i = setInterval(fetchVideos, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Video Dashboard</h2>

      {/* -------- UPLOAD -------- */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button onClick={uploadVideo} disabled={!file}>
          Upload
        </button>

        {uploadProgress > 0 && (
          <p>Upload progress: {uploadProgress}%</p>
        )}
      </div>

      {/* -------- PLAYER -------- */}
      {playingUrl && (
        <div style={{ marginBottom: 20 }}>
          <video src={playingUrl} controls width={480} />
        </div>
      )}

      {/* -------- VIDEO LIST -------- */}
{videos.length === 0 ? (
  <div
    style={{
      marginTop: 40,
      padding: 20,
      border: "1px dashed #aaa",
      textAlign: "center",
      color: "#666",
    }}
  >
    <p><b>No videos available</b></p>
    <p>Upload a video to get started.</p>
  </div>
) : (
  videos.map((v) => (
    <div
      key={v.id}
      style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}
    >
      <b>{v.title}</b>
      <p>Status: {v.status}</p>

      {v.status === "failed" && (
        <>
          <p>Error: {v.lastError}</p>
          <p>Fail count: {v.failCount}</p>
          <button onClick={() => retryVideo(v.id)}>Retry</button>
        </>
      )}

      {v.status === "processed" && (
        <>
          <img
            src={`http://localhost:3000/videos/${v.id}/thumbnail`}
            width={160}
          />
          <br />
          <button onClick={() => playVideo(v.id)}>Play</button>
        </>
      )}
    </div>
  ))
)}

    </div>
  );
}
