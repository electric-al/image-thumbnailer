# image-thumbnailer

A simple service that can resize images on demand from an origin URL. Several resizing modes are possible, and it can convert images to PNG or JPEG dynamically. This service works best when deployed in some serverless environment (e.g. Google cloud Run - although can also be used as a cloud function) with a CDN in front of it to cache responses (this service does no caching of its own).

The service uses [express](https://expressjs.com/) and [sharp](https://github.com/lovell/sharp) for it's heavly lifting.

## Parameters

Once the service is deployed, you can access it like:

`<base>/tmb?url=<image origin URL>&w=400&h=400&mode=bestfit`

Parameters:

| Parameter | Meaning |
| --------- | ------------- |
| url       | The origin image URL. Required.  |
| w         | Target output width in pixels. Required.  |
| h         | Target output height in pixels. Required.  |
| mode      | Resize mode, see below. Defaults to 'bestfit'  |
| format    | Output image format. 'png' or 'jpeg'. Defaults to 'jpeg'  |

## Resizing modes

The `mode` parameter governs how the image is resized if the aspect ratio of the origin image and the target output size differ. Possible modes:

| Mode | Meaning |
| --------- | ------------- |
| bestfit | Returns an image at most `w` pixels wide and `h` pixels high, but may be smaller in one dimension in order to mainain aspect ratio. Default. |
| stretch | Returns an image exactly `w`x`h` pixels with the origin image streteched to fit exactly. |
| trim | Returns an image exactly `w`x`h` pixels with the edges of the origin image trimmed to fit exactly. |
| pad | Returns an image exactly `w`x`h` pixels with the edges of the origin image padded so that the whole origin image is visible. |

## Caching

This service is designed to be deployed behind a CDN. Currently all successful requests have a cache TTL of 1 hour. Errors have a cache TTL of 60s (see below).

## Error handling

In case of an error (e.g. incorrect parameters or an origin image that cannot be loaded), the service renders and returns a 1x1 transparent PNG image so that it does not break img tags in pages. The error message is sent back to the client in the 'X-Error-Message' HTTP response error. These images have a cache TTL of 60s balancing the fact that the error may be temporary, but we would not like to DDOS the service if the CDN layer cannot cache at all. This may be configurable in the future.

## Quick start: Deploying using Docker or on GCP cloud run and GCP cloud functions

To run this locally via Docker:

```
docker run -p 8080:8080 onewheelgood/image-thumbnailer
Test:
curl http://localhost:8080/tmb?url=https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Mulga_Parrot_male_1_-_Patchewollock.jpg/1280px-Mulga_Parrot_male_1_-_Patchewollock.jpg&w=100&h=100&mode=bestfit&format=png&sfdsf
```

To run on cloud run:

```
gcloud run deploy <name> --image onewheelgood/image-thumbnailer  --platform managed   --region us-central1   --allow-unauthenticated
```

To run as a cloud function:

```
(clone the repo)
tsc
cd dist
cp ../package.json ./
gcloud functions deploy <name> --runtime nodejs10 --trigger-http --allow-unauthenticated --entry-point app
```

## Future todos

- Ability to sign requests with a secret (supplied in the env vars) so that the parameters cannot be altered by modifying the URL
- Better error handling and configurable timeouts
- Cache header control via env vars
- Ability to supply a background colour of 'pad' mode
- (Potentital) cache images (origin and generated) in a GCP storage / S3 bucket so speed up requests.
