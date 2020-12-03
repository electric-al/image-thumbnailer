
import asyncHandler from "express-async-handler"
import express from "express"
import createError from "http-errors"
import got from "got"
import crypto from "crypto"
import sharp from 'sharp'
import querystring from 'querystring'
import { query, validationResult } from 'express-validator';

const app = express()

enum ResizeMode {
    BESTFIT = "bestfit",        // Return image not exact size, but maintain aspect ratio
    STRETCH = "stretch",        // Stretch to fit. Does not maintain aspect ratio
    TRIM    = "trim",           // Trim off edges to fit exactly. Maintains aspect ratio.
    PAD     = "pad"             // Pads one edge so that the image fits exactly and aspect ratio is maintained.
}

enum ImageFormat {
    JPEG = "jpeg",
    PNG  = "png"
}

const sharp_resize_modes = {
    [ResizeMode.BESTFIT] : sharp.fit.inside,
    [ResizeMode.STRETCH] : sharp.fit.fill,
    [ResizeMode.TRIM]    : sharp.fit.cover,
    [ResizeMode.PAD]     : sharp.fit.contain
}

async function loadImageFromURL(source_url: string){
    const response = await got(source_url, {timeout: 5000, retry:0});
    const image = sharp(response.rawBody).withMetadata();
    image.rotate();
    return image;
}

async function resizeImage(image: sharp.Sharp, w: number, h: number, mode: ResizeMode){
    const sharp_resize_mode: (keyof sharp.FitEnum) = sharp_resize_modes[mode] 
    return image.resize(w, h, { 
        fit: sharp_resize_mode,
        withoutEnlargement : true,
        //background
    })
}

async function renderBuffer(image: sharp.Sharp, format: ImageFormat): Promise<[Buffer, string]>{
    if (format == ImageFormat.PNG) {
        return [await image.png().toBuffer(), 'image/png'];
    } else { // Default
        return [await image.jpeg().toBuffer(), 'image/jpeg'];
    }
}

function calculateSignature(params: any, secret: string): string{
    const hmac =  crypto.createHmac('sha256', secret)
    const ordered: { [key: string]: string} = {};
    Object.keys(params).sort().forEach(function(key: any) {
        if (key!='signature') ordered[key] = params[key];
    });
    hmac.update(querystring.encode(ordered))
    return hmac.digest('hex')
}

app.get('/tmb', [
    query('url').isURL(),
    query('w').isInt().toInt(),
    query('h').isInt().toInt(),
    query('mode').isIn([null, ResizeMode.BESTFIT, ResizeMode.PAD, ResizeMode.STRETCH, ResizeMode.TRIM]),
    query('format').isIn([null, ImageFormat.JPEG, ImageFormat.PNG])
], asyncHandler(async(req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createError(400, 'Parameters incorrect', { errors: errors.array() }) 
    }

    const source_url = req.query.url.toString()
    const w: number  = parseInt(req.query.w.toString())
    const h: number = parseInt(req.query.h.toString())
    const resize_mode_str: string = (req.query.mode || 'bestfit').toString()
    const format_str: string = (req.query.format || 'jpeg').toString()
    const signature: string = (req.query.signature || '').toString()

    // Check the signature
    if (process.env.SIGNATURE_SECRET) {
        if (!signature) {
            throw createError(403, 'Signature required') 
        }
        const expected_signature: string = calculateSignature(req.query, process.env.SIGNATURE_SECRET)
        if (signature != expected_signature){
            console.log(`Expected signature: ${expected_signature}`)
            throw createError(403, 'Signature mismatch') 
        }
    }

    const resize_mode: ResizeMode = resize_mode_str as ResizeMode
    const format: ImageFormat = format_str as ImageFormat

    const source_image = await loadImageFromURL(source_url)
    const resized_image = await resizeImage(source_image, w, h, resize_mode)
    const [output_buffer, mime_type] = await renderBuffer(resized_image, format)

    res .set('Content-Type', mime_type)
        .set('Cache-control', 'public, max-age=3600')
        .send(output_buffer);
}));

// Error handler to send a 1x1 transparent png back as to not break img tags.
// The error message is included in a response HTTP header 'X-Image-Error'
// This error image has a cache duration of 60s
app.use(function (err: any, req: any, res: any, next: any) {
    console.error(err)
    const canvas = sharp({
        create: {
          width: 1,
          height: 1,
          channels: 4,
          background: '#ffffff00'
        }
    });
    canvas.png().toBuffer().then((buffer) => {
        if (!err.statusCode) err.statusCode = 500;
        res.status(err.statusCode)
            .set('Content-Type', 'image/png')
            .set('Cache-control', 'public, max-age=60')
            .set('X-Error-Message', err.message)
            .send(buffer)
    })
})

exports.app = app;