import { Request,Response } from "express";
import { S3Client,GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma";
import dotenv from "dotenv";
dotenv.config();

const s3=new S3Client({
    region : process.env.AWS_REGION,
})

export const playVideo = async(req:Request, res: Response)=>{
    const videoId=req.params.id;
    if(!videoId)return res.status(400).json({error:"video id required"});

    try{
        const video=await prisma.video.findUnique({
            where:{id:videoId},
            select:{status:true,variants:true},
        });

        if(!video)return res.status(404).json({error:"video not found"});
        if(video.status!=="processed")return res.json(409).json({error:"video not ready"});

        const variants=video.variants as Array<{resolution : string; key:string }>;
        if(!variants?.length)res.status(404).json({error:"no variants available"});

        const preferred = variants.find((v)=>v.resolution==="480p")??variants[0];

        const bucket=process.env.AWS_BUCKET;

        if(!bucket)throw new Error("S3 bucket is missing");

        const command = new GetObjectCommand({
            Bucket:bucket,
            Key:preferred.key,
        })

        const playbackUrl=await getSignedUrl(s3,command,{expiresIn:3600});

        return res.json({
            playbackUrl,
            variant:preferred.resolution,
            expiresIn:3600,
        });
    }catch(err:any){
        console.error("playback error: ",err);
        return res.status(500).json({error:err.message});
    }
}