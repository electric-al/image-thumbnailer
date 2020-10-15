
const asyncHandler = require('express-async-handler')
const express = require('express')
const createError = require('http-errors')
const got = require('got')
const sharp = require('sharp')
const { query, validationResult } = require('express-validator');
const app = express()

const sharp_resize_modes = {
    'bestfit' : 'inside',       // Return image not exact size, but maintain aspect ratio
    'stretch' : 'fill',         // Stretch to fit. Does not maintain aspect ratio
    'trim'    : 'cover',        // Trim off edges to fit exactly. Maintains aspect ratio.
    'pad'     : 'contain'       // Pads one edge so that the image fits exactly and aspect ratio is maintained.
}

async function loadImageFromURL(source_url){
    response = await got(source_url, {timeout: 5000, retry:0});
    const image = sharp(response.rawBody).withMetadata();
    image.rotate();
    return image;
}

async function resizeImage(image, w, h, mode){
    const sharp_resize_mode = sharp_resize_modes[mode];
    return image.resize({ 
        width: w,
        height: h,
        fit: sharp_resize_mode,
        withoutEnlargement : true,
        //background
    })
}

async function renderBuffer(image, format){
    if (format=='png') {
        return [await image.png().toBuffer(), 'image/png'];
    } else {
        return [await image.jpeg().toBuffer(), 'image/jpeg'];
    }
}

app.get('/tmb', [
    query('url').isURL(),
    query('w').isInt().toInt(),
    query('h').isInt().toInt(),
    query('mode').isIn([null,'bestfit','stretch','trim','pad']),
    query('format').isIn([null, 'png', 'jpeg'])
], asyncHandler(async(req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createError(400, 'Parameters incorrect', { errors: errors.array() }) 
    }

    const source_url = req.query.url
    const w = req.query.w
    const h = req.query.h
    const resize_mode = req.query.mode || 'bestfit'
    const format = req.query.format || 'jpeg'

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
app.use(function (err, req, res, next) {
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