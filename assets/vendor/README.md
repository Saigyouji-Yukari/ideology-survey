# html2canvas

The report image exporter uses the unmodified browser bundle of html2canvas 1.4.1.

- Upstream: https://github.com/niklasvh/html2canvas/tree/v1.4.1
- Bundle: https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js
- Original license: https://github.com/niklasvh/html2canvas/blob/v1.4.1/LICENSE
- License: MIT; copyright Niklas von Hertzen. See `html2canvas.LICENSE`.
- SHA-256 of the vendored bundle: `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb`

The website loads this copy from its own origin. No CDN request, proxy, upload,
remote font, or image service is used to generate report pages. The exporter
creates bounded page canvases sequentially and renders only the selected batch.
