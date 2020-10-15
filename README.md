# image-thumbnailer

A simple service that can resize images on demand from an origin URL. Several resizing modes are possible, and it can convert images to PNG or JPEG dynamically. This service works best when deployed in some serverless environment (e.g. Google cloud Run - although can also be used as a cloud function) with a CDN in front of it to cache responses (this service does no caching of its own).

## Parameters

Once the service is deployed, you can access it like:

`<base>/tmb?url=https://upload.wikimedia.org/wikipedia/en/7/7d/Lenna_%28test_image%29.png&w=400&h=400&mode=bestfit`

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

## Future todos

- Ability to sign requests with a secret (supplied in the env vars) so that the parameters cannot be altered by modifying the URL
- Better error handling and timeouts
- Cache header control via env vars
- Ability to supply a background colour of 'pad' mode
- (Potentital) cache images (origin and generated) in a GCP storage / S3 bucket so speed up requests.
