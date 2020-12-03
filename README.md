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

## Signing requests

You can optionally enable request signing. This signs each request with a HMAC using a secret known only to your application, thus preventing URLs being modified. 

To enable this mode, supply a `SIGNATURE_SECRET` environment variable. The signature is worked out with the following:

1. Taking query string parameters as key value map, sort into key ascending order
2. Generate a query string from the parameters in sorted order
3. Take the SHA256 HMAC of the query string and secret.

The code for calculating a valid signature can be found in the `calculateSignature` function. A similar python implementation would be:

```
import collections
import urllib.parse
import hmac
import hashlib

params = {
	"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Mulga_Parrot_male_1_-_Patchewollock.jpg/1280px-Mulga_Parrot_male_1_-_Patchewollock.jpg",
	"w":"500",
	"mode":"bestfit",
	"h":"200"
}
secret = "www"
od = collections.OrderedDict(sorted(params.items()))
qs = urllib.parse.urlencode(od)
h = hmac.new( secret.encode('UTF-8'), qs.encode('UTF-8'), hashlib.sha256 )
print( h.hexdigest() )
//prints: 99c5e9962e662357a564c3973d6f0a42630808869c4c790ddffafaa8b339ec10
```

An example of a valid signed request (with secret as `SIGNATURE_SECRET=www`) `tmb?url=https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Mulga_Parrot_male_1_-_Patchewollock.jpg/1280px-Mulga_Parrot_male_1_-_Patchewollock.jpg&w=500&mode=bestfit&h=200&signature=99c5e9962e662357a564c3973d6f0a42630808869c4c790ddffafaa8b339ec10`;

If the environment variable is not supplied to the process, no checking occurrs. 

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

- Better error handling and configurable timeouts
- Cache header control via env vars
- Ability to supply a background colour of 'pad' mode
- (Potentital) cache images (origin and generated) in a GCP storage / S3 bucket so speed up requests.
